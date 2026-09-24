import { keyframes, style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { vars } from '../styles/theme.css';

/** 예매창 본문(좌석 선택) 위를 덮는다 */
export const overlay = style({
  position: 'absolute', inset: 0, background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(3px)',
  display: 'grid', placeItems: 'center', zIndex: 5,
});
const shakeKf = keyframes({
  '20%, 60%': { transform: 'translateX(-6px)' },
  '40%, 80%': { transform: 'translateX(6px)' },
});
export const box = recipe({
  base: {
    width: 340, background: '#fff', border: `1px solid ${vars.color.line}`, borderRadius: 12, padding: 22,
    boxShadow: '0 16px 40px rgba(0,0,0,.15)',
  },
  variants: { shake: { true: { animation: `${shakeKf} .35s` } } },
});
export const title = style({ fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 });
export const brand = style({ color: vars.color.brand });
export const desc = style({ fontSize: 12.5, color: vars.color.ink2, margin: '8px 0 14px' });
export const image = style({ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 10 });
export const canvas = style({ border: `1px solid ${vars.color.line}`, borderRadius: 6, width: 230, height: 66 });
export const regen = style({ flex: 1, border: `1px solid ${vars.color.line}`, background: '#fff', borderRadius: 6, fontSize: 20 });
export const input = style({
  width: '100%', height: 42, border: '1px solid #cfcfd8', borderRadius: 6, padding: '0 12px',
  fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', fontFamily: 'inherit',
  selectors: { '&:focus': { outline: `2px solid ${vars.color.brand}`, borderColor: 'transparent' } },
});
export const error = style({ color: vars.color.warn, fontSize: 12, minHeight: 18, margin: '4px 0' });
