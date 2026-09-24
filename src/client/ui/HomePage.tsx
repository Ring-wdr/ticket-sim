import { useState } from 'preact/hooks';
import type { DiffKey, ModeKind } from '../../shared/model';
import { Footer, Header, Poster } from './common';
import { useSession } from './context';

const DIFFS: Record<ModeKind, [DiffKey, string, string][]> = {
  open: [['easy', '쉬움', '동시접속 2만'], ['normal', '보통', '동시접속 15만'], ['hard', '어려움', '동시접속 100만']],
  cancel: [['easy', '쉬움', '봇 반응 느림'], ['normal', '보통', '봇 반응 보통'], ['hard', '어려움', '봇 반응 빠름']],
};

function ModeCard({ kind, icon, title, desc, points, meta, cta }: {
  kind: ModeKind; icon: string; title: string; desc: string; points: string[]; meta: string; cta: string;
}) {
  const session = useSession();
  const [diff, setDiff] = useState<DiffKey>('normal');
  return (
    <article class="mode-card">
      <div class="mc-head"><span class="mc-ico">{icon}</span><div><h3>{title}</h3><p>{desc}</p></div></div>
      <ul class="mc-points">{points.map(p => <li key={p}>{p}</li>)}</ul>
      <div class="seg">
        {DIFFS[kind].map(([k, label, sub]) => (
          <label key={k}>
            <input type="radio" name={`diff-${kind}`} value={k} checked={diff === k} onChange={() => setDiff(k)} />
            <span><b>{label}</b><small>{sub}</small></span>
          </label>
        ))}
      </div>
      <div class="mc-meta">{meta}</div>
      <button class="btn-primary btn-block" onClick={() => void session.start(kind, diff)}>{cta}</button>
    </article>
  );
}

export function HomePage() {
  return (
    <>
      <Header />
      <main class="home">
        <section class="hero"><div class="container hero-in">
          <div class="hero-copy">
            <span class="badge">TICKETING SIMULATOR</span>
            <h1>이번엔 진짜 잡는다.<br />실전 같은 티켓팅 연습장</h1>
            <p>대기열, 보안문자, 그리고 <b>"이미 선택된 좌석입니다."</b>까지.<br />브라우저 안의 가상 서버 위에서 수만 명의 봇과 경쟁해 보세요.</p>
          </div>
          <div class="hero-poster"><Poster /></div>
        </div></section>

        <section class="container modes">
          <h2 class="sec-title">연습 모드</h2>
          <div class="mode-cards">
            <ModeCard kind="open" icon="🎫" title="오픈 티켓팅" desc="20:00:00 정각, 수만~백만 명과 동시에 예매하기 버튼을 누릅니다."
              points={['서버시간 vs 내 PC 시계 오차', '대기열 순번 · 가변 주기 폴링', '보안문자 → 좌석 선점 → 결제까지 제한시간 안에']}
              meta="⏱ 플레이 약 3~5분" cta="오픈 티켓팅 시작" />
            <ModeCard kind="cancel" icon="🔁" title="취켓팅" desc="전석 매진. 취소표가 풀리는 순간을 노립니다. 열흘을 약 8분으로 압축했습니다."
              points={['자정 무통장 입금기한 마감 물량', '취소수수료 오르기 전날 밤의 취소 러시', '새로고침 과다 시 접근 제한']}
              meta="⏱ 플레이 최대 약 8~10분" cta="취켓팅 시작" />
          </div>
        </section>

        <section class="container">
          <h2 class="sec-title">티켓오픈 소식</h2>
          <ul class="open-list">
            <li><span class="ol-date">10.01(목) 20:00</span><b>2026 LUMINA WORLD TOUR 〈AFTERGLOW〉 IN SEOUL</b><span class="tag">단독판매</span></li>
            <li><span class="ol-date">10.06(화) 14:00</span><b>뮤지컬 〈시계탑의 밤〉 2차 티켓오픈</b><span class="tag gray">일반</span></li>
            <li><span class="ol-date">10.08(목) 18:00</span><b>밴드 NOVA SEASON 단독 콘서트 〈FREQUENCY〉</b><span class="tag gray">일반</span></li>
          </ul>
        </section>

        <section class="container how">
          <h2 class="sec-title">이 시뮬레이터 안의 서버는 이렇게 동작해요</h2>
          <ol class="how-steps">
            <li><b>1. 대기열 (Redis ZSET)</b><span>도착 시각을 score로 ZADD, 내 순번은 ZRANK</span></li>
            <li><b>2. 입장 스케줄러</b><span>1초마다 ZPOPMIN으로 N명씩 꺼내 active:user TTL 부여</span></li>
            <li><b>3. 원자적 좌석 선점 (Lua)</b><span>좌석 락 + 재고 차감을 한 번에. 실패하면 "이미 선택된 좌석입니다."</span></li>
            <li><b>4. MQ → Worker → DB</b><span>결제 확정은 즉시 응답, 저장은 비동기</span></li>
          </ol>
          <p class="how-note">게임 중 오른쪽 아래 <b>🛠 서버 들여다보기</b>로 실시간 상태를 볼 수 있어요.</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
