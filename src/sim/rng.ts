// 시드 랜덤 (mulberry32). 시뮬레이션의 모든 무작위는 여기서 나와야 같은 시드로 같은 게임을 재현할 수 있다.
export interface Rng {
  next(): number;
  range(lo: number, hi: number): number;
  int(lo: number, hi: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
  exp(mean: number): number;
  poisson(lambda: number): number;
  shuffle<T>(arr: readonly T[]): T[];
  uuid(): string;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = (): number => {
    const u = 1 - next(), v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const rng: Rng = {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),
    pick(arr) {
      if (!arr.length) throw new Error('pick from empty array');
      return arr[Math.floor(next() * arr.length)]!;
    },
    chance: p => next() < p,
    exp: mean => -Math.log(1 - next()) * mean,
    poisson(l) {
      if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss()));
      const L = Math.exp(-l);
      let k = 0, p = 1;
      do { k++; p *= next(); } while (p > L);
      return k - 1;
    },
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    uuid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.floor(next() * 16);
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      });
    },
  };
  return rng;
}
