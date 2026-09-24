// 게임 시각은 UTC ms로 저장하고 UTC getter로 포맷한다 (사용자 타임존 영향 제거)
export const T = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0): number =>
  Date.UTC(y, mo - 1, d, h, mi, s, ms);

export const SEC = 1000;
export const MIN = 60 * SEC;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export const p2 = (n: number): string => String(n).padStart(2, '0');

export const fmt = {
  hms(t: number): string {
    const d = new Date(t);
    return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
  },
  hmsms(t: number): string {
    return fmt.hms(t) + '.' + String(new Date(t).getUTCMilliseconds()).padStart(3, '0');
  },
  hm(t: number): string {
    const d = new Date(t);
    return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  },
  mdd(t: number): string {
    const d = new Date(t);
    return `${p2(d.getUTCMonth() + 1)}.${p2(d.getUTCDate())}(${DOW[d.getUTCDay()]})`;
  },
  date(t: number): string { return new Date(t).getUTCFullYear() + '.' + fmt.mdd(t); },
  num(n: number): string { return Math.round(n).toLocaleString('ko-KR'); },
  won(n: number): string { return fmt.num(n) + '원'; },
  mmss(ms: number): string {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${p2(Math.floor(s / 60))}:${p2(s % 60)}`;
  },
  sec(ms: number, digits = 3): string { return (ms / 1000).toFixed(digits); },
  signedSec(ms: number): string { return (ms >= 0 ? '+' : '−') + (Math.abs(ms) / 1000).toFixed(3) + '초'; },
};
