// 모드 A: 오픈 티켓팅 — 클라이언트 쪽
// 예매하기 → 대기열 등록 → Adaptive Polling + Jitter → 입장 → 예매창(보안문자 · 좌석 · 결제)
import { batch, computed, signal } from '@preact/signals';
import type { Blocked, ConfirmResult, Expired, LockResult, LogLevel, LogSrc, PayMethod, Persisted, ReleaseResult, SeatView } from '../../shared/model';
import type { GameInfo } from '../../shared/protocol';
import { fmt } from '../../shared/time';
import { buildVenue, seatOf, SHOW, type SeatId } from '../../shared/venue';
import { dialog, toast } from '../app/dialog';
import type { OpenResult } from '../app/result';
import type { ClockTimer } from '../net/gameClock';
import { BookingFlow } from './bookingFlow';
import type { BookingGame, GameContext } from './types';

export type OpenInfo = Extract<GameInfo, { mode: 'open' }>;
export type OpenPhase = 'product' | 'queue' | 'booking' | 'done';

export interface QueueView {
  rank: number;
  behind: number;
  /** 예상 대기(초) */
  est: number;
  nextPollTtl: number;
  initialRank: number;
  polling: boolean;
  /** 다음 폴링 게임 시각 (폴링 중이면 null) */
  nextPollAt: number | null;
  jitter: number;
}

export class OpenGame implements BookingGame {
  readonly kind = 'open';
  readonly maxSeats = 2;
  readonly seatHint = null;
  readonly venue = buildVenue();
  readonly stats = { taken: 0, early: 0, captchaFails: 0, refreshes: 0, blocks: 0, requeues: 0 };
  /** 내 PC 시계가 서버보다 빠른(+)/느린(-) 정도 */
  readonly pcOffset = Math.round(Math.random() * 1400 - 700);

  readonly date = signal<string | null>(null);
  /** 예매하기 요청 중 (버튼 "접속 중…") */
  readonly entering = signal(false);
  readonly uuid = signal<string | null>(null);
  readonly queue = signal<QueueView | null>(null);
  readonly flow = signal<BookingFlow | null>(null);
  readonly showServerClock = signal(true);
  /** 상품 페이지에서 F5 → 잠깐 흐려지는 연출 */
  readonly reloading = signal(false);
  private readonly booked = signal<{ ids: SeatId[]; bookingNo: string } | null>(null);
  /** active:user TTL이 끝나는 게임 시각 (입장 전 · 예매창을 닫은 뒤엔 null) */
  private readonly activeUntil = signal<number | null>(null);

  /** 진행 단계는 따로 저장하지 않고 대기창 · 예매창 · 예매 결과에서 끌어낸다 (서로 어긋날 수 없게) */
  readonly phase = computed<OpenPhase>(() =>
    this.booked.value ? 'done' : this.flow.value ? 'booking' : this.queue.value ? 'queue' : 'product');
  readonly timeLeft = computed(() => {
    const until = this.activeUntil.value;
    return until != null && this.phase.value === 'booking' ? until - this.ctx.now.value : null;
  });

  private alive = true;
  private pollTimer: ClockTimer | null = null;
  private firstClick: { clickedAt: number; arrivedAt: number; rank: number } | null = null;
  private queueStart = 0;
  private waitSec: number | null = null;
  private soldPctAtEntry: number | null = null;

  constructor(private readonly ctx: GameContext, readonly info: OpenInfo) {}

  get label(): string { return this.info.label; }
  get openAt(): number { return this.info.openAt; }

  dispose(): void {
    this.alive = false;
    this.ctx.clock.clear(this.pollTimer);
    this.flow.value?.close();
  }

  log(src: LogSrc, msg: string, level?: LogLevel): void { this.ctx.log(src, msg, level); }

  // ================= 상품 페이지 =================
  selectDate(key: string): void { if (this.phase.value === 'product') this.date.value = key; }

  async clickBook(): Promise<void> {
    if (this.phase.value !== 'product' || this.entering.value) return;
    if (!this.date.value) { await dialog.alert('관람일을 선택해 주세요.'); return; }
    await this.enterQueue(false);
  }

  // ================= 대기열 =================
  private async enterQueue(isRequeue: boolean): Promise<void> {
    this.entering.value = true;
    const clickedAt = this.ctx.clock.now();
    const r = await this.ctx.link.call('open.enter', null);
    if (!this.alive) return;
    this.entering.value = false;
    if ('error' in r) {
      this.stats.early++;
      this.log('api', `403 NOT_OPEN · 서버 시각 ${fmt.hmsms(clickedAt)}`, 'warn');
      await dialog.alert('예매 오픈 전입니다.\n오픈 시간 이후에 다시 시도해 주세요.');
      return;
    }
    this.firstClick ??= { clickedAt, arrivedAt: r.arrivedAt, rank: r.rank };
    if (isRequeue) toast('대기순서가 초기화되었습니다.', 'warn');
    this.queueStart = r.arrivedAt;
    batch(() => {
      this.uuid.value = r.uuid;
      this.queue.value = {
        rank: r.rank, behind: 0, est: r.rank / this.info.batch, nextPollTtl: 1, initialRank: r.rank,
        polling: true, nextPollAt: null, jitter: 0,
      };
    });
    void this.poll();
  }

  /** Adaptive Polling + Jitter (md 4.1, 5-1): 서버가 정해 준 주기에 ±0.5초를 섞는다 */
  private async poll(): Promise<void> {
    const uuid = this.uuid.value;
    const q = this.queue.value;
    if (this.phase.value !== 'queue' || !uuid || !q) return;
    this.queue.value = { ...q, polling: true, nextPollAt: null };
    const r = await this.ctx.link.call('open.status', { uuid });
    if (!this.alive || this.uuid.value !== uuid || this.phase.value !== 'queue') return;
    if (r.status === 'ACTIVE') { this.enterBooking(r.ttl, r.soldPct); return; }
    if (r.status === 'GONE') {
      this.leaveQueue();
      await dialog.alert('대기 정보가 만료되었습니다. 다시 시도해 주세요.');
      return;
    }
    const jitter = Math.random() - 0.5;
    const nextPollAt = this.ctx.clock.now() + (r.next_poll_ttl + jitter) * 1000;
    this.queue.value = {
      rank: r.rank, behind: r.behind, est: r.est, nextPollTtl: r.next_poll_ttl,
      initialRank: this.queue.value?.initialRank ?? r.rank, polling: false, nextPollAt, jitter,
    };
    this.pollTimer = this.ctx.clock.at(nextPollAt, () => void this.poll());
  }

  /** 대기창 닫기 → 대기 취소 */
  async cancelQueue(): Promise<void> {
    const ok = await dialog.confirm('대기를 취소하시겠습니까?\n다시 접속하면 대기순서가 초기화됩니다.');
    if (!ok || this.phase.value !== 'queue') return;
    this.leaveQueue();
    this.stats.requeues++;
  }

  private leaveQueue(): void {
    this.ctx.clock.clear(this.pollTimer);
    batch(() => {
      this.uuid.value = null;
      this.queue.value = null;
    });
  }

  private enterBooking(ttl: number, soldPct: number): void {
    const now = this.ctx.clock.now();
    this.soldPctAtEntry ??= soldPct;
    this.waitSec ??= (now - this.queueStart) / 1000;
    this.log('system', `입장 허용 · active:user TTL ${ttl}초`, 'ok');
    const flow = new BookingFlow(this);
    batch(() => {
      this.queue.value = null;
      this.activeUntil.value = now + ttl * 1000;
      this.flow.value = flow;
    });
    flow.open({ captcha: true });
  }

  // ================= 예매창 API =================
  seatView(zone: string | null): Promise<SeatView | Blocked | Expired> {
    return this.ctx.link.call('open.seats', { uuid: this.uuid.value ?? '', zone });
  }

  lock(ids: SeatId[]): Promise<LockResult | Expired> {
    return this.ctx.link.call('open.lock', { uuid: this.uuid.value ?? '', ids });
  }

  release(ids: SeatId[]): Promise<ReleaseResult> {
    return this.ctx.link.call('open.release', { uuid: this.uuid.value ?? '', ids });
  }

  async pay(ids: SeatId[], method: PayMethod): Promise<ConfirmResult> {
    const r = await this.ctx.link.call('open.pay', { uuid: this.uuid.value ?? '', ids, method });
    if (r.ok && this.alive) {
      this.booked.value = { ids, bookingNo: r.bookingNo };
      // 결제 응답을 기다리는 사이 제한시간이 끝나 예매창이 닫혔어도 예매는 성공이다
      if (!this.flow.value) this.finishSuccess();
    }
    return r;
  }

  onTimeout(): void {
    this.log('system', 'active:user TTL 만료 → 예매창 종료', 'warn');
    this.leaveBooking();
    void dialog.alert('예매 가능 시간이 만료되었습니다.\n다시 예매하려면 대기열에 재진입해야 합니다.');
  }

  onLockLost(): void { this.flow.value?.gotoSeat(false); }

  onAbort(): void {
    this.leaveBooking();
    this.stats.requeues++;
    toast('예매창을 닫았습니다. 다시 예매하려면 대기열에 재진입해야 합니다.');
  }

  /** 예매창을 닫고 상품 페이지로 (다시 예매하려면 대기열부터) */
  private leaveBooking(): void {
    this.flow.value?.close();
    batch(() => {
      this.flow.value = null;
      this.activeUntil.value = null;
      this.uuid.value = null;
    });
  }

  // ================= 서버 알림 =================
  onSoldOut(): void {
    if (this.phase.value === 'done') return;
    void dialog.alert('전석 매진되었습니다.').then(() => { if (this.alive) this.finish(false, 'SOLDOUT'); });
  }

  onPersisted(row: Persisted): void { this.flow.value?.onPersisted(row); }

  /** F5: 상품 페이지 → 무해, 대기 중 → 대기순서 초기화(!), 예매창 좌석 단계 → 좌석 새로고침 */
  onF5(): void {
    const phase = this.phase.value;
    if (phase === 'queue') {
      this.stats.requeues++;
      this.log('system', 'F5 새로고침 → 새 UUID로 재진입 (이전 UUID는 대기열에 유령으로 남아 TTL로 회수됨)', 'warn');
      this.leaveQueue();
      void this.enterQueue(true);
    } else if (phase === 'booking') {
      this.flow.value?.onF5();
    } else if (phase === 'product') {
      this.reloading.value = true;
      setTimeout(() => { this.reloading.value = false; }, 180);
    }
  }

  // ================= 결과 =================
  async giveUp(): Promise<void> {
    if (await dialog.confirm('예매를 포기하고 결과를 보시겠습니까?') && this.alive) this.finish(false, 'GIVEUP');
  }

  finishSuccess(): void { this.finish(true, null); }

  private finish(success: boolean, reason: OpenResult['reason']): void {
    const booked = success ? this.booked.value : null;
    const seats = booked ? booked.ids.map(id => seatOf(this.venue, id)) : [];
    const fc = this.firstClick;
    this.ctx.finish({
      kind: 'open', diff: this.label, diffKey: this.info.diff, success, reason,
      reasonText: reason ? { SOLDOUT: '전석 매진되었습니다.', GIVEUP: '예매를 포기했습니다.', TIMEOUT: '예매 가능 시간이 만료되었습니다.' }[reason] : null,
      seats: seats.map(s => ({ grade: s.grade, label: s.label })),
      bookingNo: this.booked.value?.bookingNo ?? null,
      dateLabel: this.dateLabel(),
      reactionMs: fc ? fc.arrivedAt - this.openAt : null,
      clickErrMs: fc ? fc.clickedAt - this.openAt : null,
      rank: fc?.rank ?? null,
      pcOffset: this.pcOffset, early: this.stats.early, waitSec: this.waitSec,
      soldPctAtEntry: this.soldPctAtEntry, taken: this.stats.taken, captchaFails: this.stats.captchaFails,
      requeues: this.stats.requeues, persistLagMs: this.flow.value?.persistLag.value ?? null,
      elapsed: (this.ctx.clock.now() - this.openAt) / 1000,
    });
  }

  dateLabel(): string {
    const d = SHOW.dates.find(x => x.key === (this.date.value ?? '1010')) ?? SHOW.dates[0]!;
    return `${d.label} ${d.time}`;
  }

  fmtTime(t: number): string { return fmt.hmsms(t); }
}
