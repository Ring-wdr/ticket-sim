// 모드 A: 오픈 티켓팅 — 서버 쪽
// 20:00:00 오픈 → 대기열(ZSET) → 스케줄러가 1초마다 batch 입장 → 좌석 선점(Lua) → 결제 → MQ
// 대기창 폴링 · 보안문자 · 결과 집계는 클라이언트 몫이다.
import type {
  Blocked, ConfirmResult, DiffKey, Expired, InspectSnapshot, LockResult, PayMethod,
  QueueEnterResult, QueueStatus, ReleaseResult, SeatView,
} from '../../shared/model';
import { fmt, T } from '../../shared/time';
import { buildVenue, GRADE_KEYS, seatId, seatOf, type SeatId, type Venue } from '../../shared/venue';
import { BookingEngine, isBot } from '../bookingEngine';
import { Clock } from '../clock';
import type { Log } from '../log';
import { MiniRedis } from '../miniRedis';
import { MQ } from '../mq';
import { QueueService } from '../queueService';
import { RateLimiter } from '../rateLimiter';
import { createRng, type Rng } from '../rng';
import { clockLog, type SimHost } from './host';

export const OPEN_AT = T(2026, 10, 1, 20, 0, 0);

export interface OpenDiff {
  label: string;
  /** 동시접속 인원 */
  crowd: number;
  /** 도착 곡선 시정수(ms). 작을수록 다들 정각에 몰림 */
  tau: number;
  /** 초당 입장 인원(서버 TPS) */
  batch: number;
  /** 봇만으로 잔여석이 0이 되는 목표 시간(초). 이후 결제 대기 좌석이 정리되면 전석 매진 */
  sellout: number;
  peakLat: number;
  activeTtl: number;
}

export const OPEN_DIFF: Record<DiffKey, OpenDiff> = {
  easy: { label: '쉬움', crowd: 20000, tau: 2000, batch: 250, sellout: 300, peakLat: 150, activeTtl: 420 },
  normal: { label: '보통', crowd: 150000, tau: 1200, batch: 1250, sellout: 150, peakLat: 300, activeTtl: 300 },
  hard: { label: '어려움', crowd: 1000000, tau: 500, batch: 7000, sellout: 90, peakLat: 500, activeTtl: 240 },
};

const ACTIVE = 'active:user:';
/** 봇 1회 선점 시 평균 좌석 수 (45% 확률로 옆자리까지, 옆자리가 이미 나갔으면 1석) */
const SEATS_PER_TRY = 1.2;
/** 봇이 입장 후 선점을 시도하기까지 (보안문자 · 좌석 고르는 시간) */
const THINK_MS: readonly [number, number] = [4000, 22000];
const SEAT_RATE = { max: 10, windowMs: 5000, blockMs: 8000 };

export class OpenServer {
  readonly kind = 'open';
  readonly D: OpenDiff;
  readonly rng: Rng;
  /** 네트워크 지연 전용 난수. 요청 · 화면 갱신 타이밍이 게임 세계(봇 · 취소표)의 난수를 흔들지 않게 분리한다 */
  private readonly netRng: Rng;
  readonly clock: Clock;
  readonly redis: MiniRedis;
  readonly mq: MQ;
  readonly venue: Venue;
  readonly engine: BookingEngine;
  readonly queue: QueueService;
  readonly bot = { seq: 0, attempts: 0, ok: 0, fail: 0 };
  /** 잔여석이 처음 0이 된 시각 (결제 대기 좌석은 아직 풀릴 수 있다) */
  stockOutAt: number | null = null;
  soldOut = false;
  private readonly log: Log;
  private readonly limiter: RateLimiter;
  /** 입장한 사람들이 활동 중일 때의 초당 봇 좌석 선점 시도 수 */
  private readonly demandRate: number;
  /** [time, count] 최근 입장 기록 (active 추정용) */
  private admits: [number, number][] = [];
  private lastBotOk = 0;
  private lastBotFail = 0;

  constructor(diff: DiffKey, seed: number, private readonly host: SimHost) {
    const D = this.D = OPEN_DIFF[diff];
    const rng = this.rng = createRng(seed);
    this.netRng = createRng(seed ^ 0x5bd1e995);
    this.clock = new Clock(OPEN_AT - Math.round(rng.range(12000, 16000)));
    this.log = clockLog(host, this.clock);
    this.redis = new MiniRedis(this.clock);
    this.mq = new MQ(this.clock);
    this.venue = buildVenue();
    this.engine = new BookingEngine({ redis: this.redis, mq: this.mq, venue: this.venue, showKey: 'concert:lumina', rng, log: this.log });
    this.engine.initStock();
    this.queue = new QueueService({ redis: this.redis, clock: this.clock, total: D.crowd, openAt: OPEN_AT, tau: D.tau });
    this.limiter = new RateLimiter(host.wallNow, this.log);
    const thinkMean = (THINK_MS[0] + THINK_MS[1]) / 2000;
    this.demandRate = this.venue.seats.length / (Math.max(10, D.sellout - thinkMean) * SEATS_PER_TRY);

    this.clock.at(OPEN_AT, () => this.log('system', '⏰ 20:00:00.000 예매 오픈', 'ok'));
    this.clock.setInterval(() => this.schedulerTick(), 1000, OPEN_AT + 1000);
    this.clock.setInterval(() => this.redis.sweep(), 1000);
    this.mq.startWorker({ every: 250, batch: 8 });
    this.mq.onPersisted(row => {
      if (!isBot(row.payload.owner)) host.emit({ t: 'persisted', row: { bookingNo: row.payload.bookingNo, publishedAt: row.at, savedAt: row.savedAt } });
    });
    this.log('system', `게임 시작 · 동시접속 ${fmt.num(D.crowd)}명 · 입장 배치 ${fmt.num(D.batch)}명/초 · 좌석 ${fmt.num(this.venue.seats.length)}석`);
  }

  /** 현재 부하에 따른 편도 응답 지연(ms) */
  latency(): number {
    const t = this.clock.now - OPEN_AT;
    const load = t < -2000 ? 0.08 : Math.exp(-Math.max(0, t) / 45000);
    return 35 + this.netRng.range(0, 50) + this.D.peakLat * load * this.netRng.range(0.2, 0.9);
  }

  // ================= 입장 스케줄러 (md 4.3) =================
  private schedulerTick(): void {
    const D = this.D;
    const res = this.queue.popMin(D.batch);
    for (const m of res.members) {
      this.redis.set(ACTIVE + m, '1', { ex: D.activeTtl });
      this.log('redis', `SET active:user:${m.slice(0, 8)}… 1 EX ${D.activeTtl}`, 'ok');
    }
    const n = res.crowd + res.members.length;
    this.admits.push([this.clock.now, n]);
    while (this.admits.length && this.admits[0]![0] < this.clock.now - D.activeTtl * 1000) this.admits.shift();

    // 예매창 안에 있는 사람들(최근 activeTtl초 입장)이 몇 초 뒤(보안문자·좌석 고르는 시간) 좌석 선점을 시도한다.
    // 군중이 모두 입장한 뒤에도 이들은 매진될 때까지 계속 시도한다 — 결제 포기로 풀린 좌석도 다시 팔린다.
    const active = this.activeEstimate();
    const attempts = Math.floor(this.demandRate * Math.min(1, active / D.batch) + this.rng.next());
    for (let i = 0; i < attempts; i++) this.clock.setTimeout(() => this.botGrab(), this.rng.range(...THINK_MS));

    const okDelta = this.bot.ok - this.lastBotOk, failDelta = this.bot.fail - this.lastBotFail;
    this.lastBotOk = this.bot.ok; this.lastBotFail = this.bot.fail;
    if (n > 0 || okDelta !== 0) {
      this.log('scheduler', `ZPOPMIN queue:wait ${fmt.num(D.batch)} → ${fmt.num(n)}명 입장 · 대기 ${fmt.num(this.queue.size())} · 직전 1초 봇 선점 성공 ${okDelta} / 실패 ${failDelta}`);
    }

    const stock = this.engine.stockTotal();
    if (this.stockOutAt == null && stock === 0) {
      this.stockOutAt = this.clock.now;
      this.log('system', `잔여석 0 · 결제 대기 좌석 ${fmt.num(this.redis.countPrefix('seat:lock:'))}석 (결제 포기 시 다시 풀림)`, 'warn');
    }
    if (!this.soldOut && stock === 0 && this.redis.countPrefix('seat:lock:') === 0) {
      this.soldOut = true;
      this.log('system', '전석 매진', 'warn');
      this.host.emit({ t: 'soldout' });
    }
  }

  /** 예매창 안에 있을 것으로 추정되는 인원 (active:user TTL이 아직 살아 있는 입장자) */
  private activeEstimate(): number { return this.admits.reduce((a, [, n]) => a + n, 0); }

  private botGrab(): void {
    this.bot.attempts++;
    // 잔여석 0이면 좌석도를 훑을 필요가 없다 (매진 후에도 봇은 결제 포기분을 노리고 계속 시도한다)
    if (this.engine.stockTotal() === 0) { this.bot.fail++; return; }
    const avail = this.engine.availableIds();
    if (!avail.length) { this.bot.fail++; return; }
    let sum = 0;
    for (const id of avail) sum += seatOf(this.venue, id).w;
    let r = this.rng.next() * sum, pick = avail[avail.length - 1]!;
    for (const id of avail) { r -= seatOf(this.venue, id).w; if (r <= 0) { pick = id; break; } }
    const ids = [pick];
    const s = seatOf(this.venue, pick);
    if (this.rng.chance(0.45)) {
      const nb = seatId(s.zone, s.row, s.col + 1);
      if (this.venue.byId.has(nb) && this.engine.isAvailable(nb)) ids.push(nb);
    }
    const botId = 'bot:' + ++this.bot.seq;
    const res = this.engine.lockSeats(botId, ids, 150);
    if (!res.ok) { this.bot.fail++; return; }
    this.bot.ok++;
    // 결제까지 걸리는 시간. 일부는 결제를 포기해 좌석이 다시 풀린다.
    this.clock.setTimeout(() => {
      if (this.rng.chance(0.92)) this.engine.confirm(botId, ids);
      else this.engine.release(botId, ids);
    }, this.rng.range(20000, 90000));
  }

  // ================= API (요청이 서버에 도착한 시각에 실행) =================
  enterQueue(): QueueEnterResult {
    if (this.clock.now < OPEN_AT) return { error: 'NOT_OPEN' };
    const uuid = this.rng.uuid();
    const arrivedAt = this.queue.enter(uuid);
    const rank = this.queue.rank(uuid)!;
    this.log('redis', `ZADD queue:wait NX ${arrivedAt} ${uuid.slice(0, 8)}… → ZRANK ${fmt.num(rank - 1)}`);
    return { uuid, arrivedAt, rank };
  }

  /** Adaptive Polling (md 4.1): 대기 예상 시간에 따라 다음 폴링 주기를 내려준다 */
  queueStatus(uuid: string): QueueStatus {
    if (this.redis.has(ACTIVE + uuid)) {
      const soldPct = 1 - this.engine.stockTotal() / this.venue.seats.length;
      return { status: 'ACTIVE', ttl: this.redis.ttl(ACTIVE + uuid), soldPct };
    }
    const rank = this.queue.rank(uuid);
    if (rank == null) return { status: 'GONE' };
    const est = rank / this.D.batch;
    const next = est > 10 ? 5 : est > 3 ? 2 : 1;
    return { status: 'WAITING', rank, behind: Math.max(0, this.queue.size() - rank), est, next_poll_ttl: next };
  }

  seatView(uuid: string, zone: string | null): SeatView | Blocked | Expired {
    const bl = this.limiter.hit('seat:' + uuid, SEAT_RATE);
    if (bl) return bl;
    if (!this.redis.has(ACTIVE + uuid)) return { error: 'EXPIRED' };
    return this.engine.view(zone);
  }

  lock(uuid: string, ids: SeatId[]): LockResult | Expired {
    if (!this.redis.has(ACTIVE + uuid)) return { error: 'EXPIRED' };
    const ttl = Math.max(1, this.redis.ttl(ACTIVE + uuid));
    return this.engine.lockSeats(uuid, ids, ttl);
  }

  release(uuid: string, ids: SeatId[]): ReleaseResult { return this.engine.release(uuid, ids); }

  pay(uuid: string, ids: SeatId[], method: PayMethod): ConfirmResult {
    const r = this.engine.confirm(uuid, ids, { method });
    if (r.ok) {
      this.redis.del(ACTIVE + uuid);
      this.log('redis', `DEL active:user:${uuid.slice(0, 8)}… (다음 대기자에게 자리 양보)`);
    }
    return r;
  }

  // ================= 서버 들여다보기 =================
  inspect(playerUuid: string | null): InspectSnapshot {
    const r = this.redis, st = this.engine.stock(), q = this.queue, D = this.D;
    const activeEst = this.activeEstimate();
    const keys: InspectSnapshot['keys'] = [
      ['queue:wait', 'ZSET', fmt.num(q.size()), `군중 모델 ${fmt.num(q.crowdWaiting())} + 실제 멤버 ${r.zcard('queue:wait')}`],
      ['active:user:*', 'STRING EX', fmt.num(activeEst), `최근 ${D.activeTtl}초 입장 인원 (TTL 만료 전)`],
    ];
    if (playerUuid) {
      const ttl = r.ttl(ACTIVE + playerUuid);
      keys.push([`active:user:${playerUuid.slice(0, 8)}…`, '나', ttl > 0 ? `TTL ${ttl}s` : '(없음)', ttl > 0 ? '예매창 남은 시간' : '아직 대기열']);
    }
    for (const g of GRADE_KEYS) keys.push([this.engine.stockKey(g), 'STRING', fmt.num(st[g]), 'lock_seats.lua로만 차감']);
    keys.push(['seat:lock:*', 'STRING NX EX', fmt.num(r.countPrefix('seat:lock:')), '결제 진행 중인 좌석']);
    keys.push(['seat:sold:*', 'STRING', fmt.num(r.countPrefix('seat:sold:')), '결제 완료 좌석']);
    const e = this.engine.stats;
    return {
      keys,
      metrics: [
        ['스케줄러 배치', `${fmt.num(D.batch)}명/초`],
        ['누적 입장', fmt.num(q.admittedTotal)],
        ['Lua 성공 / 실패', `${fmt.num(e.luaOk)} / ${fmt.num(e.luaFail)}`],
        ['봇 선점 시도', fmt.num(this.bot.attempts)],
        ['MQ 대기 / 발행', `${this.mq.q.length} / ${fmt.num(this.mq.published)}`],
        ['Worker → RDB', `${fmt.num(this.mq.consumed)}건 (${this.mq.tps} TPS)`],
        ['Redis ops', fmt.num(r.ops)],
      ],
    };
  }
}
