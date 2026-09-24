import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Session } from '../app/session';

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('SessionContext missing');
  return s;
}
