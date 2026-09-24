// 테스트용 SimHost: 이벤트 · 로그를 모으고 실제 시각을 손으로 돌린다
import type { LogEntry, SimEvent } from '../../shared/model';
import type { SimHost } from '../modes/host';

export interface TestHost extends SimHost {
  events: SimEvent[];
  logs: LogEntry[];
  wall: { now: number };
}

export function testHost(): TestHost {
  const wall = { now: 0 };
  const events: SimEvent[] = [];
  const logs: LogEntry[] = [];
  return { events, logs, wall, log: e => logs.push(e), emit: e => events.push(e), wallNow: () => wall.now };
}
