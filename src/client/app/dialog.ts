// 브라우저 alert 풍 대화상자 · 토스트.
// 네이티브 alert()은 스레드를 멈춰 화면 갱신까지 멈추므로, 크롬 alert 모양의 비차단 대화상자를 쓴다.
import { signal } from '@preact/signals';

export interface DialogButton { label: string; value: boolean; primary?: boolean }
export interface DialogReq { id: number; msg: string; buttons: DialogButton[]; close(v: boolean): void }

export const dialogs = signal<DialogReq[]>([]);

let seq = 0;

function open(msg: string, buttons: DialogButton[]): Promise<boolean> {
  return new Promise(resolve => {
    const d: DialogReq = {
      id: ++seq, msg, buttons,
      close(v) {
        dialogs.value = dialogs.value.filter(x => x !== d);
        resolve(v);
      },
    };
    dialogs.value = [...dialogs.value, d];
  });
}

export const dialog = {
  async alert(msg: string): Promise<void> { await open(msg, [{ label: '확인', value: true, primary: true }]); },
  confirm(msg: string): Promise<boolean> {
    return open(msg, [{ label: '취소', value: false }, { label: '확인', value: true, primary: true }]);
  },
  isOpen(): boolean { return dialogs.value.length > 0; },
  /** 게임 종료 시: 떠 있던 대화상자는 닫고, 기다리던 쪽은 응답을 받지 못한다 (프로토타입과 동일) */
  clear(): void { dialogs.value = []; },
};

export type ToastKind = '' | 'warn' | 'hot';
export interface Toast { id: number; msg: string; kind: ToastKind; out: boolean }

export const toasts = signal<Toast[]>([]);

export function toast(msg: string, kind: ToastKind = ''): void {
  const t: Toast = { id: ++seq, msg, kind, out: false };
  toasts.value = [...toasts.value, t];
  setTimeout(() => { toasts.value = toasts.value.map(x => (x === t ? { ...x, out: true } : x)); }, 3000);
  setTimeout(() => { toasts.value = toasts.value.filter(x => x.id !== t.id); }, 3400);
}
