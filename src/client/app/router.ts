// 해시 라우터: #/ · #/open · #/cancel · #/result
import { signal } from '@preact/signals';

const parse = (hash: string): string => hash.slice(1) || '/';

export const route = signal('/');

export function initRouter(): () => void {
  const sync = (): void => { route.value = parse(location.hash); };
  sync();
  window.addEventListener('hashchange', sync);
  return () => window.removeEventListener('hashchange', sync);
}

export function navigate(path: string): void {
  if (parse(location.hash) === path) route.value = path;
  else location.hash = path;
}
