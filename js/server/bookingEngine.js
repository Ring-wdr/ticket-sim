// 예매 엔진 (md Stage 3).
// 좌석 락(seat:lock:{id} SET NX EX) + 등급별 재고 차감(DECRBY)을 하나의 원자 스크립트로 처리한다.
// 락이 실패하면 클라이언트는 그 유명한 "이미 선택된 좌석입니다."를 보게 된다.
(function (TS) {
  const isBot = owner => String(owner).startsWith('bot:');

  class BookingEngine {
    constructor({ redis, mq, venue, showKey }) {
      this.redis = redis; this.mq = mq; this.venue = venue; this.showKey = showKey;
      this.stats = { luaOk: 0, luaFail: 0, confirms: 0, releases: 0 };
      this.bookingSeq = 0;
      // 락 TTL 만료 → 재고 반환 (keyspace notification 구독)
      redis.onExpire('seat:lock:', (key, owner) => {
        const seat = venue.byId[key.slice('seat:lock:'.length)];
        if (!seat) return;
        redis.incrby(this.stockKey(seat.grade), 1);
        if (!isBot(owner)) TS.log('redis', `EXPIRED ${key} → INCRBY 재고 +1 (선점 시간 만료)`, 'warn');
      });
    }

    stockKey(g) { return `stock:${this.showKey}:${g}`; }

    initStock() {
      const c = {};
      for (const s of this.venue.seats) c[s.grade] = (c[s.grade] || 0) + 1;
      for (const g in c) this.redis.set(this.stockKey(g), c[g]);
    }

    markSoldAll(owner = 'rdb:initial') {
      for (const s of this.venue.seats) this.redis.set('seat:sold:' + s.id, owner);
      for (const g in TS.GRADES) this.redis.set(this.stockKey(g), 0);
    }

    isAvailable(id) { return !this.redis.has('seat:lock:' + id) && !this.redis.has('seat:sold:' + id); }
    availableIds() { return this.venue.seats.filter(s => this.isAvailable(s.id)).map(s => s.id); }
    stock() {
      const o = {};
      for (const g in TS.GRADES) o[g] = Number(this.redis.get(this.stockKey(g)) || 0);
      return o;
    }
    stockTotal() { const s = this.stock(); return Object.values(s).reduce((a, b) => a + b, 0); }

    // 좌석 현황 조회 (클라이언트가 받는 스냅샷)
    view(zoneId) {
      const zoneCounts = {}; const avail = zoneId ? new Set() : null;
      for (const z of this.venue.zones) zoneCounts[z.id] = 0;
      for (const s of this.venue.seats) {
        if (!this.isAvailable(s.id)) continue;
        zoneCounts[s.zone]++;
        if (avail && s.zone === zoneId) avail.add(s.id);
      }
      return { at: this.redis.clock.now, stock: this.stock(), zoneCounts, avail, zone: zoneId || null };
    }

    // ---- lock_seats.lua ----
    lockSeats(owner, ids, ttlSec) {
      const r = this.redis.eval('lock_seats.lua', R => {
        for (const id of ids) {
          if (R.exists('seat:lock:' + id) || R.exists('seat:sold:' + id)) return { ok: 0, failed: id, reason: 'TAKEN' };
        }
        const need = {};
        ids.forEach(id => { const g = this.venue.byId[id].grade; need[g] = (need[g] || 0) + 1; });
        for (const g in need) {
          if (Number(R.get(this.stockKey(g)) || 0) < need[g]) return { ok: 0, reason: 'SOLD_OUT' };
        }
        for (const id of ids) {
          R.set('seat:lock:' + id, owner, { nx: true, ex: ttlSec });
          R.decrby(this.stockKey(this.venue.byId[id].grade), 1);
        }
        return { ok: 1 };
      });
      if (r.ok) this.stats.luaOk++; else this.stats.luaFail++;
      if (!isBot(owner)) {
        const names = ids.map(i => this.venue.byId[i].short).join(', ');
        TS.log('lua', `EVAL lock_seats.lua [${names}] → return ${r.ok}${r.ok ? ` (SET NX EX ${ttlSec} + DECRBY)` : ` · ${r.reason}`}`, r.ok ? 'ok' : 'warn');
      }
      return r;
    }

    release(owner, ids) {
      let n = 0;
      for (const id of ids) {
        if (this.redis.get('seat:lock:' + id) === owner) {
          this.redis.del('seat:lock:' + id);
          this.redis.incrby(this.stockKey(this.venue.byId[id].grade), 1);
          n++;
        }
      }
      this.stats.releases += n;
      if (!isBot(owner) && n) TS.log('redis', `DEL seat:lock × ${n} → INCRBY 재고 +${n} (선점 해제)`);
      return { ok: 1, released: n };
    }

    // ---- confirm_seats.lua + MQ publish ----
    confirm(owner, ids, meta = {}) {
      const r = this.redis.eval('confirm_seats.lua', R => {
        for (const id of ids) if (R.get('seat:lock:' + id) !== owner) return { ok: 0, reason: 'LOCK_LOST' };
        for (const id of ids) { R.del('seat:lock:' + id); R.set('seat:sold:' + id, owner); }
        return { ok: 1 };
      });
      if (!r.ok) {
        if (!isBot(owner)) TS.log('lua', `EVAL confirm_seats.lua → return 0 · ${r.reason}`, 'warn');
        return r;
      }
      const bookingNo = 'T' + (2610000000 + (++this.bookingSeq) * 7 + Math.floor(Math.random() * 7));
      this.mq.publish('booking.confirmed', { bookingNo, owner, seats: ids, ...meta });
      this.stats.confirms++;
      if (!isBot(owner)) TS.log('mq', `PUBLISH booking.confirmed ${bookingNo} (응답 즉시 반환, DB 저장은 Worker가)`, 'ok');
      return { ok: 1, bookingNo };
    }

    // 취소 → 판매 좌석 반환 (취켓팅)
    freeSold(id) {
      if (!this.redis.has('seat:sold:' + id)) return false;
      this.redis.del('seat:sold:' + id);
      this.redis.incrby(this.stockKey(this.venue.byId[id].grade), 1);
      return true;
    }
  }

  TS.BookingEngine = BookingEngine;
})(window.TS);
