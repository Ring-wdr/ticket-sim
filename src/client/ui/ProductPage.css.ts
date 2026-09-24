import { globalStyle, style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { layout, media, vars } from '../styles/theme.css';

export const page = style({ paddingTop: 18 });
export const crumb = style({ fontSize: 12.5, color: vars.color.mute });
export const head = style({ margin: '10px 0 24px' });
export const title = style({ fontSize: 26, margin: '8px 0 4px', letterSpacing: -0.5 });
export const sub = style({ color: vars.color.mute, fontSize: 13 });

export const layoutGrid = style({
  display: 'grid', gridTemplateColumns: '260px 1fr 320px', gap: 32, alignItems: 'start',
  '@media': {
    [media.wide]: { gridTemplateColumns: '200px 1fr' },
    [media.phone]: { gridTemplateColumns: '1fr' },
  },
});
export const poster = style({ '@media': { [media.phone]: { maxWidth: 220 } } });

// ---------- 공연 정보 ----------
export const infoTbl = style({ width: '100%', borderCollapse: 'collapse' });
export const infoTh = style({ textAlign: 'left', width: 84, color: vars.color.mute, fontWeight: 500, verticalAlign: 'top', padding: '7px 0' });
export const infoTd = style({ padding: '7px 0' });
export const priceList = style({ listStyle: 'none', padding: 0, margin: 0 });
export const priceItem = style({ display: 'flex', alignItems: 'center', gap: 8 });
export const price = style({ marginLeft: 'auto', fontWeight: 600 });

export const notice = style({
  marginTop: 20, border: `1px solid ${vars.color.line}`, borderRadius: vars.radius, padding: '14px 16px', background: vars.color.bg2,
});
globalStyle(`${notice} p`, { margin: '4px 0 0' });
export const noticeTitle = recipe({
  variants: { soldout: { true: { color: vars.color.warn, fontSize: 16 } } },
});
export const noticeEm = style({ fontStyle: 'normal', color: vars.color.brand, fontWeight: 700 });

// ---------- 예매 패널 ----------
export const bookPanel = style({
  border: `1px solid ${vars.color.line}`, borderRadius: 12, padding: 18, background: '#fff',
  position: 'sticky', top: `calc(${layout.hudH} + 80px)`, boxShadow: '0 4px 18px rgba(0,0,0,.04)',
  '@media': { [media.wide]: { gridColumn: '1 / -1', position: 'static' } },
});
export const panelTitle = style({ fontWeight: 700, margin: '4px 0 10px' });
export const rounds = style({ marginBottom: 12, minHeight: 36 });
globalStyle(`${rounds} p`, { margin: 0, fontSize: 13 });
export const round = style({
  border: `1px solid ${vars.color.brand}`, background: '#fff', borderRadius: 6, padding: '8px 14px',
  color: vars.color.brand, fontWeight: 700,
});
export const remain = recipe({
  base: { fontSize: 12.5, color: vars.color.ink2, marginBottom: 14, minHeight: 18 },
  variants: { soldout: { true: { color: vars.color.warn, fontWeight: 600 } } },
});
export const bookBtn = style({
  width: '100%', height: 54, border: 0, borderRadius: 8, background: vars.color.brand, color: '#fff',
  fontSize: 17, fontWeight: 800, letterSpacing: -0.3,
  selectors: {
    '&:not(:disabled):hover': { background: vars.color.brandDark },
    '&:active': { transform: 'translateY(1px)' },
    '&:disabled': { opacity: 0.75 },
  },
});

// ---------- 상세 ----------
export const tabs = style({ display: 'flex', borderBottom: `1px solid ${vars.color.line}`, marginTop: 48 });
export const tab = recipe({
  base: { padding: '14px 22px', fontWeight: 600, color: vars.color.mute, borderBottom: '2px solid transparent' },
  variants: { on: { true: { color: vars.color.ink, borderColor: vars.color.ink } } },
});
export const detail = style({ maxWidth: 760 });
export const detailTitle = style({ fontSize: 16, margin: '28px 0 10px' });
export const detailList = style({ paddingLeft: 18, color: vars.color.ink2 });
