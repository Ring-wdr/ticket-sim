// 예매창 단계 흐름: 좌석 선택 → 가격/할인 → 배송/예매확인 → 결제 → 완료
import { signal } from '@preact/signals';
import type { PayMethod, Persisted } from '../../shared/model';
import { GRADES, seatOf, type Seat, type SeatId } from '../../shared/venue';
import { dialog } from '../app/dialog';
import { SeatPicker } from './seatPicker';
import type { BookingGame } from './types';

export const STEPS = ['관람일/회차', '좌석 선택', '가격/할인', '배송/예매확인', '결제하기'] as const;
/** 2~5: STEPS의 번호, 6: 완료 */
export type FlowStep = 2 | 3 | 4 | 5 | 6;
export const FEE = 2000;

export class BookingFlow {
  readonly step = signal<FlowStep>(2);
  readonly locked = signal<SeatId[] | null>(null);
  readonly picker = signal<SeatPicker | null>(null);
  readonly captcha = signal(false);
  readonly bookingNo = signal<string | null>(null);
  /** MQ Worker가 DB에 저장하기까지 걸린 시간 (저장 전이면 null) */
  readonly persistLag = signal<number | null>(null);
  readonly paying = signal(false);
  readonly payMethod = signal<PayMethod>('card');
  readonly agreeInfo = signal(false);
  readonly agreeAll = signal(false);
  private timedOut = false;
  private closed = false;
  /** 결제 응답보다 먼저 도착한 저장 완료 알림 (푸시가 응답보다 빠를 수 있다) */
  private readonly early = new Map<string, Persisted>();

  constructor(readonly game: BookingGame) {}

  open({ captcha = true } = {}): void { this.gotoSeat(captcha); }
  close(): void { this.closed = true; }
  get isClosed(): boolean { return this.closed; }

  /** 게임 프레임마다: 제한시간이 지났으면 게임에 알린다 */
  checkTimer(): void {
    const ms = this.game.timeLeft();
    if (ms != null && ms <= 0 && !this.timedOut) {
      this.timedOut = true;
      this.game.onTimeout();
    }
  }

  // ---------- 02 좌석 선택 ----------
  gotoSeat(captcha: boolean): void {
    this.step.value = 2;
    this.locked.value = null;
    const picker = new SeatPicker(this.game, ids => {
      this.locked.value = ids;
      this.timedOut = false;
      this.gotoPrice();
    });
    this.picker.value = picker;
    this.captcha.value = captcha;
    void picker.load(null);
  }

  passCaptcha(): void {
    this.captcha.value = false;
    this.game.log('system', '보안문자 인증 통과');
  }

  failCaptcha(): void { this.game.stats.captchaFails++; }

  onF5(): void {
    if (this.step.value === 2 && !this.captcha.value) void this.picker.value?.refresh();
  }

  seats(): Seat[] { return (this.locked.value ?? []).map(id => seatOf(this.game.venue, id)); }

  amount(): { ticket: number; fee: number; total: number; n: number } {
    const seats = this.seats();
    const ticket = seats.reduce((a, s) => a + GRADES[s.grade].price, 0);
    return { ticket, fee: FEE * seats.length, total: ticket + FEE * seats.length, n: seats.length };
  }

  /** 이전단계로 돌아가면 선택한 좌석은 반환된다 */
  backToSeat(): void {
    const ids = this.locked.value;
    this.locked.value = null;
    if (ids) void this.game.release(ids);
    this.gotoSeat(false);
  }

  // ---------- 03 ~ 05 ----------
  gotoPrice(): void { this.step.value = 3; }

  gotoConfirm(): void {
    this.agreeInfo.value = false;
    this.step.value = 4;
  }

  async gotoPayment(): Promise<void> {
    if (!this.agreeInfo.value) { await dialog.alert('예매자 정보 확인 및 개인정보 제3자 제공에 동의해 주세요.'); return; }
    this.agreeAll.value = false;
    this.payMethod.value = 'card';
    this.step.value = 5;
  }

  async pay(): Promise<void> {
    if (!this.agreeAll.value) { await dialog.alert('취소기한 및 취소수수료 약관에 동의해 주세요.'); return; }
    const ids = this.locked.value;
    if (this.paying.value || !ids) return;
    this.paying.value = true;
    const r = await this.game.pay(ids, this.payMethod.value);
    if (this.closed) return;
    this.paying.value = false;
    if (!r.ok) {
      await dialog.alert('좌석 선점 시간이 만료되어 결제할 수 없습니다.\n좌석을 다시 선택해 주세요.');
      this.game.onLockLost();
      return;
    }
    this.bookingNo.value = r.bookingNo;
    this.step.value = 6;
    const early = this.early.get(r.bookingNo);
    if (early) this.onPersisted(early);
  }

  onPersisted(row: Persisted): void {
    if (row.bookingNo !== this.bookingNo.value) {
      if (this.bookingNo.value == null) this.early.set(row.bookingNo, row);
      return;
    }
    const lag = row.savedAt - row.publishedAt;
    this.persistLag.value = lag;
    this.game.persistLagMs = lag;
  }

  async askClose(): Promise<void> {
    if (this.bookingNo.value) { this.game.finishSuccess(); return; }
    const ok = await dialog.confirm('예매를 취소하고 창을 닫으시겠습니까?\n선택하신 좌석은 반환됩니다.');
    if (!ok || this.closed) return;
    const ids = this.locked.value;
    if (ids) void this.game.release(ids);
    this.locked.value = null;
    this.close();
    this.game.onAbort();
  }
}
