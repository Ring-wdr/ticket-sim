import { globalStyle, style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { media, vars } from '../styles/theme.css';

// ---------- hero ----------
export const hero = style({ background: 'linear-gradient(120deg, #1a1433 0%, #2d1b5e 55%, #4b1d5c 100%)', color: '#fff' });
export const heroIn = style({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, padding: '48px 20px' });
export const heroTitle = style({
  fontSize: 38, lineHeight: 1.25, margin: '14px 0', letterSpacing: -1,
  '@media': { [media.phone]: { fontSize: 28 } },
});
export const heroText = style({ color: '#d8d2f5', fontSize: 16, margin: 0 });
globalStyle(`${heroText} b`, { color: '#fff' });
export const badge = style({
  display: 'inline-block', fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
  background: 'rgba(255,255,255,.12)', padding: '5px 10px', borderRadius: 4,
});
export const heroPoster = style({
  width: 210, flex: 'none', transform: 'rotate(2deg)', boxShadow: '0 20px 50px rgba(0,0,0,.4)', borderRadius: 6,
  '@media': { [media.tablet]: { display: 'none' } },
});
export const secTitle = style({ fontSize: 22, margin: '44px 0 16px', letterSpacing: -0.5 });

// ---------- 모드 카드 ----------
export const modeCards = style({
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
  '@media': { [media.tablet]: { gridTemplateColumns: '1fr' } },
});
export const modeCard = style({
  border: `1px solid ${vars.color.line}`, borderRadius: 12, padding: 24,
  display: 'flex', flexDirection: 'column', gap: 14, background: '#fff',
  selectors: { '&:hover': { borderColor: '#cfc6ff', boxShadow: '0 8px 24px rgba(91,63,240,.08)' } },
});
export const cardHead = style({ display: 'flex', gap: 14 });
export const cardIcon = style({
  fontSize: 30, width: 52, height: 52, display: 'grid', placeItems: 'center',
  background: vars.color.brandLight, borderRadius: 12, flex: 'none',
});
export const cardTitle = style({ margin: '2px 0 4px', fontSize: 19 });
export const cardDesc = style({ margin: 0, color: vars.color.ink2 });
export const cardPoints = style({ margin: 0, paddingLeft: 18, color: vars.color.ink2, fontSize: 13 });
export const cardMeta = style({ fontSize: 12.5, color: vars.color.mute });

// 난이도 선택 (라디오를 숨기고 버튼 모양 상자로)
export const seg = style({ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 });
export const segLabel = style({ cursor: 'pointer' });
export const segInput = style({ position: 'absolute', opacity: 0, pointerEvents: 'none' });
export const segBox = recipe({
  base: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '9px 4px',
    border: `1px solid ${vars.color.line}`, borderRadius: 8, transition: 'all .15s',
  },
  variants: {
    on: { true: { borderColor: vars.color.brand, background: vars.color.brandLight, color: vars.color.brand } },
  },
});
// 키보드 초점은 DOM 상태라 선택자로 둔다
globalStyle(`${segInput}:focus-visible + ${segBox.classNames.base}`, { outline: `2px solid ${vars.color.brand}`, outlineOffset: 2 });
export const segSub = style({ fontSize: 11.5, color: vars.color.mute });

// ---------- 티켓오픈 소식 ----------
export const openList = style({ listStyle: 'none', margin: 0, padding: 0, borderTop: `2px solid ${vars.color.ink}` });
export const openItem = style({
  display: 'flex', alignItems: 'center', gap: 18, padding: '14px 6px', borderBottom: `1px solid ${vars.color.line}`,
});
export const openDate = style({ color: vars.color.brand, fontWeight: 700, minWidth: 120 });

// ---------- 서버 동작 소개 ----------
export const howSteps = style({
  listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
  '@media': { [media.tablet]: { gridTemplateColumns: '1fr' } },
});
export const howStep = style({ background: vars.color.bg2, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 });
export const howDesc = style({ color: vars.color.ink2, fontSize: 13 });
export const howNote = style({ color: vars.color.ink2, marginTop: 14 });
