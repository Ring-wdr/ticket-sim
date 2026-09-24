// 같은 스레드에서 GameHost를 돌리는 연결 (테스트 · 디버그용).
// Worker와 똑같이 메시지를 복사(structuredClone)하고 비동기로 전달해, 참조 공유나 동기 호출에 기대는 코드를 막는다.
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import { GameHost, type HostOptions } from '../../server/gameHost';
import { createLink, type ServerLink } from './link';

export function createInProcessLink(opts?: HostOptions): ServerLink {
  let deliver: (m: ServerMsg) => void = () => {};
  let closed = false;
  const host = new GameHost(m => {
    const copy = structuredClone(m);
    queueMicrotask(() => { if (!closed) deliver(copy); });
  }, opts);
  return createLink({
    send(m: ClientMsg) {
      const copy = structuredClone(m);
      queueMicrotask(() => { if (!closed) host.handle(copy); });
    },
    listen(fn) { deliver = fn; },
    close() {
      host.handle({ kind: 'req', id: 0, method: 'game.stop', params: null });
      closed = true;
    },
  });
}
