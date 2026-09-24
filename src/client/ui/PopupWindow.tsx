// 브라우저 팝업 창 연출 (접속 대기창 · 예매창 공통 틀)
import type { ComponentChildren } from 'preact';
import * as s from './PopupWindow.css';

export function PopupWindow({ path, size, onClose, children }: {
  path: string; size: 'wide' | 'narrow'; onClose: () => void; children: ComponentChildren;
}) {
  return (
    <div class={s.backdrop}><div class={s.win({ size })}>
      <div class={s.bar}>
        <span class={s.dots}><i class={s.dot} /><i class={s.dot} /><i class={s.dot} /></span>
        <span class={s.url}>🔒 tickets.tikitaka.example/{path}</span>
        <button class={s.close} title="닫기" onClick={onClose}>✕</button>
      </div>
      {children}
    </div></div>
  );
}
