// 슬라이딩 윈도 요청 빈도 제한. 과도한 새로고침 → 일시 차단.
// 플레이어의 손 빠르기를 재는 것이라 게임 시각이 아닌 실제 시각(wallNow)을 쓴다.
import type { Blocked } from '../shared/model';
import type { Log } from './log';

export interface RateRule { max: number; windowMs: number; blockMs: number }

export class RateLimiter {
  private hits = new Map<string, { ts: number[]; blockedUntil: number }>();

  constructor(private readonly wallNow: () => number, private readonly log: Log) {}

  /** 차단 중이면 Blocked(until은 wallNow 기준), 통과면 null */
  hit(key: string, { max, windowMs, blockMs }: RateRule): Blocked | null {
    const now = this.wallNow();
    let h = this.hits.get(key);
    if (!h) { h = { ts: [], blockedUntil: 0 }; this.hits.set(key, h); }
    if (now < h.blockedUntil) return { blocked: true, until: h.blockedUntil, justBlocked: false };
    h.ts = h.ts.filter(x => now - x < windowMs);
    h.ts.push(now);
    if (h.ts.length > max) {
      h.blockedUntil = now + blockMs;
      h.ts = [];
      this.log('api', `429 Too Many Requests · ${key} ${blockMs / 1000}초 차단`, 'warn');
      return { blocked: true, until: h.blockedUntil, justBlocked: true };
    }
    return null;
  }
}
