// 브라우저 인메모리 Redis 흉내.
// md 3장 데이터 명세의 String(EX/NX) · Sorted Set · 원자 스크립트(EVAL)를 구현한다.
// JS는 단일 스레드이므로 eval(fn) 내부는 Redis Lua 스크립트처럼 중간에 끼어드는 요청이 없다.
(function (TS) {
  class MiniRedis {
    constructor(clock) {
      this.clock = clock;
      this.kv = new Map();
      this.zsets = new Map();
      this.listeners = [];
      this.ops = 0;
      this.scripts = 0;
    }

    _now() { return this.clock.now; }

    _entry(key) {
      const e = this.kv.get(key);
      if (!e) return null;
      if (e.exp !== null && e.exp <= this._now()) { // lazy expiration
        this.kv.delete(key);
        this._notifyExpired(key, e.v);
        return null;
      }
      return e;
    }
    _notifyExpired(key, v) {
      for (const l of this.listeners) if (key.startsWith(l.prefix)) l.fn(key, v);
    }
    // keyspace notification (__keyevent@0__:expired) 대응
    onExpire(prefix, fn) { this.listeners.push({ prefix, fn }); }

    // ---------- String ----------
    get(k) { this.ops++; const e = this._entry(k); return e ? e.v : null; }
    set(k, v, opt = {}) {
      this.ops++;
      if (opt.nx && this._entry(k)) return null;
      const exp = opt.ex != null ? this._now() + opt.ex * 1000 : (opt.px != null ? this._now() + opt.px : null);
      this.kv.set(k, { v, exp });
      return 'OK';
    }
    exists(k) { this.ops++; return this._entry(k) ? 1 : 0; }
    has(k) { return !!this._entry(k); } // 내부 조회용 (ops 카운트 제외)
    del(k) { this.ops++; return this.kv.delete(k) ? 1 : 0; }
    expire(k, sec) { const e = this._entry(k); if (!e) return 0; e.exp = this._now() + sec * 1000; return 1; }
    ttl(k) {
      const e = this._entry(k);
      if (!e) return -2;
      if (e.exp === null) return -1;
      return Math.ceil((e.exp - this._now()) / 1000);
    }
    pttl(k) {
      const e = this._entry(k);
      if (!e) return -2;
      if (e.exp === null) return -1;
      return e.exp - this._now();
    }
    incrby(k, n) {
      this.ops++;
      const e = this._entry(k);
      const v = (e ? Number(e.v) : 0) + n;
      if (e) e.v = v; else this.kv.set(k, { v, exp: null });
      return v;
    }
    decrby(k, n) { return this.incrby(k, -n); }

    countPrefix(p) {
      let c = 0; const now = this._now();
      for (const [k, e] of this.kv) if (k.startsWith(p) && (e.exp === null || e.exp > now)) c++;
      return c;
    }
    // active expire cycle: 만료 키를 능동적으로 정리
    sweep() {
      const now = this._now(); let n = 0;
      for (const [k, e] of this.kv) {
        if (e.exp !== null && e.exp <= now) { this.kv.delete(k); this._notifyExpired(k, e.v); n++; }
      }
      return n;
    }

    // ---------- Sorted Set ----------
    _z(key) {
      let z = this.zsets.get(key);
      if (!z) { z = { scores: new Map(), arr: [] }; this.zsets.set(key, z); }
      return z;
    }
    _zidx(arr, score, member) {
      let lo = 0, hi = arr.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1; const [s, mm] = arr[m];
        if (s < score || (s === score && mm < member)) lo = m + 1; else hi = m;
      }
      return lo;
    }
    zadd(key, score, member, opt = {}) {
      this.ops++;
      const z = this._z(key);
      if (z.scores.has(member)) {
        if (opt.nx) return 0; // NX: 기존 순번 유지 (중복 클릭 방지)
        this.zrem(key, member);
      }
      z.scores.set(member, score);
      z.arr.splice(this._zidx(z.arr, score, member), 0, [score, member]);
      return 1;
    }
    zrem(key, member) {
      const z = this.zsets.get(key);
      if (!z || !z.scores.has(member)) return 0;
      z.arr.splice(this._zidx(z.arr, z.scores.get(member), member), 1);
      z.scores.delete(member);
      return 1;
    }
    zscore(key, member) { const z = this.zsets.get(key); return z && z.scores.has(member) ? z.scores.get(member) : null; }
    zrank(key, member) {
      this.ops++;
      const z = this.zsets.get(key);
      if (!z || !z.scores.has(member)) return null;
      return this._zidx(z.arr, z.scores.get(member), member);
    }
    zcard(key) { const z = this.zsets.get(key); return z ? z.arr.length : 0; }
    zpeek(key) { const z = this.zsets.get(key); return z && z.arr.length ? z.arr[0] : null; }
    zpopmin(key, n = 1) {
      this.ops++;
      const z = this.zsets.get(key);
      if (!z) return [];
      const out = z.arr.splice(0, n);
      out.forEach(([, m]) => z.scores.delete(m));
      return out;
    }

    // ---------- Script ----------
    eval(name, fn) { this.scripts++; this.ops++; return fn(this); }
  }

  TS.MiniRedis = MiniRedis;
})(window.TS);
