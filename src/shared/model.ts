// 서버(Worker)와 UI가 주고받는 값의 타입. 구현은 없다.
import type { GradeKey, SeatId } from './venue';

export type ModeKind = 'open' | 'cancel';
export type DiffKey = 'easy' | 'normal' | 'hard';
export type PayMethod = 'card' | 'bank' | 'easy' | 'phone';

export type LogSrc = 'system' | 'scheduler' | 'redis' | 'lua' | 'mq' | 'api' | 'cancel' | 'bot';
export type LogLevel = 'info' | 'ok' | 'warn';
export interface LogEntry { src: LogSrc; msg: string; level: LogLevel; t: number }

/** 좌석 현황 조회 결과 = 조회 시점의 스냅샷 */
export interface SeatView {
  at: number;
  stock: Record<GradeKey, number>;
  zoneCounts: Record<string, number>;
  /** zone을 지정해 조회했을 때만: 그 구역의 빈 좌석 */
  avail: SeatId[] | null;
  zone: string | null;
}

export type LockResult =
  | { ok: 1 }
  | { ok: 0; reason: 'TAKEN'; failed: SeatId }
  | { ok: 0; reason: 'SOLD_OUT' };

export type ConfirmResult =
  | { ok: 1; bookingNo: string }
  | { ok: 0; reason: 'LOCK_LOST' };

export interface ReleaseResult { ok: 1; released: number }

export interface Blocked { blocked: true; until: number; justBlocked: boolean }
export interface Expired { error: 'EXPIRED' }

export type QueueEnterResult =
  | { error: 'NOT_OPEN' }
  | { uuid: string; arrivedAt: number; rank: number };

export type QueueStatus =
  | { status: 'ACTIVE'; ttl: number }
  | { status: 'GONE' }
  | { status: 'WAITING'; rank: number; behind: number; est: number; next_poll_ttl: number };

export interface InspectSnapshot {
  /** [키, 타입, 값, 설명] */
  keys: [string, string, string, string][];
  /** [이름, 값] */
  metrics: [string, string][];
}

export type HotWindowKind = 'big' | 'small' | 'surge';
export interface HotWindow { from: number; to: number; speed: number; kind: HotWindowKind; label: string }

export interface FeedItem { t: number; user: string; text: string; hint: boolean }

export interface Persisted { bookingNo: string; publishedAt: number; savedAt: number }

/** 서버가 먼저 보내는 알림 (요청에 대한 응답이 아닌 것) */
export type SimEvent =
  | { t: 'soldout' }
  /** 취소마감. halted면 시계가 멈췄다(플레이어가 결제 중이 아니었음) */
  | { t: 'deadline'; halted: boolean }
  | { t: 'hot'; kind: HotWindowKind; label: string }
  | { t: 'wake' }
  | { t: 'feed'; item: FeedItem; reveal: HotWindow | null }
  | { t: 'persisted'; row: Persisted };

export type SpeedMode = 'slow' | 'norm' | 'fast';

/** 취켓팅 HUD 상태 */
export interface CancelStatus {
  speed: number;
  window: HotWindow | null;
  /** 좌석 선점 ~ 예매 완료 동안 실시간으로 흐름 */
  focus: boolean;
  sleepUntil: number | null;
  /** 내 좌석 락 만료 시각 (없으면 null) */
  lockUntil: number | null;
}
