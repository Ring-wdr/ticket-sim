import { style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { layout, media, vars } from '../styles/theme.css';

/** HUD 아래 · 피드 옆 빈자리를 덮는다 */
export const backdrop = style({
  position: 'fixed', inset: `${layout.hudH} ${layout.sideW} ${layout.sideH} 0`, zIndex: 40,
  background: 'rgba(20,18,31,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  '@media': { [media.tablet]: { padding: 8 } },
});

export const win = recipe({
  base: {
    maxHeight: '100%', background: '#fff', borderRadius: 10, overflow: 'hidden',
    display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,.35)',
  },
  variants: {
    size: {
      wide: { width: 'min(1000px, 100%)' },
      narrow: { width: 'min(470px, 100%)' },
    },
  },
});

export const bar = style({
  display: 'flex', alignItems: 'center', gap: 10, background: '#ececf1', padding: '7px 10px',
  fontSize: 12, color: vars.color.ink2, flex: 'none',
});
export const dots = style({ display: 'flex', gap: 5 });
export const dot = style({ width: 10, height: 10, borderRadius: '50%', background: '#d0d0d8' });
export const url = style({ flex: 1, background: '#fff', borderRadius: 5, padding: '3px 10px' });
export const close = style({
  border: 0, background: 'none', fontSize: 14, color: vars.color.ink2, padding: '2px 6px', borderRadius: 4,
  selectors: { '&:hover': { background: '#dcdce3' } },
});
