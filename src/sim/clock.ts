// 가상 게임 시계.
// 모든 TTL · 폴링 · 스케줄러 · 봇은 실제 시간이 아닌 이 시계 위에서 돈다.
// 실제 시간으로 구동하는 쪽(Worker의 루프, 테스트)이 advance(realMs)를 호출한다. 시계 자신은 타이머를 갖지 않는다.
// speedFn(now) -> { speed, until } 로 구간별 배속을 바꿀 수 있고(취켓팅 압축 시간선),
// until 경계에서 정확히 끊어서 진행하므로 고배속 → 실시간 전환 시 이벤트를 건너뛰지 않는다.

export interface SpeedInfo { speed: number; until: number | null }

export interface Timer {
  readonly id: number;
  at: number;
  readonly every: number | null;
  readonly fn: () => void;
  dead: boolean;
}

export class Clock {
  now: number;
  speed = 1;
  speedFn: ((now: number) => SpeedInfo) | null = null;
  /** true면 advance()가 시간을 흘리지 않는다 (취소마감 후 정지 등) */
  halted = false;
  dead = false;
  onError: (e: unknown) => void = e => { throw e; };
  private timers: Timer[] = [];
  private seq = 0;

  constructor(start = 0) { this.now = start; }

  destroy(): void { this.dead = true; this.timers = []; }

  speedInfo(): SpeedInfo {
    if (this.speedFn) return this.speedFn(this.now);
    return { speed: this.speed, until: null };
  }

  advance(realMs: number): void {
    let real = realMs, guard = 0;
    while (real > 0.0001 && guard++ < 50 && !this.dead && !this.halted) {
      const { speed, until } = this.speedInfo();
      const target = this.now + real * speed;
      if (until != null && until > this.now && target > until) {
        real -= (until - this.now) / speed;
        this.runUntil(until);
      } else {
        this.runUntil(target);
        real = 0;
      }
    }
  }

  /** 게임 시각 t까지 타이머를 순서대로 실행하고 시계를 t로 옮긴다 */
  runUntil(t: number): void {
    while (!this.dead && !this.halted) {
      const tm = this.timers[0];
      if (!tm || tm.at > t) break;
      this.timers.shift();
      if (tm.dead) continue;
      this.now = Math.max(this.now, tm.at);
      if (tm.every != null) { tm.at += tm.every; this.insert(tm); }
      try { tm.fn(); } catch (e) { this.onError(e); }
    }
    if (!this.dead && !this.halted) this.now = Math.max(this.now, t);
  }

  private insert(tm: Timer): void {
    const a = this.timers;
    let lo = 0, hi = a.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      const x = a[m]!;
      if (x.at < tm.at || (x.at === tm.at && x.id < tm.id)) lo = m + 1; else hi = m;
    }
    a.splice(lo, 0, tm);
  }

  setTimeout(fn: () => void, ms: number): Timer {
    const tm: Timer = { id: ++this.seq, at: this.now + Math.max(0, ms), every: null, fn, dead: false };
    this.insert(tm);
    return tm;
  }

  at(t: number, fn: () => void): Timer { return this.setTimeout(fn, t - this.now); }

  setInterval(fn: () => void, ms: number, firstAt?: number): Timer {
    const tm: Timer = { id: ++this.seq, at: firstAt ?? this.now + ms, every: ms, fn, dead: false };
    this.insert(tm);
    return tm;
  }

  clear(tm: Timer | null | undefined): void { if (tm) tm.dead = true; }

  get pending(): number { return this.timers.length; }
}
