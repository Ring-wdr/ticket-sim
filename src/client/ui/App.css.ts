import { style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { layout, layoutVar, media, vars } from '../styles/theme.css';

/** 게임 모드가 골격 치수를 정한다 (theme.css.ts의 layoutVar) */
export const shell = recipe({
  variants: {
    mode: {
      none: {},
      open: {
        vars: { [layoutVar.hudH]: '44px' },
        paddingTop: layout.hudH,
      },
      cancel: {
        vars: { [layoutVar.hudH]: '66px', [layoutVar.sideW]: '300px' },
        padding: `${layout.hudH} ${layout.sideW} ${layout.sideH} 0`,
        '@media': { [media.tablet]: { vars: { [layoutVar.sideW]: '0px', [layoutVar.sideH]: '180px' } } },
      },
    },
  },
  defaultVariants: { mode: 'none' },
});

export const hud = style({
  position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
  background: vars.color.hud, color: '#e8e6f5', fontSize: 13,
});

export const page = recipe({
  variants: {
    /** 상품 페이지에서 F5 → 잠깐 흐려지는 연출 */
    reloading: { true: { opacity: 0.35, transition: 'none' } },
  },
});
