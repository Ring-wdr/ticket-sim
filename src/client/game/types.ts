import type { ReadonlySignal } from '@preact/signals';
import type {
  Blocked, ConfirmResult, Expired, LockResult, LogLevel, LogSrc, ModeKind, PayMethod, ReleaseResult, SeatView,
} from '../../shared/model';
import type { SeatId, Venue } from '../../shared/venue';
import type { GameResult } from '../app/result';
import type { GameClock } from '../net/gameClock';
import type { ServerLink } from '../net/link';

/** 게임 컨트롤러가 앱(Session)에게서 받는 것 */
export interface GameContext {
  readonly link: ServerLink;
  readonly clock: GameClock;
  /** 화면 갱신 주기마다 바뀌는 게임 시각 — 남은 시간 같은 파생 상태가 이걸 따라 다시 계산된다 */
  readonly now: ReadonlySignal<number>;
  log(src: LogSrc, msg: string, level?: LogLevel): void;
  finish(r: GameResult): void;
}

export interface PlayerStats { taken: number; captchaFails: number; refreshes: number; blocks: number }

/** 예매창(BookingFlow · SeatPicker)이 게임 모드에게 요구하는 것 */
export interface BookingGame {
  readonly kind: ModeKind;
  readonly maxSeats: number;
  readonly seatHint: string | null;
  readonly venue: Venue;
  readonly stats: PlayerStats;
  /** 예매 제한시간까지 남은 ms. 제한이 없으면 null */
  readonly timeLeft: ReadonlySignal<number | null>;
  dateLabel(): string;
  fmtTime(t: number): string;
  seatView(zone: string | null): Promise<SeatView | Blocked | Expired>;
  lock(ids: SeatId[]): Promise<LockResult | Expired>;
  release(ids: SeatId[]): Promise<ReleaseResult>;
  pay(ids: SeatId[], method: PayMethod): Promise<ConfirmResult>;
  onTimeout(): void;
  onAbort(): void;
  onLockLost(): void;
  finishSuccess(): void;
  log(src: LogSrc, msg: string, level?: LogLevel): void;
}
