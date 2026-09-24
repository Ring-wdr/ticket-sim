// 예매 엔진 (md Stage 3).
// 좌석 락(seat:lock:{id} SET NX EX) + 등급별 재고 차감(DECRBY)을 하나의 원자 스크립트로 처리한다.
// 락이 실패하면 클라이언트는 그 유명한 "이미 선택된 좌석입니다."를 보게 된다.
import type { ConfirmResult, LockResult, ReleaseResult, SeatView } from '../shared/model';
import { GRADE_KEYS, seatOf, type GradeKey, type SeatId, type Venue } from '../shared/venue';
import type { Log } from './log';
import type { MiniRedis } from './miniRedis';
import type { MQ } from './mq';
import type { Rng } from './rng';

export const isBot = (owner: string): boolean => owner.startsWith('bot:');
const LOCK = 'seat:lock:';
const SOLD = 'seat:sold:';

export interface BookingEngineOptions {
  redis: MiniRedis;
  mq: MQ;
  venue: Venue;
  showKey: string;
  rng: Rng;
  log: Log;
}

export class BookingEngine {
  readonly stats = { luaOk: 0, luaFail: 0, confirms: 0, releases: 0 };
  private bookingSeq = 0;
  private readonly redis: MiniRedis;
  private readonly mq: MQ;
  private readonly venue: Venue;
  private readonly showKey: string;
  private readonly rng: Rng;
  private readonly log: Log;

  constructor(o: BookingEngineOptions) {
    this.redis = o.redis; this.mq = o.mq; this.venue = o.venue;
    this.showKey = o.showKey; this.rng = o.rng; this.log = o.log;
    // 락 TTL 만료 → 재고 반환 (keyspace notification 구독)
    this.redis.onExpire(LOCK, (key, owner) => {
      const seat = this.venue.byId.get(key.slice(LOCK.length));
      if (!seat) return;
      this.redis.incrby(this.stockKey(seat.grade), 1);
      if (!isBot(String(owner))) this.log('redis', `EXPIRED ${key} → INCRBY 재고 +1 (선점 시간 만료)`, 'warn');
    });
  }

  stockKey(g: GradeKey): string { return `stock:${this.showKey}:${g}`; }

  initStock(): void {
    const c: Record<GradeKey, number> = { VIP: 0, R: 0, S: 0 };
    for (const s of this.venue.seats) c[s.grade]++;
    for (const g of GRADE_KEYS) this.redis.set(this.stockKey(g), c[g]);
  }

  markSoldAll(owner = 'rdb:initial'): void {
    for (const s of this.venue.seats) this.redis.set(SOLD + s.id, owner);
    for (const g of GRADE_KEYS) this.redis.set(this.stockKey(g), 0);
  }

  isAvailable(id: SeatId): boolean { return !this.redis.has(LOCK + id) && !this.redis.has(SOLD + id); }
  isSold(id: SeatId): boolean { return this.redis.has(SOLD + id); }
  soldTo(id: SeatId): string | null { const v = this.redis.get(SOLD + id); return v == null ? null : String(v); }
  lockOwner(id: SeatId): string | null { const v = this.redis.get(LOCK + id); return v == null ? null : String(v); }
  lockTtl(id: SeatId): number { return this.redis.ttl(LOCK + id); }
  availableIds(): SeatId[] { return this.venue.seats.filter(s => this.isAvailable(s.id)).map(s => s.id); }

  stock(): Record<GradeKey, number> {
    const o: Record<GradeKey, number> = { VIP: 0, R: 0, S: 0 };
    for (const g of GRADE_KEYS) o[g] = Number(this.redis.get(this.stockKey(g)) ?? 0);
    return o;
  }

  stockTotal(): number { const s = this.stock(); return s.VIP + s.R + s.S; }

  /** 좌석 현황 조회 (클라이언트가 받는 스냅샷) */
  view(zoneId: string | null): SeatView {
    const zoneCounts: Record<string, number> = {};
    const avail: SeatId[] | null = zoneId ? [] : null;
    for (const z of this.venue.zones) zoneCounts[z.id] = 0;
    for (const s of this.venue.seats) {
      if (!this.isAvailable(s.id)) continue;
      zoneCounts[s.zone] = (zoneCounts[s.zone] ?? 0) + 1;
      if (avail && s.zone === zoneId) avail.push(s.id);
    }
    return { at: this.redis.clock.now, stock: this.stock(), zoneCounts, avail, zone: zoneId };
  }

  // ---- lock_seats.lua ----
  lockSeats(owner: string, ids: SeatId[], ttlSec: number): LockResult {
    const r = this.redis.eval('lock_seats.lua', (R): LockResult => {
      for (const id of ids) {
        if (R.exists(LOCK + id) || R.exists(SOLD + id)) return { ok: 0, failed: id, reason: 'TAKEN' };
      }
      const need = new Map<GradeKey, number>();
      for (const id of ids) { const g = seatOf(this.venue, id).grade; need.set(g, (need.get(g) ?? 0) + 1); }
      for (const [g, n] of need) {
        if (Number(R.get(this.stockKey(g)) ?? 0) < n) return { ok: 0, reason: 'SOLD_OUT' };
      }
      for (const id of ids) {
        R.set(LOCK + id, owner, { nx: true, ex: ttlSec });
        R.decrby(this.stockKey(seatOf(this.venue, id).grade), 1);
      }
      return { ok: 1 };
    });
    if (r.ok) this.stats.luaOk++; else this.stats.luaFail++;
    if (!isBot(owner)) {
      const names = ids.map(i => seatOf(this.venue, i).short).join(', ');
      this.log('lua', `EVAL lock_seats.lua [${names}] → return ${r.ok}${r.ok ? ` (SET NX EX ${ttlSec} + DECRBY)` : ` · ${r.reason}`}`, r.ok ? 'ok' : 'warn');
    }
    return r;
  }

  release(owner: string, ids: SeatId[]): ReleaseResult {
    let n = 0;
    for (const id of ids) {
      if (this.redis.get(LOCK + id) === owner) {
        this.redis.del(LOCK + id);
        this.redis.incrby(this.stockKey(seatOf(this.venue, id).grade), 1);
        n++;
      }
    }
    this.stats.releases += n;
    if (!isBot(owner) && n) this.log('redis', `DEL seat:lock × ${n} → INCRBY 재고 +${n} (선점 해제)`);
    return { ok: 1, released: n };
  }

  // ---- confirm_seats.lua + MQ publish ----
  confirm(owner: string, ids: SeatId[], meta: { method?: string } = {}): ConfirmResult {
    const r = this.redis.eval('confirm_seats.lua', (R): { ok: 0 | 1 } => {
      for (const id of ids) if (R.get(LOCK + id) !== owner) return { ok: 0 };
      for (const id of ids) { R.del(LOCK + id); R.set(SOLD + id, owner); }
      return { ok: 1 };
    });
    if (!r.ok) {
      if (!isBot(owner)) this.log('lua', 'EVAL confirm_seats.lua → return 0 · LOCK_LOST', 'warn');
      return { ok: 0, reason: 'LOCK_LOST' };
    }
    const bookingNo = 'T' + (2610000000 + ++this.bookingSeq * 7 + this.rng.int(0, 6));
    this.mq.publish('booking.confirmed', { bookingNo, owner, seats: ids, ...meta });
    this.stats.confirms++;
    if (!isBot(owner)) this.log('mq', `PUBLISH booking.confirmed ${bookingNo} (응답 즉시 반환, DB 저장은 Worker가)`, 'ok');
    return { ok: 1, bookingNo };
  }

  /** 취소 → 판매 좌석 반환 (취켓팅) */
  freeSold(id: SeatId): boolean {
    if (!this.redis.has(SOLD + id)) return false;
    this.redis.del(SOLD + id);
    this.redis.incrby(this.stockKey(seatOf(this.venue, id).grade), 1);
    return true;
  }
}
