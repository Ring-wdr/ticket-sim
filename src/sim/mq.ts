// 메시지 큐 + 비동기 Worker (md Stage 3-3).
// 예매 성공 응답은 즉시 반환하고, RDB 저장은 Worker가 초당 처리량(TPS) 한도 안에서 천천히 소비한다.
import type { Clock } from './clock';

export interface BookingMessage {
  bookingNo: string;
  owner: string;
  seats: string[];
  method?: string;
}

interface QueuedMessage { topic: string; payload: BookingMessage; at: number }
export interface RdbRow extends QueuedMessage { savedAt: number }

export class MQ {
  readonly q: QueuedMessage[] = [];
  readonly rdb: RdbRow[] = [];
  published = 0;
  consumed = 0;
  maxDepth = 0;
  tps = 0;
  private persistedListeners: ((row: RdbRow) => void)[] = [];

  constructor(private readonly clock: Clock) {}

  publish(topic: string, payload: BookingMessage): void {
    this.q.push({ topic, payload, at: this.clock.now });
    this.published++;
    this.maxDepth = Math.max(this.maxDepth, this.q.length);
  }

  onPersisted(fn: (row: RdbRow) => void): void { this.persistedListeners.push(fn); }

  startWorker({ every = 250, batch = 8 } = {}): void {
    this.tps = Math.round(batch * 1000 / every);
    this.clock.setInterval(() => {
      const n = Math.min(batch, this.q.length);
      for (let i = 0; i < n; i++) {
        const m = this.q.shift()!;
        const row: RdbRow = { ...m, savedAt: this.clock.now };
        this.rdb.push(row);
        this.consumed++;
        for (const fn of this.persistedListeners) fn(row);
      }
    }, every);
  }
}
