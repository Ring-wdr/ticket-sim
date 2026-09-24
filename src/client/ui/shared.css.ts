// 여러 화면이 같이 쓰는 기본 조각: 컨테이너 · 버튼 · 표 · 태그 · 등급 색 칩 · 애니메이션
import { createVar, globalStyle, keyframes, style } from '@vanilla-extract/css';
import { recipe, type RecipeVariants } from '@vanilla-extract/recipes';
import { vars } from '../styles/theme.css';

export const container = style({ maxWidth: 1180, margin: '0 auto', padding: '0 20px' });
export const muted = style({ color: vars.color.mute });

export const pop = keyframes({ from: { transform: 'scale(.96)', opacity: 0 } });
export const spinKf = keyframes({ to: { transform: 'rotate(360deg)' } });

export const btn = recipe({
  base: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 6, fontWeight: 600, transition: 'background .15s, border-color .15s',
  },
  variants: {
    kind: {
      primary: {
        background: vars.color.brand, color: '#fff', border: 0, padding: '12px 22px',
        selectors: { '&:hover': { background: vars.color.brandDark }, '&:disabled': { background: '#b9b0ee' } },
      },
      line: {
        background: '#fff', color: vars.color.ink, border: '1px solid #cfcfd8', padding: '11px 20px',
        selectors: { '&:hover': { borderColor: vars.color.ink2 } },
      },
      small: {
        background: '#fff', border: '1px solid #d5d5dd', padding: '5px 10px', fontSize: 12.5, fontWeight: 500,
        selectors: { '&:hover': { borderColor: vars.color.brand, color: vars.color.brand } },
      },
    },
    block: { true: { width: '100%' } },
  },
  defaultVariants: { kind: 'primary' },
});
export type BtnVariants = RecipeVariants<typeof btn>;

/** 줄 표 (가격 · 취소수수료) */
export const table = recipe({
  base: { width: '100%', borderCollapse: 'collapse', borderTop: `2px solid ${vars.color.ink}` },
  variants: { size: { normal: {}, small: {} } },
  defaultVariants: { size: 'normal' },
});
globalStyle(`${table.classNames.base} th, ${table.classNames.base} td`, {
  padding: '10px 12px', borderBottom: `1px solid ${vars.color.line}`, textAlign: 'left',
});
globalStyle(`${table.classNames.base} th`, { background: vars.color.bg2, fontWeight: 600, fontSize: 13 });
globalStyle(`${table.classNames.variants.size.small} td`, { padding: '7px 10px', fontSize: 12.5 });

export const tag = recipe({
  base: { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 3 },
  variants: {
    tone: {
      hot: { background: vars.color.accent, color: '#fff' },
      gray: { background: '#e9e9ef', color: vars.color.ink2 },
    },
  },
  defaultVariants: { tone: 'hot' },
});

/** 등급 색 (좌석 · 칩 · 결과 티켓이 인라인으로 받는다) */
export const gradeColor = createVar();

/** 등급 색 네모 점 */
export const swatch = style({
  display: 'inline-block', flex: 'none', width: 10, height: 10, borderRadius: 2, background: gradeColor,
});

export const logoMark = recipe({
  base: {
    display: 'inline-grid', placeItems: 'center', background: vars.color.brand, color: '#fff', fontWeight: 900,
  },
  variants: {
    size: {
      normal: { width: 28, height: 28, borderRadius: 8, fontSize: 16 },
      small: { width: 20, height: 20, borderRadius: 5, fontSize: 11 },
    },
  },
  defaultVariants: { size: 'normal' },
});

export const spinner = style({
  display: 'inline-block', width: 10, height: 10, border: '2px solid #ccc', borderTopColor: vars.color.brand,
  borderRadius: '50%', animation: `${spinKf} .7s linear infinite`, verticalAlign: -1,
});
