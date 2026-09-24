// SPA 진입점. UI 이전(4단계) 전까지는 안내 화면만 보여 준다.
import { render } from 'preact';
import '../../prototype/css/style.css';

function Placeholder() {
  return (
    <main style={{ maxWidth: 640, margin: '80px auto', padding: '0 16px', lineHeight: 1.6 }}>
      <h1>티키타카 TICKET · TypeScript 이전 중</h1>
      <p>가상 서버 코어(<code>src/sim</code>)는 TypeScript로 옮겨졌고 테스트로 검증됩니다. UI는 아직 이전 전입니다.</p>
      <p><a href="/prototype/index.html">▶ 기존 프로토타입으로 플레이하기</a></p>
    </main>
  );
}

render(<Placeholder />, document.getElementById('root')!);
