// 문서 전체 기본값 (요소 선택자는 여기에만 둔다)
import { globalStyle } from '@vanilla-extract/css';
import { media, vars } from './theme.css';

globalStyle(':root', {
  fontFamily: vars.font.body,
  color: vars.color.ink,
  background: vars.color.bg,
  '@media': { [media.phone]: { vars: { [vars.seat]: '13px' } } },
});
globalStyle('*', { boxSizing: 'border-box' });
globalStyle('body', {
  margin: 0, background: vars.color.bg, fontSize: 14, lineHeight: 1.5, WebkitFontSmoothing: 'antialiased',
});
globalStyle('button', { font: 'inherit', cursor: 'pointer' });
globalStyle('button:disabled', { cursor: 'default' });
globalStyle('a', { color: 'inherit', textDecoration: 'none' });
globalStyle('code', { fontFamily: vars.font.mono, fontSize: '0.92em' });
