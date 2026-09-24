import { signal } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LockResult, QueueStatus, SeatView } from '../../shared/model';
import { dialogs } from '../app/dialog';
import { Session } from '../app/session';
import { GameClock } from '../net/gameClock';
import { createInProcessLink } from '../net/inProcessLink';
import type { ServerLink } from '../net/link';
import { buildVenue } from '../../shared/venue';
import { OPEN_DIFF } from '../../sim/modes/openServer';
import type { GameResult } from '../app/result';
import { BookingFlow } from './bookingFlow';
import { CancelGame } from './cancelGame';
import { SeatPicker } from './seatPicker';
import type { BookingGame } from './types';

const wall = (): number => Date.now();

let link: ServerLink;
let session: Session;
let navs: string[];
/** 참이면 대기열 순번 조회에 서버 대신 GONE으로 답한다 */
let forceGone: boolean;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  forceGone = false;
  const real = createInProcessLink({ wallNow: wall });
  link = {
    ...real,
    call: ((method, params) => (method === 'open.status' && forceGone
      ? Promise.resolve<QueueStatus>({ status: 'GONE' })
      : real.call(method, params))) as ServerLink['call'],
  };
  navs = [];
  session = new Session(link, p => navs.push(p), new GameClock(wall));
  dialogs.value = [];
});

afterEach(() => {
  session.dispose();
  link.dispose();
  vi.useRealTimers();
});

/** cond가 참이 될 때까지 가짜 시간을 흘린다 */
async function until(cond: () => boolean, maxMs = 120_000, step = 50): Promise<void> {
  for (let t = 0; t < maxMs && !cond(); t += step) await vi.advanceTimersByTimeAsync(step);
  if (!cond()) throw new Error('condition not met');
}

/** 맨 위 대화상자를 누른다 */
function answer(v = true): string {
  const d = dialogs.value.at(-1);
  if (!d) throw new Error('no dialog');
  d.close(v);
  return d.msg;
}

async function startOpen() {
  const p = session.start('open', 'easy');
  await until(() => session.game.value != null);
  await p;
  const g = session.game.value;
  if (g?.kind !== 'open') throw new Error();
  return g;
}

describe('오픈 티켓팅 (Session + OpenGame + 가상 서버)', () => {
  it('관람일 · 오픈 전 클릭 → 대기열 → 입장 → 좌석 → 결제 → 결과', async () => {
    const g = await startOpen();
    expect(navs).toEqual(['/open']);

    const noDate = g.clickBook();
    expect(answer()).toBe('관람일을 선택해 주세요.');
    await noDate;

    g.selectDate('1010');
    void g.clickBook();
    await until(() => dialogs.value.length > 0);
    expect(answer()).toContain('예매 오픈 전입니다');
    expect(g.stats.early).toBe(1);

    await until(() => session.clock.now() > g.openAt + 200, 30_000);
    void g.clickBook();
    await until(() => g.phase.value === 'queue');
    expect(g.queue.value?.rank).toBeGreaterThan(1);

    await until(() => g.phase.value === 'booking', 120_000, 200);
    const flow = g.flow.value!;
    expect(flow.captcha.value).toBe(true);
    flow.passCaptcha();
    expect(session.logs.value.some(l => l.msg === '보안문자 인증 통과')).toBe(true);

    const picker = flow.picker.value!;
    await until(() => picker.view.value != null);
    const zone = Object.entries(picker.view.value!.zoneCounts).find(([, n]) => n > 0)![0];
    void picker.load(zone);
    await until(() => picker.zone.value === zone);
    picker.toggle(picker.view.value!.avail![0]!);
    void picker.done();
    await until(() => flow.step.value === 3);

    flow.gotoConfirm();
    void flow.gotoPayment();
    expect(answer()).toContain('동의해 주세요');
    flow.agreeInfo.value = true;
    await flow.gotoPayment();
    expect(flow.step.value).toBe(5);
    flow.agreeAll.value = true;
    void flow.pay();
    await until(() => flow.step.value === 6);
    expect(g.phase.value).toBe('done');
    await until(() => flow.persistLag.value != null);

    g.finishSuccess();
    expect(navs.at(-1)).toBe('/result');
    const r = session.lastResult.value!;
    expect(r).toMatchObject({ kind: 'open', success: true, early: 1 });
    expect(r.seats).toHaveLength(1);
    expect(session.game.value).toBeNull();
  });

  it('대기 중 F5 → 대기순서 초기화 (새 uuid로 재진입)', async () => {
    const g = await startOpen();
    g.selectDate('1010');
    await until(() => session.clock.now() > g.openAt + 1500, 30_000);
    void g.clickBook();
    await until(() => g.phase.value === 'queue');
    const first = g.uuid.value;
    g.onF5();
    expect(g.stats.requeues).toBe(1);
    await until(() => g.phase.value === 'queue' && g.uuid.value != null);
    expect(g.uuid.value).not.toBe(first);
  });

  it('예매창 제한시간(active TTL)이 끝나면 예매창이 닫히고 상품 페이지로 돌아간다', async () => {
    const g = await startOpen();
    g.selectDate('1010');
    await until(() => session.clock.now() > g.openAt + 200, 30_000);
    void g.clickBook();
    await until(() => g.phase.value === 'booking', 120_000, 200);
    const flow = g.flow.value!;
    const ttl = OPEN_DIFF.easy.activeTtl * 1000;
    expect(g.timeLeft.value).toBeGreaterThan(ttl - 5_000);

    await until(() => g.phase.value === 'product', ttl + 10_000, 1000);
    expect(answer()).toContain('예매 가능 시간이 만료되었습니다');
    expect(g.flow.value).toBeNull();
    expect(g.uuid.value).toBeNull();
    expect(g.timeLeft.value).toBeNull();
    // 닫힌 예매창은 더 이상 만료를 알리지 않는다
    await vi.advanceTimersByTimeAsync(2000);
    expect(dialogs.value).toEqual([]);
    expect(flow.picker.value).not.toBeNull();
  });

  it('대기 정보가 사라지면(GONE) 대기창도 닫힌다', async () => {
    const g = await startOpen();
    g.selectDate('1010');
    await until(() => session.clock.now() > g.openAt + 1500, 30_000);
    void g.clickBook();
    await until(() => g.phase.value === 'queue');
    forceGone = true;
    await until(() => dialogs.value.length > 0, 30_000);
    expect(answer()).toContain('대기 정보가 만료되었습니다');
    expect(g.queue.value).toBeNull();
    expect(g.uuid.value).toBeNull();
    expect(g.phase.value).toBe('product');
  });

  it('게임을 바꿔도 이전 게임의 늦은 tick이 새 게임 시계를 망치지 않는다', async () => {
    const p1 = session.start('cancel', 'normal');
    await until(() => session.game.value != null);
    await p1;
    await vi.advanceTimersByTimeAsync(2000); // 취켓팅 시계는 고배속으로 한참 앞서 간다
    const g = await startOpen();
    await vi.advanceTimersByTimeAsync(500);
    const drift = session.clock.now() - (g.info.now + 500);
    expect(Math.abs(drift)).toBeLessThan(200);
  });
});

describe('SeatPicker', () => {
  const fakeGame = (lockResult: LockResult): BookingGame => {
    const view: SeatView = { at: 0, stock: { VIP: 5, R: 0, S: 0 }, zoneCounts: { A: 2 }, avail: ['A-1-1', 'A-1-2'], zone: 'A' };
    return {
      kind: 'open', maxSeats: 2, seatHint: null, venue: buildVenue(),
      stats: { taken: 0, captchaFails: 0, refreshes: 0, blocks: 0 }, timeLeft: signal(null),
      dateLabel: () => '', fmtTime: () => '',
      seatView: async () => view,
      lock: async () => lockResult,
      release: async () => ({ ok: 1, released: 0 }),
      pay: async () => ({ ok: 0, reason: 'LOCK_LOST' }),
      onTimeout() {}, onAbort() {}, onLockLost() {}, finishSuccess() {}, log() {},
    };
  };

  it('다른 사람이 먼저 잡은 좌석 → "이미 선택된 좌석입니다." · 스냅샷에서 빠진다', async () => {
    const game = fakeGame({ ok: 0, reason: 'TAKEN', failed: 'A-1-1' });
    const locked: string[][] = [];
    const p = new SeatPicker(game, ids => locked.push(ids));
    await p.load('A');
    p.toggle('A-1-1');
    p.toggle('A-1-2');
    const done = p.done();
    await vi.advanceTimersByTimeAsync(0);
    expect(answer()).toBe('이미 선택된 좌석입니다.');
    await done;
    expect(game.stats.taken).toBe(1);
    expect(p.avail.value.has('A-1-1')).toBe(false);
    expect(p.selected.value).toEqual(['A-1-2']);
    expect(locked).toEqual([]);
  });

  it('저장 완료 알림이 결제 응답보다 먼저 와도 반영된다', async () => {
    let resolvePay!: (v: { ok: 1; bookingNo: string }) => void;
    const game: BookingGame = { ...fakeGame({ ok: 1 }), pay: () => new Promise(r => { resolvePay = r; }) };
    const flow = new BookingFlow(game);
    flow.locked.value = ['A-1-1'];
    flow.agreeAll.value = true;
    const paying = flow.pay();
    flow.onPersisted({ bookingNo: 'T1', publishedAt: 100, savedAt: 350 }); // 푸시가 먼저
    resolvePay({ ok: 1, bookingNo: 'T1' });
    await paying;
    expect(flow.step.value).toBe(6);
    expect(flow.persistLag.value).toBe(250);
  });

  it('제한시간 만료는 만료될 때마다 한 번씩만 알리고, 닫힌 예매창은 알리지 않는다', () => {
    const left = signal<number | null>(null);
    let timeouts = 0;
    const flow = new BookingFlow({ ...fakeGame({ ok: 1 }), timeLeft: left, onTimeout: () => { timeouts++; } });
    flow.open({ captcha: false });
    left.value = 5000;
    expect(timeouts).toBe(0);
    left.value = 0;
    left.value = -50;
    expect(timeouts).toBe(1);
    left.value = null; // 좌석 반환
    left.value = 300_000; // 다시 선점
    left.value = -1;
    expect(timeouts).toBe(2);
    flow.close();
    left.value = 1000;
    left.value = 0;
    expect(timeouts).toBe(2);
  });

  it('최대 매수를 넘기면 막는다', async () => {
    const p = new SeatPicker({ ...fakeGame({ ok: 1 }), maxSeats: 1 }, () => {});
    await p.load('A');
    p.toggle('A-1-1');
    p.toggle('A-1-2');
    expect(answer()).toBe('1인 최대 1매까지 선택 가능합니다.');
    expect(p.selected.value).toEqual(['A-1-1']);
  });
});

describe('CancelGame 선점 시간', () => {
  /** 서버 대신 handlers가 답하는 취켓팅 게임 (답이 없는 요청은 영원히 대기) */
  function fakeCancel(handlers: Record<string, () => Promise<unknown>>) {
    const now = signal(0);
    const calls: string[] = [];
    const results: GameResult[] = [];
    const link = {
      where: 'main', on: () => () => {}, dispose() {},
      call: (m: string) => { calls.push(m); return handlers[m]?.() ?? new Promise(() => {}); },
    } as unknown as ServerLink;
    const clock = { now: () => now.value } as unknown as GameClock;
    const g = new CancelGame(
      { link, clock, now, log() {}, finish: r => { results.push(r); } },
      { mode: 'cancel', game: 1, diff: 'normal', label: '보통', now: 0, start: 0, end: 1, windows: [] },
    );
    return { g, now, calls, results };
  }

  it('취소마감 뒤 선점 시간이 끝나면 DEADLINE으로 끝난다', async () => {
    const { g, now, results } = fakeCancel({ 'cancel.lock': async () => ({ ok: 1 }) });
    g.openBooking();
    await g.lock(['A-1-1']);
    expect(g.timeLeft.value).toBe(300_000);
    g.onDeadline(false); // 결제 중이면 마무리까지 기다린다
    expect(results).toEqual([]);
    now.value = 300_001;
    expect(answer()).toContain('좌석 선점 시간이 만료되었습니다');
    expect(results).toMatchObject([{ kind: 'cancel', success: false, reason: 'DEADLINE' }]);
  });

  it('선점 응답 전에 예매창을 닫으면 잡힌 좌석을 돌려주고 남은 시간도 남기지 않는다', async () => {
    let resolveLock!: (v: LockResult) => void;
    const { g, calls } = fakeCancel({ 'cancel.lock': () => new Promise<LockResult>(r => { resolveLock = r; }) });
    g.openBooking();
    const flow = g.flow.value!;
    const locking = g.lock(['A-1-1']);
    const closing = flow.askClose();
    answer(true);
    await closing;
    expect(g.phase.value).toBe('product');
    resolveLock({ ok: 1 });
    await locking;
    expect(g.timeLeft.value).toBeNull();
    expect(calls).toContain('cancel.release');
  });
});
