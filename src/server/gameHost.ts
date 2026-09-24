// 가상 서버 호스트: 게임 하나를 돌리고 메시지 규약(shared/protocol)으로 UI와 대화한다.
// Worker 진입점과 같은 스레드 연결(테스트 · 디버그)이 똑같이 이 클래스를 쓴다.
//
// - API 요청(net 메서드)은 가짜 네트워크 지연을 거친다: 올라가는 지연 뒤 "서버 도착 시각"에 실행, 내려오는 지연 뒤 응답.
// - 게임이 끝나거나 바뀌면 진행 중이던 요청에는 응답하지 않는다 (끊긴 연결처럼).
// - 게임 시계 · 로그 · 서버 들여다보기 스냅샷을 주기적으로 밀어 준다.
import type { LogEntry } from '../shared/model';
import {
  NET_METHODS, type ClientMsg, type GameInfo, type Method, type NetMethod, type Params,
  type Result, type ServerEvent, type ServerMsg, type StartOptions, type Tick,
} from '../shared/protocol';
import { wallNow as realWallNow } from '../shared/wall';
import { CANCEL_END, CANCEL_START, CancelServer } from '../sim/modes/cancelServer';
import type { SimHost } from '../sim/modes/host';
import { OPEN_AT, OpenServer } from '../sim/modes/openServer';
import { ClockDriver } from './clockDriver';

type Game = OpenServer | CancelServer;

type Handlers<G, P extends string> = {
  [M in Extract<NetMethod, `${P}.${string}`>]: (g: G, p: Params<M>) => Result<M>;
};

const OPEN_API: Handlers<OpenServer, 'open'> = {
  'open.enter': g => g.enterQueue(),
  'open.status': (g, p) => g.queueStatus(p.uuid),
  'open.seats': (g, p) => g.seatView(p.uuid, p.zone),
  'open.lock': (g, p) => g.lock(p.uuid, p.ids),
  'open.release': (g, p) => g.release(p.uuid, p.ids),
  'open.pay': (g, p) => g.pay(p.uuid, p.ids, p.method),
};

const CANCEL_API: Handlers<CancelServer, 'cancel'> = {
  'cancel.seats': (g, p) => g.seatView(p.zone),
  'cancel.lock': (g, p) => g.lock(p.ids),
  'cancel.release': (g, p) => g.release(p.ids),
  'cancel.pay': (g, p) => g.pay(p.ids, p.method),
};

export class HostError extends Error {}

export interface HostOptions {
  wallNow?: () => number;
  /** 시계 동기화 주기 (실제 ms) */
  tickMs?: number;
  inspectMs?: number;
}

export class GameHost {
  private game: Game | null = null;
  private driver: ClockDriver | null = null;
  /** 게임이 바뀔 때마다 증가. 이전 게임의 요청 응답을 버리는 데 쓴다 */
  private gen = 0;
  private paused = false;
  private logBuf: LogEntry[] = [];
  private lastRttMs = 0;
  private lastTickAt = -Infinity;
  private lastInspectAt = -Infinity;
  private watch: { uuid: string | null } | null = null;
  private readonly wallNow: () => number;
  private readonly tickMs: number;
  private readonly inspectMs: number;

  constructor(private readonly post: (m: ServerMsg) => void, opts: HostOptions = {}) {
    this.wallNow = opts.wallNow ?? realWallNow;
    this.tickMs = opts.tickMs ?? 50;
    this.inspectMs = opts.inspectMs ?? 300;
  }

  handle(msg: ClientMsg): void {
    const { id, method, params } = msg;
    if (!NET_METHODS.has(method)) {
      this.reply(id, () => this.control(method, params));
      return;
    }
    const g = this.game;
    if (!g) { this.post({ kind: 'res', id, ok: false, error: 'NO_GAME' }); return; }
    const gen = this.gen;
    const up = g.latency();
    const down = Math.max(15, g.latency() * 0.5);
    setTimeout(() => {
      if (gen !== this.gen) return;
      let res: ServerMsg;
      try {
        res = { kind: 'res', id, ok: true, result: this.api(g, method as NetMethod, params) };
      } catch (e) {
        res = { kind: 'res', id, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      this.lastRttMs = Math.round(up + down);
      this.flushLogs(); // 요청이 남긴 로그는 처리 시점에 바로 보낸다
      setTimeout(() => { if (gen === this.gen) this.post(res); }, down);
    }, up);
  }

  // ---------- API (서버 도착 시각에 실행) ----------
  private api(g: Game, method: NetMethod, params: unknown): unknown {
    if (g instanceof OpenServer && method in OPEN_API) {
      return (OPEN_API[method as keyof typeof OPEN_API] as (g: OpenServer, p: unknown) => unknown)(g, params);
    }
    if (g instanceof CancelServer && method in CANCEL_API) {
      return (CANCEL_API[method as keyof typeof CANCEL_API] as (g: CancelServer, p: unknown) => unknown)(g, params);
    }
    throw new HostError(`WRONG_MODE: ${method}`);
  }

  // ---------- 게임 밖 조작 (즉시) ----------
  private control(method: Method, params: unknown): unknown {
    switch (method) {
      case 'game.start': return this.start(params as StartOptions);
      case 'game.stop': this.stop(); return null;
      case 'game.pause': {
        this.paused = (params as Params<'game.pause'>).paused;
        this.driver?.setPaused(this.paused);
        if (this.game) this.sendTick();
        return null;
      }
      case 'inspect.watch': {
        const p = params as Params<'inspect.watch'>;
        this.watch = p.on ? { uuid: p.uuid } : null;
        if (this.watch) this.sendInspect();
        return null;
      }
      case 'cancel.speed': {
        this.cancelGame().setSpeed((params as Params<'cancel.speed'>).mode);
        this.sendTick();
        return null;
      }
      case 'cancel.sleep': {
        const sleeping = this.cancelGame().toggleSleep();
        this.flushLogs();
        this.sendTick();
        return { sleeping };
      }
      default: throw new HostError(`UNKNOWN_METHOD: ${method}`);
    }
  }

  private cancelGame(): CancelServer {
    if (!(this.game instanceof CancelServer)) throw new HostError('WRONG_MODE');
    return this.game;
  }

  private start(o: StartOptions): GameInfo {
    this.stop();
    const sim: SimHost = {
      log: e => this.logBuf.push(e),
      emit: evt => { this.flushLogs(); this.emit(evt); },
      wallNow: this.wallNow,
    };
    const g: Game = o.mode === 'open' ? new OpenServer(o.diff, o.seed, sim) : new CancelServer(o.diff, o.seed, sim);
    g.clock.onError = e => console.error(e);
    this.game = g;
    this.driver = new ClockDriver(g.clock, () => this.frame());
    this.driver.setPaused(this.paused);
    this.driver.start();
    this.sendTick();
    this.flushLogs();
    return g instanceof OpenServer
      ? { mode: 'open', diff: o.diff, label: g.D.label, now: g.clock.now, openAt: OPEN_AT, activeTtl: g.D.activeTtl }
      : { mode: 'cancel', diff: o.diff, label: g.D.label, now: g.clock.now, start: CANCEL_START, end: CANCEL_END, windows: [...g.revealed] };
  }

  private stop(): void {
    this.gen++;
    this.driver?.stop();
    this.game?.clock.destroy();
    this.driver = null;
    this.game = null;
    this.logBuf = [];
    this.watch = null;
    this.lastRttMs = 0;
  }

  // ---------- 밀어 주기 ----------
  private frame(): void {
    const wall = this.wallNow();
    if (wall - this.lastTickAt >= this.tickMs) this.sendTick();
    this.flushLogs();
    if (this.watch && wall - this.lastInspectAt >= this.inspectMs) this.sendInspect();
  }

  private sendTick(): void {
    const g = this.game;
    if (!g) return;
    const wallAt = this.wallNow();
    this.lastTickAt = wallAt;
    const { speed, until } = g.clock.speedInfo();
    const tick: Tick = {
      t: 'tick', now: g.clock.now, speed, until,
      running: !this.paused && !g.clock.halted && !g.clock.dead,
      wallAt,
      latencyMs: this.lastRttMs || Math.round(g.latency()),
      cancel: g instanceof CancelServer ? g.status() : null,
    };
    this.emit(tick);
  }

  private sendInspect(): void {
    const g = this.game;
    if (!g || !this.watch) return;
    this.lastInspectAt = this.wallNow();
    const snap = g instanceof OpenServer ? g.inspect(this.watch.uuid) : g.inspect();
    snap.metrics.push(['API 응답 지연', `${this.lastRttMs}ms`]);
    this.emit({ t: 'inspect', snap });
  }

  private flushLogs(): void {
    if (!this.logBuf.length) return;
    const entries = this.logBuf;
    this.logBuf = [];
    this.emit({ t: 'logs', entries });
  }

  private emit(evt: ServerEvent): void { this.post({ kind: 'evt', evt }); }

  private reply(id: number, fn: () => unknown): void {
    try {
      this.post({ kind: 'res', id, ok: true, result: fn() });
    } catch (e) {
      this.post({ kind: 'res', id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
}
