import { globalStyle, style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { layout, vars } from '../styles/theme.css';
import { pop } from './shared.css';

// ---------- 대화상자 (브라우저 alert 풍) ----------
export const dialogBackdrop = style({
  position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
  paddingTop: '12vh', background: 'rgba(0,0,0,.08)',
});
export const dialog = style({
  width: 440, maxWidth: 'calc(100% - 32px)', background: '#fff', borderRadius: 10,
  boxShadow: '0 12px 40px rgba(0,0,0,.3)', padding: '20px 22px 16px', animation: `${pop} .12s ease-out`,
});
export const dialogOrigin = style({ fontSize: 13, color: vars.color.ink2, marginBottom: 12 });
export const dialogMsg = style({ fontSize: 14, marginBottom: 18 });
export const dialogActions = style({ display: 'flex', justifyContent: 'flex-end', gap: 8 });
export const dialogBtn = recipe({
  base: {
    minWidth: 76, padding: '7px 16px', borderRadius: 18, border: '1px solid #cfcfd8', background: '#fff',
    color: '#1a56db', fontWeight: 600,
    selectors: { '&:focus-visible': { outline: '2px solid #1a56db', outlineOffset: 2 } },
  },
  variants: { primary: { true: { background: '#1a56db', color: '#fff', borderColor: '#1a56db' } } },
});

// ---------- 토스트 ----------
export const toasts = style({
  position: 'fixed', top: `calc(${layout.hudH} + 14px)`, left: '50%', transform: 'translateX(-50%)', zIndex: 110,
  display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', pointerEvents: 'none',
});
export const toast = recipe({
  base: {
    background: '#1b1b1f', color: '#fff', padding: '10px 18px', borderRadius: 20, fontSize: 13,
    boxShadow: '0 6px 20px rgba(0,0,0,.25)', transition: 'opacity .4s, transform .4s',
  },
  variants: {
    kind: {
      '': {},
      warn: { background: vars.color.warn },
      hot: { background: 'linear-gradient(90deg, #ff3d5a, #ff8a3d)', fontWeight: 700 },
    },
    /** 사라지는 중 */
    out: { true: { opacity: 0, transform: 'translateY(-8px)' } },
  },
});

// ---------- 서버 들여다보기 ----------
export const fab = style({
  position: 'fixed', right: `calc(16px + ${layout.sideW})`, bottom: `calc(16px + ${layout.sideH})`, zIndex: 70,
  background: '#14121f', color: '#fff', border: 0, borderRadius: 22, padding: '10px 16px', fontSize: 13, fontWeight: 600,
  boxShadow: '0 8px 24px rgba(0,0,0,.3)',
});
/** 게임 동안 늘 붙어 있고 열림 여부로 미끄러져 들어온다 */
export const panel = recipe({
  base: {
    position: 'fixed', top: layout.hudH, right: 0, bottom: 0, width: 440, maxWidth: '100vw', zIndex: 80,
    background: '#14121f', color: '#dcd8ee', transform: 'translateX(100%)', transition: 'transform .22s ease',
    display: 'flex', flexDirection: 'column', fontSize: 12.5,
  },
  variants: { open: { true: { transform: 'none', boxShadow: '-10px 0 40px rgba(0,0,0,.35)' } } },
});
export const head = style({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #2c2840' });
export const headTitle = style({ display: 'block', color: '#fff', fontSize: 14 });
export const headSub = style({ fontSize: 11.5, color: '#8d88a8' });
export const close = style({ background: 'none', border: 0, color: '#fff', fontSize: 16 });
export const body = style({ overflowY: 'auto', padding: '4px 16px 20px' });
export const section = style({ color: '#a898ff', margin: '16px 0 6px', fontSize: 12, letterSpacing: 0.5 });

export const keys = style({ width: '100%', borderCollapse: 'collapse' });
export const keyCell = style({
  padding: '5px 0', borderBottom: '1px solid #25213a', verticalAlign: 'top',
  selectors: { '&:last-child': { textAlign: 'right' } },
});
export const keyName = style({ color: '#ffcf5c' });
export const keyNote = style({ display: 'block', color: '#7a7593', fontSize: 10.5 });
export const keyVal = style({ color: '#fff', fontVariantNumeric: 'tabular-nums' });

export const metrics = style({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 });
export const metric = style({ background: '#1e1b2e', borderRadius: 6, padding: '7px 9px' });
export const metricName = style({ display: 'block', color: '#8d88a8', fontSize: 10.5 });

export const logs = style({
  listStyle: 'none', padding: 0, margin: 0, maxHeight: 280, overflowY: 'auto', fontFamily: vars.font.mono, fontSize: 11,
});
export const log = style({ display: 'flex', gap: 6, padding: '3px 0', borderBottom: '1px solid #211d33' });
export const logTime = style({ color: '#6f6a8a', flex: 'none' });
export const logSrc = recipe({
  base: {
    fontStyle: 'normal', flex: 'none', fontSize: 9.5, padding: '1px 4px', borderRadius: 3,
    background: '#2c2840', color: '#cfc9ea', height: 'fit-content',
  },
  variants: {
    src: {
      system: {}, api: {}, bot: {},
      lua: { background: '#4a2fd6', color: '#fff' },
      redis: { background: '#b3261e', color: '#fff' },
      mq: { background: '#1f7a4d', color: '#fff' },
      scheduler: { background: '#8a5a00', color: '#fff' },
      cancel: { background: '#c2410c', color: '#fff' },
    },
  },
});
export const logMsg = recipe({
  variants: {
    level: { info: {}, ok: { color: '#9ff0bf' }, warn: { color: '#ff9aa8' } },
  },
});

export const checklist = style({ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 });
export const checkItem = style({ background: '#1e1b2e', borderRadius: 6, padding: '8px 10px' });
export const checkTitle = style({ display: 'block', color: '#fff', marginBottom: 2 });
export const checkDesc = style({ color: '#aaa5c2' });
globalStyle(`${checkItem} code`, { color: '#ffcf5c' });
