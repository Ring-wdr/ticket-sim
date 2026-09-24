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
  persistLagMs: number | null;
  dateLabel(): string;
  fmtTime(t: number): string;
  /** 예매 제한시간까지 남은 ms. 제한이 없으면 null */
  timeLeft(): number | null;
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
