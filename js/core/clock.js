// 가상 게임 시계.
// 모든 TTL · 폴링 · 스케줄러 · 봇은 실제 시간이 아닌 이 시계 위에서 돈다.
// speedFn(now) -> { speed, until } 로 구간별 배속을 바꿀 수 있고(취켓팅 압축 시간선),
// until 경계에서 정확히 끊어서 진행하므로 고배속 → 실시간 전환 시 이벤트를 건너뛰지 않는다.
(function (TS) {
  class Clock {
    constructor(start = 0) {
      this.now = start;
      this.timers = [];
      this.seq = 0;
      this.speed = 1;
      this.speedFn = null;
      this.dead = false;
      this._iv = null;
      this._last = 0;
    }

    start() {
      if (this._iv || this.dead) return;
      this._last = performance.now();
      this._iv = setInterval(() => this._loop(), 16);
    }
    stop() { clearInterval(this._iv); this._iv = null; }
    destroy() { this.stop(); this.dead = true; this.timers = []; }

    _loop() {
      const p = performance.now();
      const dt = Math.min(p - this._last, 200); // 탭 비활성화 후 폭주 방지
      this._last = p;
      this.advance(dt);
    }

    speedInfo() {
      if (this.speedFn) return this.speedFn(this.now);
      return { speed: this.speed, until: null };
    }

    advance(realMs) {
      let real = realMs, guard = 0;
      while (real > 0.0001 && guard++ < 50 && !this.dead) {
        const { speed, until } = this.speedInfo();
        const target = this.now + real * speed;
        if (until != null && until > this.now && target > until) {
          real -= (until - this.now) / speed;
          this._runUntil(until);
        } else {
          this._runUntil(target);
          real = 0;
        }
      }
    }

    _runUntil(t) {
      while (this.timers.length && this.timers[0].at <= t && !this.dead) {
        const tm = this.timers.shift();
        if (tm.dead) continue;
        this.now = Math.max(this.now, tm.at);
        if (tm.every) { tm.at += tm.every; this._insert(tm); }
        try { tm.fn(); } catch (e) { console.error(e); }
      }
      if (!this.dead) this.now = Math.max(this.now, t);
    }

    _insert(tm) {
      const a = this.timers;
      let lo = 0, hi = a.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (a[m].at < tm.at || (a[m].at === tm.at && a[m].id < tm.id)) lo = m + 1; else hi = m;
      }
      a.splice(lo, 0, tm);
    }

    setTimeout(fn, ms) {
      const tm = { at: this.now + Math.max(0, ms), fn, id: ++this.seq };
      this._insert(tm);
      return tm;
    }
    at(t, fn) { return this.setTimeout(fn, t - this.now); }
    setInterval(fn, ms, firstAt) {
      const tm = { at: firstAt != null ? firstAt : this.now + ms, every: ms, fn, id: ++this.seq };
      this._insert(tm);
      return tm;
    }
    clear(tm) { if (tm) tm.dead = true; }
  }

  TS.Clock = Clock;
})(window.TS);
