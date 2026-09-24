// SPA 진입점: 가상 서버 연결 · 라우터 · 게임 내 F5 · 탭 숨김 시 일시정지
import { render } from 'preact';
import { dialog } from './app/dialog';
import { initRouter, navigate } from './app/router';
import { Session } from './app/session';
import { createInProcessLink } from './net/inProcessLink';
import './styles/style.css';
import { App } from './ui/App';

const link = createInProcessLink();
const session = new Session(link, navigate);
initRouter();

// F5 / Ctrl+R 은 게임 안의 "새로고침"으로 해석한다 (대기 중이면 순번 초기화!)
document.addEventListener('keydown', e => {
  const isReload = e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'));
  const g = session.game.value;
  if (!isReload || !g) return;
  e.preventDefault();
  if (dialog.isOpen()) return;
  g.onF5();
});

// 탭이 가려지면 게임 시간을 멈춘다
document.addEventListener('visibilitychange', () => session.setPaused(document.hidden));

render(<App session={session} />, document.getElementById('root')!);
