// 인메모리 Redis 흉내.
// md 3장 데이터 명세의 String(EX/NX) · Sorted Set · 원자 스크립트(EVAL)를 구현한다.
// 시뮬레이션은 단일 스레드에서 돌므로 eval(fn) 내부는 Redis Lua 스크립트처럼 중간에 끼어드는 요청이 없다.
import type { Clock } from './clock';

export type RedisValue = string | number;
interface Entry { v: RedisValue; exp: number | null }
interface ZSet { scores: Map<string, number>; arr: [number, string][] }
export interface SetOptions { nx?: boolean; ex?: number; px?: number }
type ExpireListener = (key: string, value: RedisValue) => void;

export class MiniRedis {
  ops = 0;
  scripts = 0;
  private kv = new Map<string, Entry>();
  /** TTL이 걸린 키만 모아 둔 색인 (Redis의 expires dict). sweep이 전체 키를 훑지 않게 한다 */
  private volatile = new Set<string>();
  private zsets = new Map<string, ZSet>();
  private listeners: { prefix: string; fn: ExpireListener }[] = [];

  constructor(readonly clock: Clock) {}

  private now(): number { return this.clock.now; }

  private entry(key: string): Entry | null {
    const e = this.kv.get(key);
    if (!e) return null;
    if (e.exp !== null && e.exp <= this.now()) { // lazy expiration
      this.kv.delete(key);
      this.volatile.delete(key);
      this.notifyExpired(key, e.v);
      return null;
    }
    return e;
  }

  private notifyExpired(key: string, v: RedisValue): void {
    for (const l of this.listeners) if (key.startsWith(l.prefix)) l.fn(key, v);
  }

  /** keyspace notification (__keyevent@0__:expired) 대응 */
  onExpire(prefix: string, fn: ExpireListener): void { this.listeners.push({ prefix, fn }); }

  // ---------- String ----------
  get(k: string): RedisValue | null { this.ops++; return this.entry(k)?.v ?? null; }

  set(k: string, v: RedisValue, opt: SetOptions = {}): 'OK' | null {
    this.ops++;
    if (opt.nx && this.entry(k)) return null;
    const exp = opt.ex != null ? this.now() + opt.ex * 1000 : opt.px != null ? this.now() + opt.px : null;
    this.kv.set(k, { v, exp });
    if (exp === null) this.volatile.delete(k); else this.volatile.add(k);
    return 'OK';
  }

  exists(k: string): 0 | 1 { this.ops++; return this.entry(k) ? 1 : 0; }
  /** 내부 조회용 (ops 카운트 제외) */
  has(k: string): boolean { return !!this.entry(k); }
  del(k: string): 0 | 1 { this.ops++; this.volatile.delete(k); return this.kv.delete(k) ? 1 : 0; }

  expire(k: string, sec: number): 0 | 1 {
    const e = this.entry(k);
    if (!e) return 0;
    e.exp = this.now() + sec * 1000;
    this.volatile.add(k);
    return 1;
  }

  ttl(k: string): number {
    const e = this.entry(k);
    if (!e) return -2;
    if (e.exp === null) return -1;
    return Math.ceil((e.exp - this.now()) / 1000);
  }

  pttl(k: string): number {
    const e = this.entry(k);
    if (!e) return -2;
    if (e.exp === null) return -1;
    return e.exp - this.now();
  }

  incrby(k: string, n: number): number {
    this.ops++;
    const e = this.entry(k);
    const v = (e ? Number(e.v) : 0) + n;
    if (e) e.v = v; else this.kv.set(k, { v, exp: null });
    return v;
  }

  decrby(k: string, n: number): number { return this.incrby(k, -n); }

  countPrefix(p: string): number {
    let c = 0;
    const now = this.now();
    for (const [k, e] of this.kv) if (k.startsWith(p) && (e.exp === null || e.exp > now)) c++;
    return c;
  }

  /** active expire cycle: 만료 키를 능동적으로 정리 */
  sweep(): number {
    const now = this.now();
    let n = 0;
    for (const k of this.volatile) {
      const e = this.kv.get(k);
      if (!e || e.exp === null) { this.volatile.delete(k); continue; }
      if (e.exp <= now) { this.kv.delete(k); this.volatile.delete(k); this.notifyExpired(k, e.v); n++; }
    }
    return n;
  }

  // ---------- Sorted Set ----------
  private z(key: string): ZSet {
    let z = this.zsets.get(key);
    if (!z) { z = { scores: new Map(), arr: [] }; this.zsets.set(key, z); }
    return z;
  }

  private zidx(arr: [number, string][], score: number, member: string): number {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      const [s, mm] = arr[m]!;
      if (s < score || (s === score && mm < member)) lo = m + 1; else hi = m;
    }
    return lo;
  }

  zadd(key: string, score: number, member: string, opt: { nx?: boolean } = {}): 0 | 1 {
    this.ops++;
    const z = this.z(key);
    if (z.scores.has(member)) {
      if (opt.nx) return 0; // NX: 기존 순번 유지 (중복 클릭 방지)
      this.zrem(key, member);
    }
    z.scores.set(member, score);
    z.arr.splice(this.zidx(z.arr, score, member), 0, [score, member]);
    return 1;
  }

  zrem(key: string, member: string): 0 | 1 {
    const z = this.zsets.get(key);
    const score = z?.scores.get(member);
    if (!z || score === undefined) return 0;
    z.arr.splice(this.zidx(z.arr, score, member), 1);
    z.scores.delete(member);
    return 1;
  }

  zscore(key: string, member: string): number | null { return this.zsets.get(key)?.scores.get(member) ?? null; }

  zrank(key: string, member: string): number | null {
    this.ops++;
    const z = this.zsets.get(key);
    const score = z?.scores.get(member);
    if (!z || score === undefined) return null;
    return this.zidx(z.arr, score, member);
  }

  zcard(key: string): number { return this.zsets.get(key)?.arr.length ?? 0; }
  zpeek(key: string): [number, string] | null { return this.zsets.get(key)?.arr[0] ?? null; }

  zpopmin(key: string, n = 1): [number, string][] {
    this.ops++;
    const z = this.zsets.get(key);
    if (!z) return [];
    const out = z.arr.splice(0, n);
    for (const [, m] of out) z.scores.delete(m);
    return out;
  }

  // ---------- Script ----------
  eval<T>(_name: string, fn: (r: this) => T): T {
    this.scripts++;
    this.ops++;
    return fn(this);
  }
}
