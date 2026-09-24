// 클라이언트 쪽 게임 시계 사본.
// 서버가 약 20Hz로 보내는 tick 사이를 실제 시간 × 배속으로 보간하고, 배속이 바뀌는 경계(until)는 넘지 않는다.
// 클라이언트 로직(대기열 폴링 등)도 이 시계 위의 타이머로 돈다.
import type { Tick } from '../../shared/protocol';
import { wallNow as realWallNow } from '../../shared/wall';

export interface ClockTimer { readonly at: number; readonly fn: () => void; dead: boolean }

export class GameClock {
  private base: Tick | null = null;
  /** 보간값이 새 tick보다 앞서 있었어도 시간이 거꾸로 가 보이지 않게 */
  private shown = -Infinity;
  private timers: ClockTimer[] = [];
  private iv: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly wallNow: () => number = realWallNow, private readonly pumpMs = 25) {}

  get tick(): Tick | null { return this.base; }
  get speed(): number { return this.base?.running ? this.base.speed : 0; }

  update(t: Tick): void {
    this.base = t;
    this.pump();
  }

  now(): number {
    const b = this.base;
    if (!b) return 0;
    let t = b.now;
    if (b.running) {
      t += Math.max(0, this.wallNow() - b.wallAt) * b.speed;
      if (b.until != null) t = Math.min(t, b.until);
    }
    this.shown = Math.max(this.shown, t);
    return this.shown;
  }

  at(t: number, fn: () => void): ClockTimer {
    const tm: ClockTimer = { at: t, fn, dead: false };
    this.timers.push(tm);
    this.timers.sort((a, b) => a.at - b.at);
    this.ensurePump();
    return tm;
  }

  clear(tm: ClockTimer | null | undefined): void { if (tm) tm.dead = true; }

  /** 새 게임을 시작할 때 */
  reset(): void {
    this.base = null;
    this.shown = -Infinity;
    this.timers = [];
  }

  dispose(): void {
    this.reset();
    if (this.iv != null) clearInterval(this.iv);
    this.iv = null;
  }

  private ensurePump(): void {
    if (this.iv == null) this.iv = setInterval(() => this.pump(), this.pumpMs);
  }

  private pump(): void {
    if (!this.base) return;
    const now = this.now();
    while (this.timers.length && this.timers[0]!.at <= now) {
      const tm = this.timers.shift()!;
      if (!tm.dead) tm.fn();
    }
  }
}
