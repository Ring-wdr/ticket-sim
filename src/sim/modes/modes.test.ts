import { describe, expect, it } from 'vitest';
import type { DiffKey } from '../../shared/model';
import { testHost } from '../test/host';
import { CANCEL_END, CancelServer } from './cancelServer';
import { OPEN_AT, OPEN_DIFF, OpenServer } from './openServer';

/** 게임 시각 기준으로 step씩 진행하며 cond가 참이 될 때까지 (최대 limit) */
function runUntil(clock: { now: number; runUntil(t: number): void }, cond: () => boolean, step: number, limit: number): number {
  const end = clock.now + limit;
  while (!cond() && clock.now < end) clock.runUntil(clock.now + step);
  return clock.now;
}

describe('OpenServer', () => {
  it('오픈 전 요청은 NOT_OPEN', () => {
    const s = new OpenServer('normal', 1, testHost());
    expect(s.clock.now).toBeLessThan(OPEN_AT);
    expect(s.enterQueue()).toEqual({ error: 'NOT_OPEN' });
  });

  it('같은 시드면 같은 게임이 재현된다', () => {
    const run = () => {
      const h = testHost();
      const s = new OpenServer('normal', 42, h);
      s.clock.runUntil(OPEN_AT + 60_000);
      return { log: h.logs.map(l => `${l.t} ${l.msg}`), stock: s.engine.stock() };
    };
    expect(run()).toEqual(run());
  });

  // 군중이 모두 입장한 뒤에도 예매창 안의 사람들이 계속 시도해야 매진이 온다 (프로토타입에선 영원히 남았음)
  it.each(
    (['easy', 'normal', 'hard'] as DiffKey[]).flatMap(diff => [1, 7, 42].map(seed => [diff, seed] as const)),
  )('%s (seed %i): 봇만으로 목표 시간에 잔여석 0, 이어서 전석 매진', (diff, seed) => {
    const h = testHost();
    const s = new OpenServer(diff, seed, h);
    runUntil(s.clock, () => s.soldOut, 1000, 20 * 60_000);
    expect(h.events).toContainEqual({ t: 'soldout' });
    const target = OPEN_DIFF[diff].sellout;
    const stockOut = (s.stockOutAt! - OPEN_AT) / 1000;
    expect(stockOut).toBeGreaterThan(target * 0.8);
    expect(stockOut).toBeLessThan(target * 1.25);
    // 결제 대기(20~90초) · 결제 포기분 재판매 꼬리
    expect((s.clock.now - s.stockOutAt!) / 1000).toBeLessThan(300);
  });

  it('플레이어: 대기열 → 입장 → 선점 → 결제 → MQ 저장 알림', () => {
    const h = testHost();
    const s = new OpenServer('easy', 3, h);
    s.clock.runUntil(OPEN_AT + 500);
    const enter = s.enterQueue();
    if ('error' in enter) throw new Error('expected entry');
    expect(enter.rank).toBeGreaterThan(1);

    runUntil(s.clock, () => s.queueStatus(enter.uuid).status === 'ACTIVE', 1000, 10 * 60_000);
    const st = s.queueStatus(enter.uuid);
    expect(st).toMatchObject({ status: 'ACTIVE', ttl: OPEN_DIFF.easy.activeTtl });

    const view = s.seatView(enter.uuid, '203');
    if (!('avail' in view) || !view.avail?.length) throw new Error('expected seats in 203');
    const ids = view.avail.slice(0, 1);
    expect(s.lock(enter.uuid, ids)).toEqual({ ok: 1 });
    const paid = s.pay(enter.uuid, ids, 'card');
    if (!paid.ok) throw new Error('expected payment');
    expect(s.queueStatus(enter.uuid).status).toBe('GONE'); // active 키 삭제됨

    runUntil(s.clock, () => h.events.some(e => e.t === 'persisted'), 250, 60_000);
    expect(h.events).toContainEqual(expect.objectContaining({ t: 'persisted', row: expect.objectContaining({ bookingNo: paid.bookingNo }) }));
  });

  it('좌석 조회를 너무 자주 하면 차단된다 (실제 시각 기준)', () => {
    const h = testHost();
    const s = new OpenServer('easy', 3, h);
    s.clock.runUntil(OPEN_AT + 500);
    const enter = s.enterQueue();
    if ('error' in enter) throw new Error('expected entry');
    const results = Array.from({ length: 11 }, () => s.seatView(enter.uuid, null));
    expect(results.at(-1)).toMatchObject({ blocked: true, justBlocked: true });
  });
});

describe('CancelServer', () => {
  it('취소마감까지 흘러가면 시계가 멈추고 deadline 알림', () => {
    const h = testHost();
    const s = new CancelServer('normal', 5, h);
    s.setSpeed('fast');
    let real = 0;
    // 핫타임(실시간 · ×240) 구간 때문에 실제 시간으로 수백 초가 걸리는 게임이라 1초씩 크게 민다
    while (!s.deadlinePassed && real < 60 * 60_000) { s.clock.advance(1000); real += 1000; }
    expect(s.clock.now).toBe(CANCEL_END);
    expect(s.clock.halted).toBe(true);
    expect(h.events).toContainEqual({ t: 'deadline', halted: true });
    expect(s.stats.releases).toBeGreaterThan(20);
    // 핫타임 힌트 글이 올라왔고 공개됐다
    expect(h.events.some(e => e.t === 'feed' && e.reveal)).toBe(true);
    expect([...s.revealed].some(w => w.kind === 'big')).toBe(true);
  });

  it('좌석을 잡으면 실시간, 락이 만료되면 다시 고배속', () => {
    const h = testHost();
    const s = new CancelServer('easy', 9, h);
    // 첫 취소표가 뜰 때까지
    runUntil(s.clock, () => s.engine.stockTotal() > 0, 60_000, 3 * 86_400_000);
    const view = s.seatView(null);
    if ('blocked' in view) throw new Error('unexpected block');
    const zone = Object.entries(view.zoneCounts).find(([, n]) => n > 0)![0];
    const zv = s.seatView(zone);
    if ('blocked' in zv) throw new Error('unexpected block');
    expect(s.lock([zv.avail![0]!])).toEqual({ ok: 1 });

    expect(s.status()).toMatchObject({ focus: true, speed: 1 });
    expect(s.status().lockUntil).toBe(s.clock.now + 300_000);

    s.clock.advance(300_000); // 실시간 5분 → 락 만료
    s.redis.sweep();
    expect(s.status().focus).toBe(false);
    expect(s.status().speed).toBeGreaterThan(1);
  });
});
