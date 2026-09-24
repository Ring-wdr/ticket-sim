import { style } from '@vanilla-extract/css';
import { vars } from '../styles/theme.css';

export const body = style({ padding: '26px 30px 24px', textAlign: 'center' });
export const logo = style({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: vars.color.ink2,
});
export const title = style({ margin: '16px 0 6px', fontSize: 21 });
export const sub = style({ color: vars.color.ink2, fontSize: 13, margin: 0 });
export const rank = style({ margin: '22px 0 12px' });
export const rankLabel = style({ display: 'block', color: vars.color.mute, fontSize: 13 });
export const rankNum = style({
  fontSize: 44, fontWeight: 900, color: vars.color.brand, fontVariantNumeric: 'tabular-nums', letterSpacing: -1,
});
export const rankUnit = style({ fontSize: 16, color: vars.color.ink2, marginLeft: 4, fontWeight: 600 });
export const bar = style({ height: 10, background: '#ecebf3', borderRadius: 5, overflow: 'hidden' });
export const barFill = style({
  display: 'block', height: '100%', background: `linear-gradient(90deg, ${vars.color.brand}, #9b7bff)`,
  borderRadius: 5, transition: 'width .6s ease',
});
export const meta = style({ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: vars.color.ink2, margin: '10px 0 18px' });
export const warn = style({ fontSize: 12, color: vars.color.warn, background: '#fff2f3', borderRadius: 6, padding: 10 });
export const poll = style({ marginTop: 12, fontSize: 11.5, color: vars.color.mute, minHeight: 18 });
export const pollCode = style({ background: vars.color.bg2, padding: '1px 4px', borderRadius: 3, color: vars.color.ink2 });
