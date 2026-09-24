// 화면 골격: CSS가 기대하는 고정 레이어(#hud · #app · #side · #layer · #inspector · #dialogs · #toasts)와 페이지 라우팅
import { useEffect } from 'preact/hooks';
import { navigate, route } from '../app/router';
import type { Session } from '../app/session';
import { BookingWindow } from './BookingWindow';
import { SessionContext } from './context';
import { HomePage } from './HomePage';
import { Hud, Side } from './Hud';
import { Dialogs, Inspector, Toasts } from './Overlays';
import { ProductPage } from './ProductPage';
import { QueueWindow } from './QueueWindow';
import { ResultPage } from './ResultPage';

export function App({ session }: { session: Session }) {
  const r = route.value;
  const g = session.game.value;
  const onGamePage = g != null && r === '/' + g.kind;

  // 게임 도중 다른 페이지로 이동하면(뒤로가기 등) 게임 종료, 게임 없이 게임 주소로 오면 홈으로
  useEffect(() => {
    window.scrollTo(0, 0);
    if (g && !onGamePage) session.end();
    if (!g && (r === '/open' || r === '/cancel')) navigate('/');
  }, [r]);

  useEffect(() => {
    const cl = document.body.classList;
    cl.toggle('in-game', g != null);
    cl.toggle('mode-open', g?.kind === 'open');
    cl.toggle('mode-cancel', g?.kind === 'cancel');
  }, [g]);

  const page = onGamePage ? <ProductPage g={g} /> : r === '/result' ? <ResultPage /> : r === '/' ? <HomePage /> : null;
  const flow = g?.flow.value;

  return (
    <SessionContext.Provider value={session}>
      <div id="hud">{g && <Hud g={g} />}</div>
      <div id="app" class={g?.kind === 'open' && g.reloading.value ? 'reloading' : ''}>{page}</div>
      <div id="side">{g && <Side g={g} />}</div>
      <div id="layer">
        {g?.kind === 'open' && g.queue.value && <QueueWindow g={g} />}
        {flow && <BookingWindow key={flow} flow={flow} />}
      </div>
      <Inspector />
      <Dialogs />
      <Toasts />
    </SessionContext.Provider>
  );
}
