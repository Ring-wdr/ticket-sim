// 메시지 큐 + 비동기 Worker (md Stage 3-3).
// 예매 성공 응답은 즉시 반환하고, RDB 저장은 Worker가 초당 처리량(TPS) 한도 안에서 천천히 소비한다.
(function (TS) {
  class MQ {
    constructor(clock) {
      this.clock = clock;
      this.q = [];
      this.rdb = [];
      this.published = 0;
      this.consumed = 0;
      this.maxDepth = 0;
    }
    publish(topic, payload) {
      this.q.push({ topic, payload, at: this.clock.now });
      this.published++;
      this.maxDepth = Math.max(this.maxDepth, this.q.length);
    }
    startWorker({ every = 250, batch = 8 } = {}) {
      this.tps = Math.round(batch * 1000 / every);
      this._w = this.clock.setInterval(() => {
        const n = Math.min(batch, this.q.length);
        for (let i = 0; i < n; i++) {
          const m = this.q.shift();
          const row = { ...m, savedAt: this.clock.now };
          this.rdb.push(row);
          this.consumed++;
          TS.bus.emit('mq:persisted', row);
        }
      }, every);
    }
  }

  TS.MQ = MQ;
})(window.TS);
