import { style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { vars } from '../styles/theme.css';
import { gradeColor } from './shared.css';

export const page = style({ paddingTop: 36 });
export const card = style({
  maxWidth: 720, margin: '0 auto', border: `1px solid ${vars.color.line}`, borderRadius: 16, padding: 28,
  boxShadow: '0 10px 40px rgba(0,0,0,.06)',
});
export const top = style({ display: 'flex', justifyContent: 'space-between', gap: 20 });
export const mode = style({ fontSize: 12.5, color: vars.color.mute });
export const title = style({ margin: '6px 0', fontSize: 28 });
export const comment = style({ margin: 0, color: vars.color.ink2 });
export const rank = recipe({
  base: {
    width: 86, height: 86, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center',
    fontSize: 46, fontWeight: 900, color: '#fff',
  },
  variants: {
    rank: {
      S: { background: 'linear-gradient(135deg, #7c5cf0, #ff5fa2)' },
      A: { background: 'linear-gradient(135deg, #1f9d55, #4cc38a)' },
      B: { background: 'linear-gradient(135deg, #1d8fe0, #5ab8ff)' },
      F: { background: '#b5b5bf' },
    },
  },
});

export const ticket = style({
  display: 'flex', gap: 16, margin: '22px 0', padding: 14, border: '1px dashed #cfc6ff', borderRadius: 12,
  background: vars.color.brandLight,
});
export const ticketInfo = style({ display: 'flex', flexDirection: 'column', gap: 4 });
export const ticketDate = style({ color: vars.color.ink2, fontSize: 13 });
export const ticketSeat = style({ fontStyle: 'normal', fontWeight: 700, color: gradeColor });
export const ticketNo = style({ color: vars.color.mute });
export const reason = style({ margin: '22px 0', padding: 14, background: vars.color.bg2, borderRadius: 10, color: vars.color.ink2 });

export const stats = style({ width: '100%', borderCollapse: 'collapse', borderTop: `2px solid ${vars.color.ink}` });
export const statKey = style({
  textAlign: 'left', fontWeight: 500, color: vars.color.ink2, padding: '9px 4px', borderBottom: `1px solid ${vars.color.line}`, width: '44%',
});
export const statVal = style({
  padding: '9px 4px', borderBottom: `1px solid ${vars.color.line}`, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
});
export const statNote = style({ color: vars.color.mute, fontWeight: 400, marginLeft: 6 });
export const actions = style({ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24 });
