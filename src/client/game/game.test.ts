import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LockResult, SeatView } from '../../shared/model';
import { dialogs } from '../app/dialog';
import { Session } from '../app/session';
import { GameClock } from '../net/gameClock';
import { createInProcessLink } from '../net/inProcessLink';
import type { ServerLink } from '../net/link';
import { buildVenue } from '../../shared/venue';
import { BookingFlow } from './bookingFlow';
import { SeatPicker } from './seatPicker';
import type { BookingGame } from './types';

const wall = (): number => Date.now();

let link: ServerLink;
let session: Session;
let navs: string[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  link = createInProcessLink({ wallNow: wall });
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
      stats: { taken: 0, captchaFails: 0, refreshes: 0, blocks: 0 }, persistLagMs: null,
      dateLabel: () => '', fmtTime: () => '', timeLeft: () => null,
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
    expect(game.persistLagMs).toBe(250);
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
