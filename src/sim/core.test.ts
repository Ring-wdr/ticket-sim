import { describe, expect, it } from 'vitest';
import { buildVenue } from '../shared/venue';
import { BookingEngine } from './bookingEngine';
import { Clock } from './clock';
import { silentLog } from './log';
import { MiniRedis } from './miniRedis';
import { MQ } from './mq';
import { QueueService } from './queueService';
import { RateLimiter } from './rateLimiter';
import { createRng } from './rng';

describe('Clock', () => {
  it('같은 시각의 타이머는 등록 순서대로 실행한다', () => {
    const c = new Clock(0), out: string[] = [];
    c.setTimeout(() => out.push('b'), 100);
    c.at(50, () => out.push('a'));
    c.setTimeout(() => out.push('c'), 100);
    c.advance(200);
    expect(out).toEqual(['a', 'b', 'c']);
    expect(c.now).toBe(200);
  });

  it('타이머 안에서 now는 예약 시각이다', () => {
    const c = new Clock(1000), seen: number[] = [];
    c.setInterval(() => seen.push(c.now), 300);
    c.advance(1000);
    expect(seen).toEqual([1300, 1600, 1900]);
  });

  it('배속 경계(until)에서 끊어 진행해 저속 구간 이벤트를 건너뛰지 않는다', () => {
    const c = new Clock(0);
    // 0~1000: ×100, 1000 이후: ×1
    c.speedFn = now => (now < 1000 ? { speed: 100, until: 1000 } : { speed: 1, until: null });
    c.advance(20); // 실제 20ms → 10ms는 ×100으로 게임 1000ms, 나머지 10ms는 ×1
    expect(c.now).toBe(1010);
  });

  it('halted면 시간이 흐르지 않는다', () => {
    const c = new Clock(0);
    let fired = false;
    c.setTimeout(() => { fired = true; }, 10);
    c.halted = true;
    c.advance(100);
    expect(c.now).toBe(0);
    expect(fired).toBe(false);
  });
});

describe('MiniRedis', () => {
  it('SET NX · EX 만료와 만료 알림', () => {
    const c = new Clock(0), r = new MiniRedis(c), expired: string[] = [];
    r.onExpire('k:', key => expired.push(key));
    expect(r.set('k:1', 'a', { nx: true, ex: 2 })).toBe('OK');
    expect(r.set('k:1', 'b', { nx: true })).toBeNull();
    expect(r.ttl('k:1')).toBe(2);
    c.advance(2000);
    expect(r.get('k:1')).toBeNull(); // lazy expiration
    expect(expired).toEqual(['k:1']);
  });

  it('sweep은 TTL 키만 정리하고, TTL 없이 덮어쓴 키는 건드리지 않는다', () => {
    const c = new Clock(0), r = new MiniRedis(c);
    for (let i = 0; i < 100; i++) r.set('sold:' + i, 'x');
    r.set('lock:1', 'a', { ex: 1 });
    r.set('lock:2', 'a', { ex: 1 });
    r.set('lock:2', 'b'); // 영구 키로 덮어씀
    c.advance(1000);
    expect(r.sweep()).toBe(1);
    expect(r.get('lock:2')).toBe('b');
    expect(r.countPrefix('sold:')).toBe(100);
  });

  it('ZSET은 score, 동점이면 member 순이다', () => {
    const r = new MiniRedis(new Clock(0));
    r.zadd('z', 5, 'b'); r.zadd('z', 1, 'c'); r.zadd('z', 5, 'a');
    expect(r.zadd('z', 0, 'a', { nx: true })).toBe(0); // NX: 기존 순번 유지
    expect(r.zrank('z', 'a')).toBe(1);
    expect(r.zpopmin('z', 2)).toEqual([[1, 'c'], [5, 'a']]);
    expect(r.zcard('z')).toBe(1);
  });
});

describe('QueueService', () => {
  it('군중과 실제 멤버를 도착 시각 순으로 섞어 꺼낸다', () => {
    const c = new Clock(0), r = new MiniRedis(c);
    const q = new QueueService({ redis: r, clock: c, total: 1000, openAt: 0, tau: 1000 });
    c.advance(100);
    const arrivedBefore = q.arrived(100);
    q.enter('me');
    expect(q.rank('me')).toBe(arrivedBefore + 1);
    c.advance(5000);
    // 내 앞 군중보다 적게 꺼내면 나는 아직 남아 있다
    expect(q.popMin(arrivedBefore - 1).members).toEqual([]);
    expect(q.rank('me')).toBe(2);
    const res = q.popMin(2);
    expect(res).toEqual({ crowd: 1, members: ['me'] });
    expect(q.rank('me')).toBeNull();
  });
});

describe('BookingEngine', () => {
  const setup = () => {
    const clock = new Clock(0), redis = new MiniRedis(clock), mq = new MQ(clock), venue = buildVenue();
    const engine = new BookingEngine({ redis, mq, venue, showKey: 't', rng: createRng(1), log: silentLog });
    engine.initStock();
    return { clock, redis, mq, venue, engine };
  };

  it('여러 좌석 중 하나라도 잡혀 있으면 아무것도 잠그지 않는다 (원자성)', () => {
    const { engine } = setup();
    const before = engine.stockTotal();
    expect(engine.lockSeats('p1', ['A-1-1'], 60).ok).toBe(1);
    expect(engine.lockSeats('p2', ['A-1-2', 'A-1-1'], 60)).toEqual({ ok: 0, reason: 'TAKEN', failed: 'A-1-1' });
    expect(engine.isAvailable('A-1-2')).toBe(true);
    expect(engine.stockTotal()).toBe(before - 1);
  });

  it('락이 만료되면 재고가 돌아오고 결제는 LOCK_LOST', () => {
    const { clock, redis, engine } = setup();
    const before = engine.stock().VIP;
    engine.lockSeats('p1', ['A-1-1', 'A-1-2'], 5);
    expect(engine.stock().VIP).toBe(before - 2);
    clock.advance(5000);
    expect(engine.confirm('p1', ['A-1-1', 'A-1-2'])).toEqual({ ok: 0, reason: 'LOCK_LOST' });
    redis.sweep(); // 만료는 lazy + 1초 주기 sweep이라 재고 복구도 그 시점에 끝난다
    expect(engine.stock().VIP).toBe(before);
  });

  it('결제하면 MQ에 발행되고 Worker가 저장한다', () => {
    const { clock, mq, engine } = setup();
    const saved: string[] = [];
    mq.onPersisted(row => saved.push(row.payload.bookingNo));
    mq.startWorker({ every: 250, batch: 8 });
    engine.lockSeats('p1', ['A-1-1'], 60);
    const r = engine.confirm('p1', ['A-1-1']);
    expect(r.ok).toBe(1);
    expect(engine.isSold('A-1-1')).toBe(true);
    clock.advance(250);
    expect(saved).toEqual([r.ok ? r.bookingNo : '']);
  });
});

describe('RateLimiter', () => {
  it('윈도 안에서 max를 넘으면 blockMs 동안 차단', () => {
    const wall = { now: 0 };
    const rl = new RateLimiter(() => wall.now, silentLog);
    const rule = { max: 2, windowMs: 1000, blockMs: 5000 };
    expect(rl.hit('k', rule)).toBeNull();
    expect(rl.hit('k', rule)).toBeNull();
    expect(rl.hit('k', rule)).toEqual({ blocked: true, until: 5000, justBlocked: true });
    wall.now = 4999;
    expect(rl.hit('k', rule)?.justBlocked).toBe(false);
    wall.now = 5000;
    expect(rl.hit('k', rule)).toBeNull();
  });
});
