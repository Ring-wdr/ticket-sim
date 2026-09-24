import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerEvent, Tick } from '../../shared/protocol';
import { SPEEDS } from '../../sim/modes/cancelServer';
import { GameClock } from './gameClock';
import { createInProcessLink } from './inProcessLink';
import { ServerError, type ServerLink } from './link';

// 가짜 타이머 아래에서는 Date.now()가 실제 시각 역할을 한다
const wall = (): number => Date.now();

let link: ServerLink;
let clock: GameClock;
let events: ServerEvent[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  link = createInProcessLink({ wallNow: wall });
  clock = new GameClock(wall);
  events = [];
  link.on(e => {
    events.push(e);
    if (e.t === 'tick') clock.update(e);
  });
});

afterEach(() => {
  link.dispose();
  clock.dispose();
  vi.useRealTimers();
});

/** 네트워크 지연(setTimeout)을 거치는 요청은 가짜 시간을 흘려야 끝난다 */
async function settle<T>(p: Promise<T>): Promise<T> {
  let done = false;
  p.then(() => { done = true; }, () => { done = true; });
  for (let i = 0; i < 1000 && !done; i++) await vi.advanceTimersByTimeAsync(10);
  return p;
}

const lastTick = (): Tick => events.filter((e): e is Tick => e.t === 'tick').at(-1)!;

describe('GameHost + InProcessLink', () => {
  it('시작하면 tick이 오고, 클라이언트 시계는 실제 시간만큼 흐른다 (×1)', async () => {
    const info = await link.call('game.start', { mode: 'open', diff: 'easy', seed: 1 });
    expect(info.mode).toBe('open');
    await vi.advanceTimersByTimeAsync(1000);
    const drift = clock.now() - (info.now + 1000);
    expect(Math.abs(drift)).toBeLessThan(60);
    expect(lastTick().running).toBe(true);
  });

  it('API 요청은 네트워크 지연을 거친다 · 오픈 전이면 NOT_OPEN', async () => {
    await link.call('game.start', { mode: 'open', diff: 'easy', seed: 1 });
    let res: unknown = null;
    const p = link.call('open.enter', null).then(r => { res = r; return r; });
    await vi.advanceTimersByTimeAsync(40); // 최소 왕복 지연(35 + 15ms)보다 짧다
    expect(res).toBeNull();
    expect(await settle(p)).toEqual({ error: 'NOT_OPEN' });
    expect(lastTick().latencyMs).toBeGreaterThanOrEqual(50);
  });

  it('오픈 후 대기열 등록 → 게임 시계 타이머로 폴링 → 입장', async () => {
    const info = await link.call('game.start', { mode: 'open', diff: 'easy', seed: 1 });
    if (info.mode !== 'open') throw new Error();
    await vi.advanceTimersByTimeAsync(info.openAt - info.now + 300);
    const enter = await settle(link.call('open.enter', null));
    if ('error' in enter) throw new Error('expected entry');

    let active = false;
    const poll = async (): Promise<void> => {
      const st = await link.call('open.status', { uuid: enter.uuid });
      if (st.status === 'ACTIVE') { active = true; return; }
      if (st.status === 'WAITING') clock.at(clock.now() + st.next_poll_ttl * 1000, () => void poll());
    };
    void poll();
    for (let i = 0; i < 120 && !active; i++) await vi.advanceTimersByTimeAsync(500);
    expect(active).toBe(true);
  });

  it('일시정지하면 서버 · 클라이언트 시계가 모두 멈추고, 재개해도 건너뛰지 않는다', async () => {
    await link.call('game.start', { mode: 'open', diff: 'easy', seed: 1 });
    await vi.advanceTimersByTimeAsync(500);
    await link.call('game.pause', { paused: true });
    await vi.advanceTimersByTimeAsync(0);
    const frozen = clock.now();
    expect(lastTick().running).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(clock.now()).toBe(frozen);
    await link.call('game.pause', { paused: false });
    await vi.advanceTimersByTimeAsync(1000);
    expect(clock.now() - frozen).toBeLessThan(1100);
    expect(clock.now() - frozen).toBeGreaterThan(900);
  });

  it('게임을 끝내면 진행 중 요청엔 응답하지 않고, 이후 요청은 NO_GAME', async () => {
    await link.call('game.start', { mode: 'open', diff: 'easy', seed: 1 });
    let settled = false;
    link.call('open.enter', null).then(() => { settled = true; }, () => { settled = true; });
    await vi.advanceTimersByTimeAsync(5);
    await link.call('game.stop', null);
    await vi.advanceTimersByTimeAsync(3000);
    expect(settled).toBe(false);
    await expect(link.call('open.enter', null)).rejects.toThrow(new ServerError('NO_GAME'));
  });

  it('다른 모드의 API는 거절한다', async () => {
    await link.call('game.start', { mode: 'open', diff: 'easy', seed: 1 });
    await expect(settle(link.call('cancel.seats', { zone: null }))).rejects.toThrow(/WRONG_MODE/);
  });

  it('로그는 게임 시각이 붙어 묶음으로, 들여다보기는 구독 중에만 온다', async () => {
    await link.call('game.start', { mode: 'open', diff: 'easy', seed: 1 });
    await vi.advanceTimersByTimeAsync(100);
    const logs = events.flatMap(e => (e.t === 'logs' ? e.entries : []));
    expect(logs[0]).toMatchObject({ src: 'system', msg: expect.stringContaining('게임 시작') });
    expect(events.some(e => e.t === 'inspect')).toBe(false);

    await link.call('inspect.watch', { on: true, uuid: null });
    await vi.advanceTimersByTimeAsync(1000);
    const snaps = events.filter(e => e.t === 'inspect');
    expect(snaps.length).toBeGreaterThanOrEqual(3);
    await link.call('inspect.watch', { on: false, uuid: null });
    const n = events.filter(e => e.t === 'inspect').length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(events.filter(e => e.t === 'inspect').length).toBe(n);
  });

  it('취켓팅: 배속 · 잠자기가 tick에 반영된다', async () => {
    await link.call('game.start', { mode: 'cancel', diff: 'normal', seed: 5 });
    await vi.advanceTimersByTimeAsync(100);
    expect(lastTick().cancel).toMatchObject({ focus: false, sleepUntil: null });

    await link.call('cancel.speed', { mode: 'fast' });
    await vi.advanceTimersByTimeAsync(0);
    expect(lastTick().speed).toBe(SPEEDS.fast);

    expect(await link.call('cancel.sleep', null)).toEqual({ sleeping: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(lastTick().speed).toBe(40000);
    expect(lastTick().cancel?.sleepUntil).not.toBeNull();
    expect(await link.call('cancel.sleep', null)).toEqual({ sleeping: false });
  });
});

describe('GameClock', () => {
  const tick = (o: Partial<Tick>): Tick => ({
    t: 'tick', now: 0, speed: 1, until: null, running: true, wallAt: 0, latencyMs: 0, cancel: null, ...o,
  });

  it('배속으로 보간하되 until을 넘지 않고, 뒤로 가지 않는다', () => {
    let w = 0;
    const c = new GameClock(() => w);
    c.update(tick({ now: 1000, speed: 100, until: 50_000, wallAt: 0 }));
    w = 100;
    expect(c.now()).toBe(11_000);
    w = 1000;
    expect(c.now()).toBe(50_000);
    // 서버가 조금 늦게 따라온 tick — 화면 시각은 뒤로 가지 않는다
    c.update(tick({ now: 45_000, speed: 100, until: 50_000, wallAt: 1000 }));
    expect(c.now()).toBe(50_000);
    c.dispose();
  });

  it('게임 시각 타이머는 보간된 시각 기준으로 실행된다', () => {
    let w = 0;
    const c = new GameClock(() => w);
    const fired: number[] = [];
    c.update(tick({ now: 0, speed: 10, wallAt: 0 }));
    c.at(500, () => fired.push(500));
    c.at(100, () => fired.push(100));
    w = 20; // 게임 200ms
    c.update(tick({ now: 200, speed: 10, wallAt: 20 }));
    expect(fired).toEqual([100]);
    w = 60;
    c.update(tick({ now: 600, speed: 10, wallAt: 60 }));
    expect(fired).toEqual([100, 500]);
    c.dispose();
  });
});
