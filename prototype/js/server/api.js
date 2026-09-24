// 가짜 HTTP 계층: 요청/응답 지연(부하 비례) + 요청 빈도 제한.
// 서버 로직은 "요청이 서버에 도착한 순간"의 게임 시각에 실행된다.
(function (TS) {
  class Api {
    constructor({ latency }) {
      this.latency = latency;
      this.alive = true;
      this.calls = 0;
      this.lastMs = 0;
      this.hits = new Map();
    }

    call(name, fn) {
      this.calls++;
      const up = this.latency();
      const down = Math.max(15, this.latency() * 0.5);
      return new Promise(resolve => {
        setTimeout(() => {
          if (!this.alive) return;
          const r = fn();
          this.lastMs = Math.round(up + down);
          TS.bus.emit('api', { name, ms: this.lastMs });
          setTimeout(() => { if (this.alive) resolve(r); }, down);
        }, up);
      });
    }

    // 슬라이딩 윈도(실시간 기준). 과도한 새로고침 → 일시 차단
    rateLimit(key, { max, windowMs, blockMs }) {
      const now = performance.now();
      let h = this.hits.get(key);
      if (!h) { h = { ts: [], blockedUntil: 0 }; this.hits.set(key, h); }
      if (now < h.blockedUntil) return { blocked: true, until: h.blockedUntil };
      h.ts = h.ts.filter(x => now - x < windowMs);
      h.ts.push(now);
      if (h.ts.length > max) {
        h.blockedUntil = now + blockMs; h.ts = [];
        TS.log('api', `429 Too Many Requests · ${key} ${blockMs / 1000}초 차단`, 'warn');
        return { blocked: true, until: h.blockedUntil, justBlocked: true };
      }
      return { blocked: false };
    }
  }

  TS.Api = Api;
})(window.TS);
