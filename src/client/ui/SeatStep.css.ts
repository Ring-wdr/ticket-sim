import { createVar, style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { media, vars } from '../styles/theme.css';
import { gradeColor } from './shared.css';

export const layoutGrid = style({
  display: 'grid', gridTemplateColumns: '1fr 250px', gap: 18,
  '@media': { [media.tablet]: { gridTemplateColumns: '1fr' } },
});
/** 접근 제한 오버레이가 이 위를 덮는다 */
export const main = style({ position: 'relative', minWidth: 0 });
export const toolbar = style({ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 });
export const snapTime = style({ marginLeft: 'auto', fontSize: 12, color: vars.color.mute });
export const snapValue = style({ color: vars.color.ink2, fontVariantNumeric: 'tabular-nums' });
export const canvas = recipe({
  base: {
    border: `1px solid ${vars.color.line}`, borderRadius: 8, background: '#fbfbfd', minHeight: 400, padding: 12,
    overflow: 'auto', transition: 'opacity .15s',
  },
  variants: { loading: { true: { opacity: 0.45 } } },
});
export const loadingMsg = style({ color: vars.color.mute, textAlign: 'center', paddingTop: 160 });

// ---------- 구역도 (SVG) ----------
export const venueMap = style({ width: '100%', maxWidth: 640, display: 'block', margin: '0 auto' });
export const stage = style({ fill: '#2a2640' });
export const stageText = style({ fill: '#fff', fontSize: 14, fontWeight: 800, textAnchor: 'middle', letterSpacing: 3 });
export const floor = style({ fill: 'none', stroke: '#dcd6ff', strokeDasharray: '4 3' });
export const zone = style({ cursor: 'pointer' });
export const zoneRect = style({
  transition: 'filter .12s',
  selectors: { [`${zone}:hover &`]: { filter: 'brightness(1.12) drop-shadow(0 2px 4px rgba(0,0,0,.2))' } },
});
export const zoneText = recipe({
  base: { fill: '#fff', fontSize: 13, fontWeight: 800, textAnchor: 'middle', pointerEvents: 'none' },
  variants: {
    count: { true: { fontSize: 11, fontWeight: 600 } },
    soldout: { true: { fill: '#8b8b96' } },
  },
});
export const mapNote = style({ textAlign: 'center', color: vars.color.mute, fontSize: 12, margin: '6px 0 0' });

// ---------- 구역 좌석 그리드 ----------
export const gridHead = style({ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 });
export const gradeChip = style({ fontSize: 11.5, color: '#fff', background: gradeColor, padding: '2px 8px', borderRadius: 10 });
export const stageBar = style({
  textAlign: 'center', background: '#2a2640', color: '#fff', fontSize: 11, letterSpacing: 3,
  borderRadius: 4, padding: 4, margin: '0 auto 12px', maxWidth: 360,
});
/** 구역의 열 수 */
export const cols = createVar();
export const seatGrid = style({
  display: 'grid', gap: 4, justifyContent: 'center', alignItems: 'center',
  gridTemplateColumns: `36px repeat(${cols}, ${vars.seat})`,
});
export const rowLabel = style({ fontSize: 10.5, color: vars.color.mute, textAlign: 'right', paddingRight: 6 });
export const seat = recipe({
  base: { width: vars.seat, height: vars.seat, borderRadius: '3px 3px 5px 5px', border: 0, padding: 0, background: '#d7d7de' },
  variants: {
    /** 조회 시점에 비어 있던 좌석 */
    on: {
      true: {
        background: gradeColor,
        selectors: { '&:hover': { outline: `2px solid ${vars.color.ink}`, outlineOffset: 1 } },
      },
    },
    sel: { true: { background: vars.color.ink, boxShadow: '0 0 0 2px #fff inset' } },
  },
});
export const hint = style({ marginTop: 8, fontSize: 12, color: '#9a6b00', background: '#fff8e6', padding: '7px 12px', borderRadius: 6 });
export const blocked = style({
  position: 'absolute', inset: '40px 0 0', background: 'rgba(255,255,255,.85)', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 8, zIndex: 2,
});
export const blockedTitle = style({ color: vars.color.warn, fontSize: 18 });

// ---------- 오른쪽: 잔여석 · 선택좌석 ----------
export const side = style({ display: 'flex', flexDirection: 'column', gap: 12 });
export const sideBox = style({ border: `1px solid ${vars.color.line}`, borderRadius: 8, padding: 12 });
export const sideTitle = style({ margin: '0 0 8px', fontSize: 13.5 });
export const sideSub = style({ color: vars.color.mute, fontWeight: 400 });
export const list = style({ listStyle: 'none', padding: 0, margin: 0, fontSize: 12.5 });
export const gradeRow = style({ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' });
export const gradePrice = style({ color: vars.color.mute, fontSize: 11.5 });
export const stock = recipe({
  base: { marginLeft: 'auto', color: vars.color.brand },
  variants: { zero: { true: { color: '#b5b5bf' } } },
});
export const selRow = style({ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' });
export const doneBtn = style({
  height: 48, fontSize: 15,
  selectors: { '&:disabled': { background: vars.color.brand, opacity: 0.75 } },
});
