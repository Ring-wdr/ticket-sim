// UI ↔ 가상 서버 메시지 규약. Worker(postMessage)와 같은 스레드 연결이 똑같이 이 형식을 쓴다.
// 모든 값은 structured clone 가능해야 한다 (함수 · 클래스 인스턴스 금지).
import type {
  Blocked, CancelStatus, ConfirmResult, DiffKey, Expired, HotWindow, InspectSnapshot,
  LockResult, LogEntry, PayMethod, QueueEnterResult, QueueStatus, ReleaseResult, SeatView,
  SimEvent, SpeedMode,
} from './model';
import type { SeatId } from './venue';

export interface StartOptions { mode: 'open' | 'cancel'; diff: DiffKey; seed: number }

/** game: 호스트의 게임 번호. 이벤트에도 붙어 와서 이전 게임의 늦은 이벤트를 걸러 낸다 */
export type GameInfo =
  | { mode: 'open'; game: number; diff: DiffKey; label: string; now: number; openAt: number; activeTtl: number; batch: number }
  | {
      mode: 'cancel'; game: number; diff: DiffKey; label: string; now: number; start: number; end: number;
      /** 처음부터 공개된 핫타임 (나머지는 feed 이벤트의 reveal로 알려진다) */
      windows: HotWindow[];
    };

/**
 * 메서드 → [파라미터, 결과].
 * net: true인 메서드는 가짜 네트워크 지연을 거친다 (요청이 서버에 "도착한 시각"에 실행).
 * 나머지(게임 제어 · 배속 · 들여다보기)는 게임 밖 조작이라 즉시 처리한다.
 */
export interface Methods {
  'game.start': { params: StartOptions; result: GameInfo };
  'game.stop': { params: null; result: null };
  /** 탭이 가려지면 게임 시간을 멈춘다 */
  'game.pause': { params: { paused: boolean }; result: null };
  'inspect.watch': { params: { on: boolean; uuid: string | null }; result: null };

  'open.enter': { params: null; result: QueueEnterResult; net: true };
  'open.status': { params: { uuid: string }; result: QueueStatus; net: true };
  'open.seats': { params: { uuid: string; zone: string | null }; result: SeatView | Blocked | Expired; net: true };
  'open.lock': { params: { uuid: string; ids: SeatId[] }; result: LockResult | Expired; net: true };
  'open.release': { params: { uuid: string; ids: SeatId[] }; result: ReleaseResult; net: true };
  'open.pay': { params: { uuid: string; ids: SeatId[]; method: PayMethod }; result: ConfirmResult; net: true };

  'cancel.seats': { params: { zone: string | null }; result: SeatView | Blocked; net: true };
  'cancel.lock': { params: { ids: SeatId[] }; result: LockResult; net: true };
  'cancel.release': { params: { ids: SeatId[] }; result: ReleaseResult; net: true };
  'cancel.pay': { params: { ids: SeatId[]; method: PayMethod }; result: ConfirmResult; net: true };
  'cancel.speed': { params: { mode: SpeedMode }; result: null };
  /** 자는 중이면 깨운다. 결과: 자는 중인지 */
  'cancel.sleep': { params: null; result: { sleeping: boolean } };
}

export type Method = keyof Methods;
export type Params<M extends Method> = Methods[M]['params'];
export type Result<M extends Method> = Methods[M]['result'];
export type NetMethod = { [M in Method]: Methods[M] extends { net: true } ? M : never }[Method];

export const NET_METHODS: ReadonlySet<Method> = new Set<NetMethod>([
  'open.enter', 'open.status', 'open.seats', 'open.lock', 'open.release', 'open.pay',
  'cancel.seats', 'cancel.lock', 'cancel.release', 'cancel.pay',
]);

/** 게임 시계 동기화 (약 20Hz) */
export interface Tick {
  t: 'tick';
  now: number;
  speed: number;
  /** 이 시각에서 배속이 바뀐다 (보간이 넘어가면 안 되는 경계) */
  until: number | null;
  /** 시계가 흐르는 중인지 (일시정지 · 취소마감 정지면 false) */
  running: boolean;
  /** 이 tick을 만든 실제 시각 (epoch ms, performance.timeOrigin + now) */
  wallAt: number;
  /** 마지막 API 왕복 지연(ms). 아직 없으면 현재 부하 기준 추정치 */
  latencyMs: number;
  /** 취켓팅 HUD 상태 */
  cancel: CancelStatus | null;
}

export type ServerEvent =
  | SimEvent
  | Tick
  | { t: 'logs'; entries: LogEntry[] }
  | { t: 'inspect'; snap: InspectSnapshot };

export type ClientMsg = { kind: 'req'; id: number; method: Method; params: unknown };

export type ServerMsg =
  | { kind: 'res'; id: number; ok: true; result: unknown }
  | { kind: 'res'; id: number; ok: false; error: string }
  | { kind: 'evt'; game: number; evt: ServerEvent };
