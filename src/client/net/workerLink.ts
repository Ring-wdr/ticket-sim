// 가상 서버를 Web Worker에서 돌리는 연결 (기본값)
import type { ServerMsg } from '../../shared/protocol';
import { createLink, type ServerLink } from './link';

export function createWorkerLink(): ServerLink {
  const worker = new Worker(new URL('../../server/worker.ts', import.meta.url), { type: 'module', name: 'ticket-sim-server' });
  worker.addEventListener('error', e => console.error('[server worker]', e.message));
  return createLink({
    send: m => worker.postMessage(m),
    listen: fn => worker.addEventListener('message', (e: MessageEvent<ServerMsg>) => fn(e.data)),
    close: () => worker.terminate(),
  }, 'worker');
}
