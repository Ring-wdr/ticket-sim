// 가상 서버와의 연결. 전송 방식(Worker · 같은 스레드)과 무관하게 타입이 붙은 call/on을 제공한다.
// 게임이 끝나 서버가 응답하지 않는 요청은 영원히 대기한다 (끊긴 연결처럼). 호출하는 쪽은
// 응답을 받은 뒤 "아직 같은 게임인지"를 확인하고 이어 가면 된다.
import type { ClientMsg, Method, Params, Result, ServerEvent, ServerMsg } from '../../shared/protocol';

export class ServerError extends Error {}

export interface ServerLink {
  call<M extends Method>(method: M, params: Params<M>): Promise<Result<M>>;
  /** game: 이벤트를 만든 게임 번호 (GameInfo.game) */
  on(fn: (e: ServerEvent, game: number) => void): () => void;
  dispose(): void;
}

export interface Transport {
  send(m: ClientMsg): void;
  /** 서버 메시지 수신 등록 */
  listen(fn: (m: ServerMsg) => void): void;
  close(): void;
}

export function createLink(t: Transport): ServerLink {
  let seq = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  const listeners = new Set<(e: ServerEvent, game: number) => void>();

  t.listen(m => {
    if (m.kind === 'evt') {
      for (const fn of listeners) fn(m.evt, m.game);
      return;
    }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.ok) p.resolve(m.result); else p.reject(new ServerError(m.error));
  });

  return {
    call<M extends Method>(method: M, params: Params<M>): Promise<Result<M>> {
      const id = ++seq;
      return new Promise<Result<M>>((resolve, reject) => {
        pending.set(id, { resolve: v => resolve(v as Result<M>), reject });
        t.send({ kind: 'req', id, method, params });
      });
    },
    on(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    dispose() {
      pending.clear();
      listeners.clear();
      t.close();
    },
  };
}
