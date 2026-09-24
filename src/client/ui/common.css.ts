import { globalStyle, style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { layout, media, vars } from '../styles/theme.css';

// ---------- header / footer ----------
export const header = style({
  borderBottom: `1px solid ${vars.color.line}`, background: '#fff', position: 'sticky', top: layout.hudH, zIndex: 20,
});
export const headerIn = style({ display: 'flex', alignItems: 'center', height: 64, gap: 36 });
export const logo = style({ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 20, letterSpacing: -0.5 });
export const logoSub = style({ fontSize: 11, fontWeight: 700, color: vars.color.brand, letterSpacing: 1, marginLeft: 2 });
export const gnb = style({
  display: 'flex', gap: 22, fontWeight: 600, color: vars.color.ink2,
  '@media': { [media.wide]: { display: 'none' } },
});
export const gnbItem = recipe({
  base: { padding: '20px 0', borderBottom: '2px solid transparent' },
  variants: { on: { true: { color: vars.color.ink, borderColor: vars.color.ink } } },
});
export const util = style({ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, color: vars.color.ink2, fontSize: 13 });
export const search = style({
  background: vars.color.bg2, borderRadius: 20, padding: '7px 16px', color: vars.color.mute, minWidth: 220,
  '@media': { [media.tablet]: { display: 'none' } },
});
export const footer = style({
  borderTop: `1px solid ${vars.color.line}`, marginTop: 64, padding: '28px 0 40px', background: vars.color.bg2,
  fontSize: 12.5, color: vars.color.ink2,
});
globalStyle(`${footer} p`, { margin: '4px 0' });

// ---------- poster ----------
export const poster = recipe({
  base: {
    aspectRatio: '3 / 4', borderRadius: 6, color: '#fff', padding: 18, display: 'flex', flexDirection: 'column',
    background: [
      'radial-gradient(circle at 28% 22%, rgba(255,184,107,.95) 0, rgba(255,184,107,0) 38%)',
      'radial-gradient(circle at 78% 70%, rgba(255,95,162,.85) 0, rgba(255,95,162,0) 45%)',
      'linear-gradient(160deg, #1b1340, #3a1c6e 50%, #0d0a24)',
    ].join(', '),
    position: 'relative', overflow: 'hidden',
    '::after': {
      content: '""', position: 'absolute', inset: 0,
      background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 2px, transparent 2px 6px)',
    },
  },
  variants: {
    mini: { true: { width: 90, padding: 8, flex: 'none' } },
  },
});
export const posterTop = style({ fontSize: 11, letterSpacing: 3, opacity: 0.85 });
export const posterTitle = recipe({
  base: { marginTop: 'auto', fontSize: 44, fontWeight: 900, letterSpacing: 2, lineHeight: 1, textShadow: '0 4px 30px rgba(255,120,160,.6)' },
  variants: { mini: { true: { fontSize: 18 } } },
});
export const posterSub = style({ fontSize: 14, fontWeight: 700, letterSpacing: 1, marginTop: 8 });
export const posterFoot = style({
  fontSize: 10.5, opacity: 0.8, marginTop: 14, borderTop: '1px solid rgba(255,255,255,.3)', paddingTop: 8,
});

// ---------- calendar ----------
export const cal = style({ border: `1px solid ${vars.color.line}`, borderRadius: 8, padding: 10, marginBottom: 16 });
export const calHead = style({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 });
export const calNav = style({ border: 0, background: 'none', color: '#ccc', fontSize: 18 });
export const calGrid = style({ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' });
export const dow = style({ fontSize: 11.5, color: vars.color.mute, padding: '4px 0' });
export const calDay = recipe({
  base: { border: 0, background: 'none', height: 32, borderRadius: '50%', color: '#c4c4cc', fontSize: 13 },
  variants: {
    on: {
      true: {
        color: vars.color.ink, fontWeight: 700, background: vars.color.brandLight,
        selectors: { '&:hover': { background: '#e2dbff' } },
      },
    },
    sel: { true: { background: vars.color.brand, color: '#fff', selectors: { '&:hover': { background: vars.color.brand } } } },
    soldout: { true: { textDecoration: 'line-through' } },
  },
});
