// 가상 공연장 "티키타카 아레나" 좌석 배치 · 공연 정보.
// 순수 데이터라 서버(Worker)와 UI가 같은 좌석도를 각자 만들어 쓴다.
import { T } from './time';

export type GradeKey = 'VIP' | 'R' | 'S';
export const GRADE_KEYS: readonly GradeKey[] = ['VIP', 'R', 'S'];

export interface Grade {
  name: string;
  price: number;
  color: string;
  /** 봇 좌석 선호 가중치 */
  w: number;
}

export const GRADES: Record<GradeKey, Grade> = {
  VIP: { name: 'VIP석', price: 165000, color: '#7c5cf0', w: 6 },
  R: { name: 'R석', price: 154000, color: '#1f9d55', w: 2.2 },
  S: { name: 'S석', price: 132000, color: '#1d8fe0', w: 1 },
};

export interface ShowDate { key: string; label: string; time: string; t: number }

export const SHOW = {
  title: '2026 LUMINA WORLD TOUR 〈AFTERGLOW〉 IN SEOUL',
  artist: 'LUMINA',
  venue: '티키타카 아레나',
  period: '2026.10.10 ~ 2026.10.11',
  runtime: '150분',
  age: '8세 이상 관람가능',
  dates: [
    { key: '1010', label: '2026.10.10(토)', time: '18:00', t: T(2026, 10, 10, 18) },
    { key: '1011', label: '2026.10.11(일)', time: '17:00', t: T(2026, 10, 11, 17) },
  ] satisfies ShowDate[],
} as const;

export type SeatId = string;

export interface Zone {
  id: string;
  name: string;
  grade: GradeKey;
  rows: number;
  cols: number;
  /** SVG 좌석도(viewBox 0 0 640 420) 상의 [x, y, w, h] */
  rect: readonly [number, number, number, number];
}

export interface Seat {
  id: SeatId;
  zone: string;
  grade: GradeKey;
  row: number;
  col: number;
  short: string;
  label: string;
  /** 봇 선호도 (앞열·가운데일수록 큼) */
  w: number;
}

export interface Venue {
  zones: Zone[];
  seats: Seat[];
  byId: ReadonlyMap<SeatId, Seat>;
  zoneById: ReadonlyMap<string, Zone>;
}

export const seatId = (zone: string, row: number, col: number): SeatId => `${zone}-${row}-${col}`;

export function buildVenue(): Venue {
  const Z = (id: string, name: string, grade: GradeKey, rows: number, cols: number, x: number, y: number, w: number, h: number): Zone =>
    ({ id, name, grade, rows, cols, rect: [x, y, w, h] });
  const zones = [
    Z('A', '플로어 A구역', 'VIP', 10, 14, 222, 90, 96, 76),
    Z('B', '플로어 B구역', 'VIP', 10, 14, 322, 90, 96, 76),
    Z('C', '플로어 C구역', 'VIP', 10, 14, 222, 170, 96, 76),
    Z('D', '플로어 D구역', 'VIP', 10, 14, 322, 170, 96, 76),
    Z('101', '1층 101구역', 'R', 8, 16, 132, 90, 76, 76),
    Z('102', '1층 102구역', 'R', 8, 16, 132, 170, 76, 76),
    Z('103', '1층 103구역', 'R', 8, 16, 222, 262, 96, 52),
    Z('104', '1층 104구역', 'R', 8, 16, 322, 262, 96, 52),
    Z('105', '1층 105구역', 'R', 8, 16, 432, 90, 76, 76),
    Z('106', '1층 106구역', 'R', 8, 16, 432, 170, 76, 76),
    Z('201', '2층 201구역', 'S', 6, 18, 42, 80, 76, 104),
    Z('202', '2층 202구역', 'S', 6, 18, 42, 190, 76, 104),
    Z('203', '2층 203구역', 'S', 6, 18, 142, 330, 172, 50),
    Z('204', '2층 204구역', 'S', 6, 18, 326, 330, 172, 50),
    Z('205', '2층 205구역', 'S', 6, 18, 522, 80, 76, 104),
    Z('206', '2층 206구역', 'S', 6, 18, 522, 190, 76, 104),
  ];
  const seats: Seat[] = [];
  const byId = new Map<SeatId, Seat>();
  const zoneById = new Map<string, Zone>();
  for (const z of zones) {
    zoneById.set(z.id, z);
    for (let r = 1; r <= z.rows; r++) {
      for (let c = 1; c <= z.cols; c++) {
        const front = 1 - (r - 1) / Math.max(1, z.rows - 1); // 앞열일수록 1
        const center = 1 - Math.abs((c - (z.cols + 1) / 2) / z.cols); // 가운데일수록 1
        const s: Seat = {
          id: seatId(z.id, r, c), zone: z.id, grade: z.grade, row: r, col: c,
          short: `${z.id}구역 ${r}열 ${c}`,
          label: `${z.name} ${r}열 ${c}번`,
          w: GRADES[z.grade].w * (1 + 0.6 * front) * (0.8 + 0.4 * center),
        };
        seats.push(s);
        byId.set(s.id, s);
      }
    }
  }
  return { zones, seats, byId, zoneById };
}

/** 존재하지 않는 좌석 id는 프로그래밍 오류이므로 즉시 던진다 */
export function seatOf(venue: Venue, id: SeatId): Seat {
  const s = venue.byId.get(id);
  if (!s) throw new Error(`unknown seat: ${id}`);
  return s;
}
