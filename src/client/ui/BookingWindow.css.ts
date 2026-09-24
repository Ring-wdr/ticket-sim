import { style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { media, vars } from '../styles/theme.css';
import { swatch } from './shared.css';

// ---------- 창 머리: 공연명 · 남은 시간 · 단계 ----------
export const head = style({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 10px',
  borderBottom: `1px solid ${vars.color.line}`, flex: 'none',
});
export const showTitle = style({ display: 'block', fontSize: 15 });
export const showSub = style({ fontSize: 12.5, color: vars.color.mute });
export const timer = style({ textAlign: 'right' });
export const timerLabel = style({ fontSize: 11.5, color: vars.color.mute, display: 'block' });
export const timerValue = recipe({
  base: { fontSize: 22, fontVariantNumeric: 'tabular-nums', color: vars.color.ink },
  variants: { warn: { true: { color: vars.color.warn } } },
});
export const steps = style({ display: 'flex', margin: 0, padding: 0, listStyle: 'none', background: '#2a2640', flex: 'none' });
export const step = recipe({
  base: { flex: 1, color: '#8f8aa8', padding: '9px 12px', fontSize: 12.5, fontWeight: 600 },
  variants: {
    state: {
      todo: {},
      done: { color: '#cfc9ea' },
      on: { background: vars.color.brand, color: '#fff' },
    },
  },
});
export const stepNo = style({ fontStyle: 'normal', marginRight: 6, fontSize: 11, opacity: 0.8 });
/** 보안문자가 이 위를 덮는다 */
export const body = style({ position: 'relative', overflow: 'auto', flex: 1, minHeight: 'min(480px, 50vh)' });

// ---------- 단계 공통 ----------
export const stepWrap = recipe({
  base: { padding: '18px 20px' },
  variants: {
    twoCol: {
      true: {
        display: 'grid', gridTemplateColumns: '1fr 280px', gap: 22,
        '@media': { [media.tablet]: { gridTemplateColumns: '1fr' } },
      },
    },
  },
});
export const sectionTitle = style({
  fontSize: 15, margin: '4px 0 10px',
  selectors: { '&:not(:first-child)': { marginTop: 22 } },
});
export const note = style({ fontSize: 12, color: vars.color.mute, paddingLeft: 16 });
export const actions = style({ display: 'flex', justifyContent: 'center', gap: 10, padding: '8px 20px 22px' });
export const actionBtn = style({ minWidth: 140 });
/** 가격표의 등급 점 (기본 색 점보다 조금 작다) */
export const tableDot = style([swatch, { width: 9, height: 9, marginRight: 6 }]);

// My 예매정보
export const summary = style({ background: vars.color.bg2, borderRadius: 8, padding: 16, alignSelf: 'start' });
export const summaryTitle = style({ margin: '0 0 10px' });
export const summaryList = style({ margin: 0, display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8, fontSize: 12.5 });
export const summaryKey = style({ color: vars.color.mute });
export const summaryVal = style({ margin: 0, textAlign: 'right' });
export const total = style({
  borderTop: `1px solid ${vars.color.line}`, paddingTop: 10, fontWeight: 800, color: vars.color.accent, fontSize: 14,
});

// ---------- 04 배송/예매확인 · 05 결제 ----------
export const choices = style({ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' });
export const payMethod = recipe({
  base: { border: `1px solid ${vars.color.line}`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer' },
  variants: { on: { true: { borderColor: vars.color.brand, background: vars.color.brandLight } } },
});
export const payNote = style({ fontSize: 12.5, color: vars.color.ink2, background: '#fff8e6', borderRadius: 6, padding: '8px 12px' });
export const formTbl = style({ width: '100%', borderCollapse: 'collapse' });
export const formTh = style({ textAlign: 'left', width: 90, fontWeight: 500, color: vars.color.ink2, padding: '5px 0' });
export const formInput = style({
  width: '100%', maxWidth: 280, padding: '7px 10px', border: `1px solid ${vars.color.line}`, borderRadius: 5,
  background: vars.color.bg2, font: 'inherit',
});
export const agree = style({
  display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 16, padding: 12,
  border: `1px solid ${vars.color.line}`, borderRadius: 8, fontSize: 13, cursor: 'pointer',
});

// ---------- 완료 ----------
export const done = style({ textAlign: 'center', padding: '34px 20px' });
export const doneIcon = style({
  width: 64, height: 64, margin: '0 auto', borderRadius: '50%', background: vars.color.ok, color: '#fff',
  fontSize: 34, display: 'grid', placeItems: 'center',
});
export const doneTitle = style({ margin: '14px 0 4px' });
export const bookingNo = style({ color: vars.color.brand });
export const doneCard = style({
  maxWidth: 520, margin: '18px auto 22px', textAlign: 'left', border: `1px solid ${vars.color.line}`, borderRadius: 10,
});
export const doneRow = style({
  display: 'flex', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${vars.color.line}`,
  selectors: { '&:last-child': { border: 0 } },
});
export const doneKey = style({ width: 80, color: vars.color.mute, flex: 'none' });
export const persist = recipe({
  base: { color: '#b7791f' },
  variants: { saved: { true: { color: vars.color.ok } } },
});
