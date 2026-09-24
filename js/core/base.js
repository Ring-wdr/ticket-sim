// 전역 네임스페이스 · 이벤트 버스 · 시드 랜덤 · 포맷 유틸
// file:// 로 바로 열 수 있도록 ES module 대신 전역 스크립트로 작성한다.
window.TS = window.TS || {};

(function (TS) {
  const handlers = {};
  TS.bus = {
    on(ev, fn) {
      (handlers[ev] = handlers[ev] || []).push(fn);
      return () => { handlers[ev] = (handlers[ev] || []).filter(f => f !== fn); };
    },
    emit(ev, data) { (handlers[ev] || []).slice().forEach(fn => fn(data)); },
  };

  // src: system | scheduler | redis | lua | mq | api | cancel | bot
  TS.log = function (src, msg, level) {
    const t = TS.game && TS.game.clock ? TS.game.clock.now : 0;
    TS.bus.emit('log', { src, msg, level: level || 'info', t });
  };

  // mulberry32
  TS.RNG = function (seed) {
    let a = seed >>> 0;
    const next = () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const gauss = () => {
      const u = 1 - next(), v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return {
      next,
      range: (lo, hi) => lo + (hi - lo) * next(),
      int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),
      pick: arr => arr[Math.floor(next() * arr.length)],
      chance: p => next() < p,
      exp: mean => -Math.log(1 - next()) * mean,
      poisson(l) {
        if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss()));
        const L = Math.exp(-l); let k = 0, p = 1;
        do { k++; p *= next(); } while (p > L);
        return k - 1;
      },
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
      },
    };
  };

  // 게임 시각은 UTC ms로 저장하고 UTC getter로 포맷한다 (사용자 타임존 영향 제거)
  TS.T = (y, mo, d, h = 0, mi = 0, s = 0, ms = 0) => Date.UTC(y, mo - 1, d, h, mi, s, ms);

  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const p2 = n => String(n).padStart(2, '0');
  TS.fmt = {
    p2,
    hms(t) { const d = new Date(t); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`; },
    hmsms(t) { return TS.fmt.hms(t) + '.' + String(new Date(t).getUTCMilliseconds()).padStart(3, '0'); },
    hm(t) { const d = new Date(t); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; },
    mdd(t) { const d = new Date(t); return `${p2(d.getUTCMonth() + 1)}.${p2(d.getUTCDate())}(${DOW[d.getUTCDay()]})`; },
    date(t) { return new Date(t).getUTCFullYear() + '.' + TS.fmt.mdd(t); },
    num(n) { return Math.round(n).toLocaleString('ko-KR'); },
    won(n) { return TS.fmt.num(n) + '원'; },
    mmss(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${p2(Math.floor(s / 60))}:${p2(s % 60)}`; },
    sec(ms, digits = 3) { return (ms / 1000).toFixed(digits); },
    signedSec(ms) { return (ms >= 0 ? '+' : '−') + (Math.abs(ms) / 1000).toFixed(3) + '초'; },
  };

  TS.uuid = function () {
    if (window.crypto && crypto.randomUUID) { try { return crypto.randomUUID(); } catch (e) { /* insecure context */ } }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  };
})(window.TS);
