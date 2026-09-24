// 대기열 서비스 (md Stage 1·2).
// 100만 명을 ZSET 멤버로 하나하나 넣으면 브라우저가 버티지 못하므로
// "군중"은 도착 분포 곡선(통계 모델)으로 표현하고, 플레이어 등 실제 멤버만 ZSET에 넣는다.
// ZPOPMIN 의미는 그대로 지킨다: 군중과 실제 멤버를 도착 시각(score) 순으로 섞어서 꺼낸다.
(function (TS) {
  class QueueService {
    constructor({ redis, clock, total, openAt, tau, key = 'queue:wait' }) {
      Object.assign(this, { redis, clock, total, openAt, tau, key });
      this.popped = 0;        // 앞에서부터 꺼낸 군중 수
      this.admittedTotal = 0;
      this.lastBatch = 0;
    }

    // 오픈 이후 t 시각까지 도착한 군중 수 (지수 포화 곡선)
    arrived(t) {
      if (t < this.openAt) return 0;
      return Math.floor(this.total * (1 - Math.exp(-(t - this.openAt) / this.tau)));
    }

    // ZADD queue:wait NX <arrival> <uuid>
    enter(uuid) {
      const t = this.clock.now;
      this.redis.zadd(this.key, t, uuid, { nx: true });
      return t;
    }

    rank(uuid) {
      const s = this.redis.zscore(this.key, uuid);
      if (s == null) return null;
      const crowdAhead = Math.max(0, this.arrived(s) - this.popped);
      return crowdAhead + this.redis.zrank(this.key, uuid) + 1;
    }

    size() {
      return Math.max(0, this.arrived(this.clock.now) - this.popped) + this.redis.zcard(this.key);
    }
    crowdWaiting() { return Math.max(0, this.arrived(this.clock.now) - this.popped); }

    // ZPOPMIN queue:wait n
    popMin(n) {
      let crowd = 0; const members = []; let guard = 0;
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

  TS.QueueService = QueueService;
})(window.TS);
