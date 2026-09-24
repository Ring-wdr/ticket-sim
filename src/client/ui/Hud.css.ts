import { globalStyle, keyframes, style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { layout, media, vars } from '../styles/theme.css';
import { pop } from './shared.css';

// ---------- HUD 한 줄 ----------
export const bar = style({
  display: 'flex', alignItems: 'center', gap: 18, height: 44, padding: '0 16px',
  whiteSpace: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none',
  '@media': { [media.tablet]: { gap: 10, padding: '0 10px' } },
});
globalStyle(`${bar} > *`, { flex: 'none' });
export const spacer = style({});
globalStyle(`${bar} > ${spacer}`, { flex: 1 });

export const mode = style({ fontWeight: 700 });
export const modeBadge = style({
  fontStyle: 'normal', fontSize: 11, background: 'rgba(255,255,255,.14)', padding: '2px 7px', borderRadius: 10, marginLeft: 4,
  '@media': { [media.tablet]: { display: 'none' } },
});
export const value = style({ fontVariantNumeric: 'tabular-nums', color: '#fff', marginLeft: 4 });
export const note = style({ color: '#9d98b8', '@media': { [media.tablet]: { display: 'none' } } });
export const btn = style({
  background: 'rgba(255,255,255,.1)', color: '#fff', border: 0, borderRadius: 6, padding: '6px 11px', fontSize: 12.5,
  selectors: { '&:hover': { background: 'rgba(255,255,255,.2)' } },
});

// 취켓팅: 게임 내 시각 · 배속 상태 · 배속 버튼
export const time = style({ fontSize: 15 });
export const dday = style({ fontStyle: 'normal', marginLeft: 8, color: '#ffcf5c', fontWeight: 700 });
const pulse = keyframes({ '50%': { opacity: 0.75 } });
export const speed = recipe({
  base: {
    fontSize: 12.5, padding: '3px 10px', borderRadius: 12, background: 'rgba(255,255,255,.08)', minWidth: 150, textAlign: 'center',
    '@media': { [media.tablet]: { minWidth: 0 } },
  },
  variants: {
    hot: { true: { background: '#ff3d5a', color: '#fff', fontWeight: 700, animation: `${pulse} 1.2s infinite` } },
  },
});
export const ctrl = style({ display: 'flex', gap: 4 });
export const ctrlBtn = recipe({
  base: {
    background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid transparent', borderRadius: 6, padding: '4px 9px', fontSize: 13,
    selectors: { '&:hover': { background: 'rgba(255,255,255,.18)' } },
  },
  variants: {
    on: { true: { borderColor: '#a898ff', background: 'rgba(168,152,255,.2)' } },
  },
});

// ---------- 취켓팅 타임라인 ----------
export const timeline = style({ padding: '0 16px 6px' });
export const track = style({ position: 'relative', height: 16, background: 'rgba(255,255,255,.07)', borderRadius: 3 });
export const day = style({ position: 'absolute', top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,.2)' });
export const dayLabel = style({ position: 'absolute', left: 3, top: 1, fontSize: 9.5, fontStyle: 'normal', color: '#8d88a8' });
export const hotWindow = recipe({
  base: { position: 'absolute', top: 2, bottom: 2, borderRadius: 2 },
  variants: {
    kind: {
      small: {},
      surge: { background: '#ff9f43', opacity: 0.8 },
      big: { background: '#ff3d5a' },
    },
  },
});
export const nowMark = style({ position: 'absolute', top: -2, bottom: -2, width: 2, background: '#fff', boxShadow: '0 0 6px #fff' });

// ---------- 오픈 티켓팅: 서버시간 위젯 ----------
export const srvClock = style({
  position: 'fixed', left: 16, bottom: 16, zIndex: 30, background: '#fff', border: `1px solid ${vars.color.line}`,
  borderRadius: 12, padding: '12px 16px', boxShadow: '0 10px 30px rgba(0,0,0,.12)', minWidth: 260,
  '@media': { [media.phone]: { left: 8, right: 8, bottom: 60, minWidth: 0 } },
});
export const srvHead = style({ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontWeight: 700, fontSize: 12.5 });
export const srvHost = style({ color: vars.color.mute, fontWeight: 400, fontSize: 11 });
export const srvTime = style({ fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, color: vars.color.brand });
export const srvFoot = style({ fontSize: 11.5, color: vars.color.mute });

// ---------- 취켓팅: 커뮤니티 피드 ----------
export const feed = style({
  position: 'fixed', top: layout.hudH, right: 0, bottom: 0, width: layout.sideW, zIndex: 45,
  background: '#faf9fd', borderLeft: `1px solid ${vars.color.line}`, display: 'flex', flexDirection: 'column',
  '@media': {
    [media.tablet]: { top: 'auto', height: layout.sideH, width: '100%', borderLeft: 0, borderTop: `1px solid ${vars.color.line}` },
  },
});
export const feedHead = style({
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px',
  borderBottom: `1px solid ${vars.color.line}`, background: '#fff',
});
export const live = style({ fontSize: 11, color: vars.color.ok, fontWeight: 700 });
export const feedList = style({
  listStyle: 'none', margin: 0, padding: 10, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8,
});
export const feedItem = recipe({
  base: {
    background: '#fff', border: `1px solid ${vars.color.line}`, borderRadius: 10, padding: '8px 11px', fontSize: 12.5,
    animation: `${pop} .2s ease-out`,
  },
  variants: {
    /** 핫타임 힌트 글 */
    hint: { true: { borderColor: '#ffb46b', background: '#fff8ef' } },
  },
});
export const feedMeta = style({ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: vars.color.mute });
export const feedUser = style({ color: vars.color.ink2 });
export const feedText = style({ margin: '3px 0 0' });
export const feedFoot = style({ fontSize: 11, color: vars.color.mute, padding: '8px 14px', borderTop: `1px solid ${vars.color.line}` });
