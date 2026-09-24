// 화면 골격: 게임 상태에서 레이아웃(HUD · 오른쪽 패널 · 팝업 · 들여다보기)을 끌어내 그린다.
// 레이아웃 치수는 shell의 모드 변형이 CSS 변수로 정한다 (styles/theme.css.ts의 layoutVar).
import { useEffect } from 'preact/hooks';
import { dialog } from '../app/dialog';
import { navigate, route } from '../app/router';
import type { Session } from '../app/session';
import { BookingWindow } from './BookingWindow';
import * as s from './App.css';
import { SessionContext } from './context';
import { HomePage } from './HomePage';
import { Hud, Side } from './Hud';
import { Dialogs, Inspector, Toasts } from './Overlays';
import { ProductPage } from './ProductPage';
import { QueueWindow } from './QueueWindow';
import { ResultPage } from './ResultPage';

/** F5 / Ctrl+R 은 게임 안의 "새로고침"으로 해석하고(대기 중이면 순번 초기화!), 탭이 가려지면 게임 시간을 멈춘다 */
function useGameKeys(session: Session): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const isReload = e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'));
      const g = session.game.value;
      if (!isReload || !g) return;
      e.preventDefault();
      if (!dialog.isOpen()) g.onF5();
    };
    const onVis = (): void => session.setPaused(document.hidden);
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [session]);
}

export function App({ session }: { session: Session }) {
  const r = route.value;
  const g = session.game.value;
  const onGamePage = g != null && r === '/' + g.kind;
  useGameKeys(session);

  // 게임 도중 다른 페이지로 이동하면(뒤로가기 등) 게임 종료, 게임 없이 게임 주소로 오면 홈으로
  useEffect(() => {
    window.scrollTo(0, 0);
    if (g && !onGamePage) session.end();
    if (!g && (r === '/open' || r === '/cancel')) navigate('/');
  }, [r]);

  const page = onGamePage ? <ProductPage g={g} /> : r === '/result' ? <ResultPage /> : r === '/' ? <HomePage /> : null;
  const flow = g?.flow.value;

  return (
    <SessionContext.Provider value={session}>
      <div class={s.shell({ mode: g?.kind ?? 'none' })}>
        {g && <div class={s.hud}><Hud g={g} /></div>}
        <div class={s.page({ reloading: g?.kind === 'open' && g.reloading.value })}>{page}</div>
        {g && <Side g={g} />}
        {g?.kind === 'open' && g.queue.value && <QueueWindow g={g} />}
        {flow && <BookingWindow key={flow} flow={flow} />}
        {g && <Inspector g={g} />}
        <Dialogs />
        <Toasts />
      </div>
    </SessionContext.Provider>
  );
}
