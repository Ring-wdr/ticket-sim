// 앱 상태: 현재 게임 · 결과 · 로그 · 서버 들여다보기.
// 서버 이벤트를 받아 게임 컨트롤러로 보내고, 이전 게임의 늦은 이벤트는 버린다.
import { batch, effect, signal } from '@preact/signals';
import type { DiffKey, InspectSnapshot, LogEntry, LogLevel, LogSrc, ModeKind } from '../../shared/model';
import type { ServerEvent, Tick } from '../../shared/protocol';
import { wallNow } from '../../shared/wall';
import { CancelGame } from '../game/cancelGame';
import { OpenGame } from '../game/openGame';
import type { GameContext } from '../game/types';
import { GameClock } from '../net/gameClock';
import type { ServerLink } from '../net/link';
import { dialog } from './dialog';
import type { GameResult } from './result';

export type Game = OpenGame | CancelGame;

const MAX_LOGS = 300;
const FRAME_MS = 50;

export class Session implements GameContext {
  readonly game = signal<Game | null>(null);
  readonly lastResult = signal<GameResult | null>(null);
  readonly tick = signal<Tick | null>(null);
  /** 화면 갱신용 게임 시각 (FRAME_MS마다). 남은 시간 · 시계 표시는 모두 이걸 따라 다시 계산된다 */
  readonly now = signal(0);
  /** 같은 주기의 실제 시각 (접근 제한 카운트다운처럼 게임 시간이 멈춰도 흐르는 것) */
  readonly wall = signal(0);
  readonly logs = signal<LogEntry[]>([]);
  readonly inspectorOpen = signal(false);
  readonly inspect = signal<InspectSnapshot | null>(null);
  readonly clock: GameClock;

  /** 이 번호 미만 게임의 이벤트는 버린다 */
  private minGame = 0;
  private maxSeenGame = 0;
  private startSeq = 0;
  private frameIv: ReturnType<typeof setInterval> | null = null;
  private readonly disposers: (() => void)[] = [];

  constructor(readonly link: ServerLink, private readonly nav: (path: string) => void, clock?: GameClock) {
    this.clock = clock ?? new GameClock();
    this.disposers.push(link.on((e, game) => this.onEvent(e, game)));
    // 들여다보기: 열려 있는 동안만 서버가 스냅샷을 보낸다 (오픈 티켓팅은 내 uuid가 바뀌면 다시 구독)
    this.disposers.push(effect(() => {
      const g = this.game.value;
      const on = this.inspectorOpen.value;
      const uuid = g?.kind === 'open' ? g.uuid.value : null;
      if (g) void link.call('inspect.watch', { on, uuid });
    }));
  }

  async start(kind: ModeKind, diff: DiffKey): Promise<void> {
    this.end();
    const token = ++this.startSeq;
    this.minGame = this.maxSeenGame + 1;
    this.logs.value = [];
    this.inspect.value = null;
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const info = await this.link.call('game.start', { mode: kind, diff, seed });
    if (token !== this.startSeq) return;
    this.minGame = info.game;
    const g = info.mode === 'open' ? new OpenGame(this, info) : new CancelGame(this, info);
    this.game.value = g;
    this.frameIv = setInterval(() => this.frame(), FRAME_MS);
    this.frame();
    this.nav('/' + kind);
  }

  /** 게임을 끝낸다 (결과 없이). 진행 중이던 요청 응답은 서버가 버린다 */
  end(): void {
    const g = this.game.value;
    if (!g) return;
    g.dispose();
    this.game.value = null;
    if (this.frameIv != null) clearInterval(this.frameIv);
    this.frameIv = null;
    this.clock.reset();
    this.tick.value = null;
    dialog.clear();
    void this.link.call('game.stop', null);
  }

  finish(r: GameResult): void {
    this.lastResult.value = r;
    this.end();
    this.nav('/result');
  }

  setPaused(paused: boolean): void {
    if (this.game.value) void this.link.call('game.pause', { paused });
  }

  log(src: LogSrc, msg: string, level: LogLevel = 'info'): void {
    this.pushLogs([{ src, msg, level, t: this.clock.now() }]);
  }

  dispose(): void {
    this.end();
    for (const d of this.disposers) d();
    this.clock.dispose();
  }

  private frame(): void {
    batch(() => {
      this.now.value = this.clock.now();
      this.wall.value = wallNow();
    });
  }

  private pushLogs(entries: LogEntry[]): void {
    const logs = [...this.logs.value, ...entries];
    this.logs.value = logs.length > MAX_LOGS ? logs.slice(-MAX_LOGS + 100) : logs;
  }

  private onEvent(e: ServerEvent, game: number): void {
    this.maxSeenGame = Math.max(this.maxSeenGame, game);
    if (game < this.minGame) return;
    if (e.t === 'tick') {
      this.clock.update(e);
      this.tick.value = e;
      const g = this.game.value;
      if (g?.kind === 'cancel' && e.cancel) g.onStatus(e.cancel);
      return;
    }
    if (e.t === 'logs') { this.pushLogs(e.entries); return; }
    if (e.t === 'inspect') { this.inspect.value = e.snap; return; }
    const g = this.game.value;
    if (!g) return;
    switch (e.t) {
      case 'persisted': g.onPersisted(e.row); break;
      case 'soldout': if (g.kind === 'open') g.onSoldOut(); break;
      case 'deadline': if (g.kind === 'cancel') g.onDeadline(e.halted); break;
      case 'hot': if (g.kind === 'cancel') g.onHot(e.kind, e.label); break;
      case 'wake': if (g.kind === 'cancel') g.onWake(); break;
      case 'feed': if (g.kind === 'cancel') g.onFeed(e.item, e.reveal); break;
    }
  }
}
