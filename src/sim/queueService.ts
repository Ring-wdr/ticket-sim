// 대기열 서비스 (md Stage 1·2).
// 100만 명을 ZSET 멤버로 하나하나 넣으면 버티지 못하므로
// "군중"은 도착 분포 곡선(통계 모델)으로 표현하고, 플레이어 등 실제 멤버만 ZSET에 넣는다.
// ZPOPMIN 의미는 그대로 지킨다: 군중과 실제 멤버를 도착 시각(score) 순으로 섞어서 꺼낸다.
import type { Clock } from './clock';
import type { MiniRedis } from './miniRedis';

export interface QueueOptions {
  redis: MiniRedis;
  clock: Clock;
  /** 동시접속 군중 수 */
  total: number;
  openAt: number;
  /** 도착 곡선 시정수(ms). 작을수록 다들 정각에 몰림 */
  tau: number;
  key?: string;
}

export class QueueService {
  /** 앞에서부터 꺼낸 군중 수 */
  popped = 0;
  admittedTotal = 0;
  lastBatch = 0;
  readonly key: string;
  private readonly redis: MiniRedis;
  private readonly clock: Clock;
  private readonly total: number;
  private readonly openAt: number;
  private readonly tau: number;

  constructor(o: QueueOptions) {
    this.redis = o.redis; this.clock = o.clock; this.total = o.total;
    this.openAt = o.openAt; this.tau = o.tau; this.key = o.key ?? 'queue:wait';
  }

  /** 오픈 이후 t 시각까지 도착한 군중 수 (지수 포화 곡선) */
  arrived(t: number): number {
    if (t < this.openAt) return 0;
    return Math.floor(this.total * (1 - Math.exp(-(t - this.openAt) / this.tau)));
  }

  /** ZADD queue:wait NX <arrival> <uuid> */
  enter(uuid: string): number {
    const t = this.clock.now;
    this.redis.zadd(this.key, t, uuid, { nx: true });
    return t;
  }

  rank(uuid: string): number | null {
    const s = this.redis.zscore(this.key, uuid);
    const r = this.redis.zrank(this.key, uuid);
    if (s == null || r == null) return null;
    const crowdAhead = Math.max(0, this.arrived(s) - this.popped);
    return crowdAhead + r + 1;
  }

  crowdWaiting(): number { return Math.max(0, this.arrived(this.clock.now) - this.popped); }
  size(): number { return this.crowdWaiting() + this.redis.zcard(this.key); }

  /** ZPOPMIN queue:wait n */
  popMin(n: number): { crowd: number; members: string[] } {
    let crowd = 0, guard = 0;
    const members: string[] = [];
    while (crowd + members.length < n && guard++ < 10000) {
      const head = this.redis.zpeek(this.key);
      const nowArr = this.arrived(this.clock.now);
      const limit = head ? Math.min(this.arrived(head[0]), nowArr) : nowArr;
      const avail = limit - this.popped;
      if (avail > 0) {
        const take = Math.min(n - crowd - members.length, avail);
        this.popped += take; crowd += take;
        continue;
      }
      if (head) { this.redis.zpopmin(this.key, 1); members.push(head[1]); continue; }
      break;
    }
    this.lastBatch = crowd + members.length;
    this.admittedTotal += this.lastBatch;
    return { crowd, members };
  }
}
