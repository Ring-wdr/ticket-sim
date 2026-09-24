// 모드 B: 취켓팅 — 서버 쪽 (압축 시간선)
// 10.01(목) 09:00 ~ 10.10(토) 17:00 취소마감까지 약 9일을 게임 시계 배속으로 압축한다.
// 평소에는 고배속, 취소표가 몰리는 "핫타임"은 자동으로 느려지고, 좌석을 잡으면 실시간으로 흐른다.
import type {
  Blocked, CancelStatus, ConfirmResult, DiffKey, HotWindow, InspectSnapshot, LockResult,
  PayMethod, ReleaseResult, SeatView, SpeedMode,
} from '../../shared/model';
import { fmt, HOUR, MIN, T } from '../../shared/time';
import { buildVenue, GRADE_KEYS, seatId, seatOf, type SeatId, type Venue } from '../../shared/venue';
import { BookingEngine, isBot } from '../bookingEngine';
import { Clock, type SpeedInfo } from '../clock';
import type { Log } from '../log';
import { MiniRedis } from '../miniRedis';
import { MQ } from '../mq';
import { RateLimiter } from '../rateLimiter';
import { createRng, type Rng } from '../rng';
import { clockLog, type SimHost } from './host';

export const CANCEL_START = T(2026, 10, 1, 9, 0, 0);
/** 취소마감 (관람일 전일 17:00) */
export const CANCEL_END = T(2026, 10, 10, 17, 0, 0);
const day = (d: number, h = 0, m = 0, s = 0): number => T(2026, 10, d, h, m, s);

/** 게임 하루 = 120초 / 15초 / 3.75초 */
export const SPEEDS: Record<SpeedMode, number> = { slow: 720, norm: 5760, fast: 23040 };
const SLEEP_SPEED = 40000;
const LOCK_TTL = 300;
const SEAT_RATE = { max: 6, windowMs: 4000, blockMs: 10000 };

export interface CancelDiff {
  label: string;
  /** 취소표 생존 시간 배수 (클수록 다른 취켓러가 늦게 가져감) */
  f: number;
  /** 자정 입금마감 물량 [최소, 최대] */
  big: readonly [number, number];
}

export const CANCEL_DIFF: Record<DiffKey, CancelDiff> = {
  easy: { label: '쉬움', f: 1.7, big: [18, 26] },
  normal: { label: '보통', f: 1, big: [12, 18] },
  hard: { label: '어려움', f: 0.55, big: [8, 12] },
};

const NICKS = ['취켓러', '루미나봉', '새벽세시', '티켓요정', '광클장인', '자리요정', '막차탑승', '포도알', '빛나는밤', '애프터글로우', '예대기', '플로어가자'];
const CHATTER = [
  '오늘은 조용하네요… 다들 뭐 하세요',
  '어제 새벽에 3층 하나 떴다가 1초만에 사라짐 ㅋㅋ',
  '취켓팅은 체력전입니다 여러분',
  '매크로 돌리는 사람 신고하고 싶다',
  '혹시 2연석 보신 분?',
  '방금 새로고침 너무 많이 해서 차단당함 ㅠ',
  '양도 글은 사기 조심하세요!!',
  '플로어는 포기하고 1층 노리는 중',
  '이선좌 뜰 때마다 수명 줄어드는 느낌',
  '낮에도 가끔 한두 장씩 풀리긴 해요',
  '다들 성공하시길 🙏',
];

export class CancelServer {
  readonly kind = 'cancel';
  readonly D: CancelDiff;
  readonly rng: Rng;
  /** 네트워크 지연 전용 난수. 요청 · 화면 갱신 타이밍이 게임 세계(봇 · 취소표)의 난수를 흔들지 않게 분리한다 */
  private readonly netRng: Rng;
  readonly clock: Clock;
  readonly redis: MiniRedis;
  readonly mq: MQ;
  readonly venue: Venue;
  readonly engine: BookingEngine;
  /** 플레이어 식별자. 취켓팅은 대기열이 없어 처음부터 하나로 고정 */
  readonly uuid: string;
  readonly stats = { releases: 0, botTakes: 0 };
  readonly windows: HotWindow[] = [];
  /** 커뮤니티 글로 힌트가 공개된 핫타임 */
  readonly revealed = new Set<HotWindow>();
  speedMode: SpeedMode = 'norm';
  sleepUntil: number | null = null;
  deadlinePassed = false;
  booked = false;
  private readonly log: Log;
  private readonly limiter: RateLimiter;
  private boundaries: number[] = [];
  private myLocks: SeatId[] = [];

  constructor(diff: DiffKey, seed: number, private readonly host: SimHost) {
    this.D = CANCEL_DIFF[diff];
    this.rng = createRng(seed);
    this.netRng = createRng(seed ^ 0x5bd1e995);
    this.clock = new Clock(CANCEL_START);
    this.log = clockLog(host, this.clock);
    this.redis = new MiniRedis(this.clock);
    this.mq = new MQ(this.clock);
    this.venue = buildVenue();
    this.engine = new BookingEngine({ redis: this.redis, mq: this.mq, venue: this.venue, showKey: 'concert:lumina:1011', rng: this.rng, log: this.log });
    this.engine.markSoldAll();
    this.limiter = new RateLimiter(host.wallNow, this.log);
    this.uuid = this.rng.uuid();
    this.redis.onExpire('seat:lock:', (key, owner) => {
      if (owner === this.uuid) this.handBackToBots([key.slice('seat:lock:'.length)]);
    });

    this.buildTimeline();
    this.clock.speedFn = now => this.speedAt(now);
    this.clock.setInterval(() => this.redis.sweep(), 1000);
    this.clock.at(CANCEL_END, () => this.onDeadline());
    this.mq.startWorker({ every: 250, batch: 8 });
    this.mq.onPersisted(row => {
      if (!isBot(row.payload.owner)) host.emit({ t: 'persisted', row: { bookingNo: row.payload.bookingNo, publishedAt: row.at, savedAt: row.savedAt } });
    });
    this.log('system', `취켓팅 시작 · 전석 매진 상태 · 취소마감 ${fmt.mdd(CANCEL_END)} ${fmt.hm(CANCEL_END)}`);
  }

  latency(): number {
    const w = this.windowAt(this.clock.now);
    const spike = w && w.kind === 'big' && this.clock.now - (w.from + 10000) < 40000 ? this.netRng.range(150, 500) : 0;
    return 40 + this.netRng.range(0, 80) + spike;
  }

  // ================= 타임라인 생성 =================
  private buildTimeline(): void {
    const { rng, D } = this, f = D.f;
    const W = this.windows;

    // 1) 매일 자정: 무통장 입금기한 마감 → 미입금 표 자동취소
    const bigDays = new Set([2, ...rng.shuffle([3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 3)]);
    for (let d = 2; d <= 10; d++) {
      const t0 = day(d);
      if (bigDays.has(d)) {
        const w: HotWindow = { from: t0 - 10000, to: t0 + 50000, speed: 1, kind: 'big', label: '자정 입금마감 물량' };
        W.push(w);
        const n = rng.int(D.big[0], D.big[1]);
        for (let i = 0; i < n; i++) this.scheduleRelease(t0 + rng.range(300, 25000), 1000 + rng.exp(8000 * f));
        this.post(day(d - 1, 21, rng.int(0, 50)), rng.pick([
          '오늘 자정에 입금기한 끝나는 표 꽤 있대요 👀',
          '자정 취켓 가실 분? 무통장 미입금 물량 좀 될 듯',
          '어제 무통장으로 잡은 사람 많던데 오늘 자정 노려봐요',
        ]), w);
        this.post(t0 + rng.range(8000, 20000), rng.pick(['00시 VIP 잡았어요ㅠㅠㅠ 감사합니다', '와 진짜 3초컷', '또 이선좌… 손이 느린가 봐요', 'R석 겨우 잡음!! 다들 화이팅']));
      } else {
        const w: HotWindow = { from: t0 - MIN, to: t0 + 8 * MIN, speed: 90, kind: 'small', label: '자정' };
        W.push(w);
        this.revealed.add(w);
        const n = rng.int(1, 4);
        for (let i = 0; i < n; i++) this.scheduleRelease(t0 + rng.range(0, 60000), 5000 + rng.exp(150000 * f));
      }
    }

    // 2) 취소수수료 구간이 바뀌기 전날 밤 취소 러시
    const surges: [number, number, string][] = [
      [day(1, 21), day(2, 0), '내일부터 취소수수료 10%라 오늘 밤 취소 좀 나올 듯요'],
      [day(4, 21), day(5, 0), '자정 지나면 수수료 20%로 오름 → 오늘 밤이 기회'],
      [day(8, 21), day(9, 0), '내일부터 수수료 30%… 마지막 고민하는 사람들 취소할 듯'],
      [day(10, 14), CANCEL_END, '오늘 17시 취소마감! 마지막 물량 노려봅시다 🔥'],
    ];
    for (const [from, to, hint] of surges) {
      const w: HotWindow = { from, to, speed: 240, kind: 'surge', label: to === CANCEL_END ? '취소마감 직전' : '수수료 인상 전 취소 러시' };
      W.push(w);
      const n = rng.poisson(5 * (to - from) / HOUR);
      for (let i = 0; i < n; i++) this.scheduleRelease(rng.range(from, to), 20000 + rng.exp(15 * MIN * f));
      this.post(from - rng.range(40, 90) * MIN, hint, w);
    }

    // 3) 평소 랜덤 취소
    for (let t = CANCEL_START; t < CANCEL_END; t += HOUR) {
      const h = new Date(t).getUTCHours();
      const n = rng.poisson(h >= 9 ? 0.4 : 0.05);
      for (let i = 0; i < n; i++) this.scheduleRelease(t + rng.range(0, HOUR), MIN + rng.exp(60 * MIN * f));
    }

    // 커뮤니티 잡담 · 팁
    this.post(CANCEL_START + 3000, '취켓팅 팁) 무통장 입금기한 지난 표는 자정 넘어서 한꺼번에 풀리는 경우가 많아요');
    this.post(CANCEL_START + 9000, '그리고 수수료 오르기 전날 밤에 취소가 몰려요. 달력 체크 필수!');
    for (let t = CANCEL_START + 2 * HOUR; t < CANCEL_END; t += rng.range(2, 5) * HOUR) {
      if (new Date(t).getUTCHours() >= 9) this.post(t, rng.pick(CHATTER));
    }

    W.sort((a, b) => a.from - b.from);
    const b = new Set([CANCEL_END]);
    for (const w of W) { b.add(w.from); b.add(w.to); }
    this.boundaries = [...b].sort((x, y) => x - y);

    // 핫타임 진입 알림
    for (const w of W) {
      if (w.kind === 'small') continue;
      this.clock.at(w.from, () => { if (!this.sleepUntil) this.host.emit({ t: 'hot', kind: w.kind, label: w.label }); });
    }
  }

  private scheduleRelease(at: number, survival: number): void {
    if (at >= CANCEL_END) return;
    this.clock.at(at, () => {
      for (const id of this.pickSoldSeats()) {
        if (!this.engine.freeSold(id)) continue;
        this.stats.releases++;
        this.log('cancel', `취소 발생 → DEL seat:sold:${id} · INCRBY 재고 +1 (${seatOf(this.venue, id).short})`);
        this.clock.setTimeout(() => this.botTake(id), survival * this.rng.range(0.8, 1.2));
      }
    });
  }

  private pickSoldSeats(): SeatId[] {
    for (let i = 0; i < 60; i++) {
      const s = this.rng.pick(this.venue.seats);
      if (this.engine.soldTo(s.id) === this.uuid) continue;
      if (!this.engine.isSold(s.id)) continue;
      const ids = [s.id];
      const nb = seatId(s.zone, s.row, s.col + 1);
      if (this.rng.chance(0.25) && this.venue.byId.has(nb) && this.engine.isSold(nb)) ids.push(nb);
      return ids;
    }
    return [];
  }

  private botTake(id: SeatId): void {
    if (!this.engine.isAvailable(id)) return;
    const botId = 'bot:c' + ++this.stats.botTakes;
    if (this.engine.lockSeats(botId, [id], 120).ok) {
      this.engine.confirm(botId, [id]);
      this.log('bot', `다른 취켓러가 ${seatOf(this.venue, id).short} 선점 → 결제 완료`);
    }
  }

  private post(t: number, text: string, reveal: HotWindow | null = null): void {
    this.clock.at(t, () => {
      if (reveal) this.revealed.add(reveal);
      const user = this.rng.pick(NICKS) + this.rng.int(1, 99);
      this.host.emit({ t: 'feed', item: { t: this.clock.now, user, text, hint: !!reveal }, reveal });
    });
  }

  // ================= 시간 흐름 =================
  windowAt(now: number): HotWindow | null {
    let best: HotWindow | null = null;
    for (const w of this.windows) if (now >= w.from && now < w.to && (!best || w.speed < best.speed)) best = w;
    return best;
  }

  /** 내 좌석 락이 살아 있거나 예매를 마쳤으면(MQ 저장까지) 실시간으로 흐른다 */
  get focus(): boolean {
    return this.booked || this.myLocks.some(id => this.engine.lockOwner(id) === this.uuid);
  }

  private speedAt(now: number): SpeedInfo {
    if (this.focus) return { speed: 1, until: null };
    if (this.sleepUntil) {
      if (now < this.sleepUntil) return { speed: SLEEP_SPEED, until: this.sleepUntil };
      this.sleepUntil = null;
      this.host.emit({ t: 'wake' });
    }
    const base = SPEEDS[this.speedMode];
    const w = this.windowAt(now);
    const speed = w ? Math.min(base, w.speed) : base;
    return { speed, until: this.boundaries.find(b => b > now) ?? null };
  }

  setSpeed(mode: SpeedMode): void { this.speedMode = mode; }

  /** 다음 날 09:00까지 스킵. 자는 중이면 깨운다. 반환값: 자는 중인지 */
  toggleSleep(): boolean {
    if (this.sleepUntil) { this.sleepUntil = null; return false; }
    if (this.focus) return false;
    const d = new Date(this.clock.now);
    let wake = T(2026, d.getUTCMonth() + 1, d.getUTCDate(), 9);
    if (wake <= this.clock.now) wake += 24 * HOUR;
    this.sleepUntil = Math.min(wake, CANCEL_END);
    this.log('system', `💤 잠자기 → ${fmt.mdd(this.sleepUntil)} ${fmt.hm(this.sleepUntil)}까지 스킵`);
    return true;
  }

  private onDeadline(): void {
    this.deadlinePassed = true;
    this.log('system', '취소마감 (관람일 전일 17:00)', 'warn');
    const halted = !this.focus; // 결제 중이면 마무리까지 기다린다
    if (halted) this.clock.halted = true;
    this.host.emit({ t: 'deadline', halted });
  }

  status(): CancelStatus {
    const { speed } = this.clock.speedInfo();
    const lockId = this.myLocks.find(id => this.engine.lockOwner(id) === this.uuid);
    return {
      speed,
      window: this.windowAt(this.clock.now),
      focus: this.focus,
      sleepUntil: this.sleepUntil,
      lockUntil: lockId && !this.booked ? this.clock.now + this.redis.pttl('seat:lock:' + lockId) : null,
    };
  }

  // ================= API =================
  seatView(zone: string | null): SeatView | Blocked {
    return this.limiter.hit('seat:' + this.uuid, SEAT_RATE) ?? this.engine.view(zone);
  }

  lock(ids: SeatId[]): LockResult {
    const r = this.engine.lockSeats(this.uuid, ids, LOCK_TTL);
    if (r.ok) {
      this.myLocks = ids;
      this.sleepUntil = null;
      this.log('system', '🎯 좌석 선점 성공 → 결제 완료까지 시간이 실시간으로 흐릅니다', 'ok');
    }
    return r;
  }

  /** 플레이어가 놓은 좌석(해제 · 만료)은 잠시 뒤 다른 취켓러가 가져간다 */
  release(ids: SeatId[]): ReleaseResult {
    const r = this.engine.release(this.uuid, ids);
    this.handBackToBots(ids);
    return r;
  }

  private handBackToBots(ids: SeatId[]): void {
    this.myLocks = this.myLocks.filter(id => !ids.includes(id));
    for (const id of ids) this.clock.setTimeout(() => this.botTake(id), 2000 + this.rng.exp(20000 * this.D.f));
  }

  pay(ids: SeatId[], method: PayMethod): ConfirmResult {
    const r = this.engine.confirm(this.uuid, ids, { method });
    if (r.ok) { this.booked = true; this.myLocks = []; }
    return r;
  }

  // ================= 서버 들여다보기 =================
  inspect(): InspectSnapshot {
    const r = this.redis, st = this.engine.stock(), e = this.engine.stats;
    const keys: InspectSnapshot['keys'] = [];
    for (const g of GRADE_KEYS) keys.push([this.engine.stockKey(g), 'STRING', fmt.num(st[g]), '취소 시 INCRBY, 선점 시 DECRBY']);
    keys.push(['seat:lock:*', 'STRING NX EX', fmt.num(r.countPrefix('seat:lock:')), '결제 진행 중인 좌석']);
    keys.push(['seat:sold:*', 'STRING', fmt.num(r.countPrefix('seat:sold:')), '판매 완료 좌석']);
    const mine = this.myLocks.find(id => this.engine.lockOwner(id) === this.uuid);
    if (mine) keys.push([`seat:lock:${mine}`, '나', `TTL ${r.ttl('seat:lock:' + mine)}s`, '결제 제한시간']);
    return {
      keys,
      metrics: [
        ['게임 배속', `×${fmt.num(this.clock.speedInfo().speed)}`],
        ['풀린 취소표', fmt.num(this.stats.releases)],
        ['다른 취켓러 선점', fmt.num(this.stats.botTakes)],
        ['Lua 성공 / 실패', `${fmt.num(e.luaOk)} / ${fmt.num(e.luaFail)}`],
        ['MQ 대기 / 발행', `${this.mq.q.length} / ${fmt.num(this.mq.published)}`],
        ['Worker → RDB', `${fmt.num(this.mq.consumed)}건`],
      ],
    };
  }
}
