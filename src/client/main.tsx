// SPA 진입점: 가상 서버(Web Worker) 연결 · 라우터
import { render } from 'preact';
import { initRouter, navigate } from './app/router';
import { Session } from './app/session';
import { createWorkerLink } from './net/workerLink';
// 스타일 순서: 전역 → 공용 조각 → 컴포넌트 (같은 우선순위면 나중 규칙이 이기므로 공용 조각을 먼저 싣는다)
import './styles/global.css';
import './ui/shared.css';
import { App } from './ui/App';

// 기본은 Web Worker. ?server=main 이면 같은 스레드에서 돌린다 (디버거로 서버 코드를 따라갈 때)
// (같은 스레드 연결은 동적 import — 평소 메인 번들에 시뮬레이션 코드가 들어가지 않게)
const link = new URLSearchParams(location.search).get('server') === 'main'
  ? (await import('./net/inProcessLink')).createInProcessLink()
  : createWorkerLink();
const session = new Session(link, navigate);
initRouter();

render(<App session={session} />, document.getElementById('root')!);
