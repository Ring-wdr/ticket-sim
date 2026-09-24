// 모드 B: 취켓팅 — 클라이언트 쪽
// 배속 · 잠자기 조작, 커뮤니티 피드 · 핫타임 타임라인, 예매창. 시간 흐름 자체는 서버(CancelServer)가 정한다.
import { computed, signal } from '@preact/signals';
import type {
  Blocked, CancelStatus, ConfirmResult, FeedItem, HotWindow, LockResult, LogLevel, LogSrc, PayMethod,
  Persisted, ReleaseResult, SeatView, SpeedMode,
} from '../../shared/model';
import type { GameInfo } from '../../shared/protocol';
import { DAY, fmt, T } from '../../shared/time';
import { buildVenue, seatOf, type SeatId } from '../../shared/venue';
import { dialog, toast } from '../app/dialog';
import type { CancelResult } from '../app/result';
import { BookingFlow } from './bookingFlow';
import type { BookingGame, GameContext } from './types';

export type CancelInfo = Extract<GameInfo, { mode: 'cancel' }>;
export type CancelPhase = 'product' | 'booking' | 'done';

const LOCK_MS = 300_000;
const SHOW_DAY = T(2026, 10, 11);

export class CancelGame implements BookingGame {
  readonly kind = 'cancel';
  readonly maxSeats = 2;
  readonly seatHint = '💡 취소표는 새로고침(↻ 또는 F5)해야 보입니다. 너무 자주 누르면 접근이 제한됩니다.';
  readonly venue = buildVenue();
  readonly stats = { taken: 0, captchaFails: 0, refreshes: 0, blocks: 0 };

  readonly phase = signal<CancelPhase>('product');
  readonly flow = signal<BookingFlow | null>(null);
  readonly feed = signal<FeedItem[]>([]);
  /** 타임라인에 표시할(공개된) 핫타임 */
  readonly windows = signal<HotWindow[]>([]);
  readonly speedMode = signal<SpeedMode>('norm');
  /** 서버가 tick마다 보내 주는 HUD 상태 */
  readonly status = signal<CancelStatus | null>(null);
  readonly sleeping = computed(() => this.status.value?.sleepUntil != null);
  persistLagMs: number | null = null;

  private alive = true;
  private deadlinePassed = false;
  /** 내가 잡은 좌석과 결제 제한시각 (게임 시각) */
  private lockIds: SeatId[] | null = null;
  private lockUntil = 0;
  private booked: { ids: SeatId[]; bookingNo: string; at: number } | null = null;
  private readonly realStart = performance.now();

  constructor(private readonly ctx: GameContext, readonly info: CancelInfo) {
    this.windows.value = info.windows.filter(w => w.kind !== 'small');
  }

  get label(): string { return this.info.label; }

  dispose(): void {
    this.alive = false;
    this.flow.value?.close();
  }

  frame(): void { this.flow.value?.checkTimer(); }

  log(src: LogSrc, msg: string, level?: LogLevel): void { this.ctx.log(src, msg, level); }

  // ================= 서버 알림 =================
  onStatus(s: CancelStatus): void { this.status.value = s; }

  onFeed(item: FeedItem, reveal: HotWindow | null): void {
    this.feed.value = [...this.feed.value, item];
    if (reveal && reveal.kind !== 'small' && !this.windows.value.some(w => w.from === reveal.from)) {
      this.windows.value = [...this.windows.value, reveal];
    }
  }

  onHot(kind: HotWindow['kind'], label: string): void {
    toast(kind === 'big' ? '⏰ 곧 자정! 시간이 실시간으로 흐릅니다' : `🔥 ${label} · 시간이 느려집니다`, 'hot');
  }

  onWake(): void { toast('☀️ 기상! 09:00입니다'); }

  onDeadline(halted: boolean): void {
    this.deadlinePassed = true;
    if (!halted) return; // 결제 중이면 마무리까지 기다린다
    void dialog.alert('취소마감 시간이 지났습니다.\n더 이상 취소표가 나오지 않습니다.')
      .then(() => { if (this.alive) this.finish(false, 'DEADLINE'); });
  }

  onPersisted(row: Persisted): void { this.flow.value?.onPersisted(row); }

  // ================= 시간 조작 =================
  setSpeed(mode: SpeedMode): void {
    this.speedMode.value = mode;
    void this.ctx.link.call('cancel.speed', { mode });
  }

  async toggleSleep(): Promise<void> {
    if (!this.sleeping.value && this.status.value?.focus) { toast('예매 진행 중에는 잘 수 없어요'); return; }
    await this.ctx.link.call('cancel.sleep', null);
  }

  // ================= 예매창 =================
  openBooking(): void {
    if (this.flow.value || this.phase.value === 'done') return;
    this.phase.value = 'booking';
    const flow = new BookingFlow(this);
    this.flow.value = flow;
    flow.open({ captcha: true });
  }

  seatView(zone: string | null): Promise<SeatView | Blocked> {
    return this.ctx.link.call('cancel.seats', { zone });
  }

  async lock(ids: SeatId[]): Promise<LockResult> {
    const r = await this.ctx.link.call('cancel.lock', { ids });
    if (r.ok && this.alive) {
      this.lockIds = ids;
      this.lockUntil = this.ctx.clock.now() + LOCK_MS;
    }
    return r;
  }

  release(ids: SeatId[]): Promise<ReleaseResult> {
    this.lockIds = null;
    return this.ctx.link.call('cancel.release', { ids });
  }

  async pay(ids: SeatId[], method: PayMethod): Promise<ConfirmResult> {
    const r = await this.ctx.link.call('cancel.pay', { ids, method });
    if (r.ok && this.alive) {
      this.phase.value = 'done';
      this.lockIds = null;
      this.booked = { ids, bookingNo: r.bookingNo, at: this.ctx.clock.now() };
    }
    return r;
  }

  timeLeft(): number | null {
    return this.lockIds && this.phase.value !== 'done' ? this.lockUntil - this.ctx.clock.now() : null;
  }

  /** 선점 시간 만료: 서버는 락 만료 시 좌석을 다른 취켓러에게 넘긴다 */
  onTimeout(): void {
    this.lockIds = null;
    this.flow.value?.gotoSeat(false);
    void dialog.alert('좌석 선점 시간이 만료되었습니다.\n좌석을 다시 선택해 주세요.');
    if (this.deadlinePassed) this.finish(false, 'DEADLINE');
  }

  onLockLost(): void { this.onTimeout(); }

  onAbort(): void {
    this.flow.value = null;
    this.lockIds = null;
    this.phase.value = 'product';
    if (this.deadlinePassed) this.finish(false, 'DEADLINE');
  }

  onF5(): void { this.flow.value?.onF5(); }

  // ================= 결과 =================
  async giveUp(): Promise<void> {
    if (await dialog.confirm('취켓팅을 포기하고 결과를 보시겠습니까?') && this.alive) this.finish(false, 'GIVEUP');
  }

  finishSuccess(): void { this.finish(true, null); }

  private finish(success: boolean, reason: CancelResult['reason']): void {
    const b = success ? this.booked : null;
    this.ctx.finish({
      kind: 'cancel', diff: this.label, diffKey: this.info.diff, success, reason,
      reasonText: reason ? { DEADLINE: '취소마감(관람일 전일 17:00)까지 표를 구하지 못했습니다.', GIVEUP: '취켓팅을 포기했습니다.' }[reason] : null,
      seats: (b?.ids ?? []).map(id => seatOf(this.venue, id)).map(s => ({ grade: s.grade, label: s.label })),
      bookingNo: b?.bookingNo ?? null,
      dateLabel: this.dateLabel(),
      gotAt: b?.at ?? null,
      dday: b ? ddayLabel(b.at) : '',
      releases: this.status.value?.releases ?? 0, botTakes: this.status.value?.botTakes ?? 0,
      refreshes: this.stats.refreshes, blocks: this.stats.blocks, taken: this.stats.taken, captchaFails: this.stats.captchaFails,
      realSec: (performance.now() - this.realStart) / 1000,
    });
  }

  dateLabel(): string { return '2026.10.11(일) 17:00'; }
  fmtTime(t: number): string { return `${fmt.mdd(t)} ${fmt.hmsms(t)}`; }
}

export function ddayLabel(t: number): string {
  const d = new Date(t);
  const day0 = T(2026, d.getUTCMonth() + 1, d.getUTCDate());
  return `D-${Math.round((SHOW_DAY - day0) / DAY)}`;
}
