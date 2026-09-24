import { useState } from 'preact/hooks';
import type { DiffKey, ModeKind } from '../../shared/model';
import { Footer, Header, Poster } from './common';
import { useSession } from './context';
import * as s from './HomePage.css';
import { btn, container, tag } from './shared.css';

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
    <article class={s.modeCard}>
      <div class={s.cardHead}><span class={s.cardIcon}>{icon}</span><div><h3 class={s.cardTitle}>{title}</h3><p class={s.cardDesc}>{desc}</p></div></div>
      <ul class={s.cardPoints}>{points.map(p => <li key={p}>{p}</li>)}</ul>
      <div class={s.seg}>
        {DIFFS[kind].map(([k, label, sub]) => (
          <label key={k} class={s.segLabel}>
            <input class={s.segInput} type="radio" name={`diff-${kind}`} value={k} checked={diff === k} onChange={() => setDiff(k)} />
            <span class={s.segBox({ on: diff === k })}><b>{label}</b><small class={s.segSub}>{sub}</small></span>
          </label>
        ))}
      </div>
      <div class={s.cardMeta}>{meta}</div>
      <button class={btn({ block: true })} onClick={() => void session.start(kind, diff)}>{cta}</button>
    </article>
  );
}

const OPENS: [string, string, boolean][] = [
  ['10.01(목) 20:00', '2026 LUMINA WORLD TOUR 〈AFTERGLOW〉 IN SEOUL', true],
  ['10.06(화) 14:00', '뮤지컬 〈시계탑의 밤〉 2차 티켓오픈', false],
  ['10.08(목) 18:00', '밴드 NOVA SEASON 단독 콘서트 〈FREQUENCY〉', false],
];

const HOW: [string, string][] = [
  ['1. 대기열 (Redis ZSET)', '도착 시각을 score로 ZADD, 내 순번은 ZRANK'],
  ['2. 입장 스케줄러', '1초마다 ZPOPMIN으로 N명씩 꺼내 active:user TTL 부여'],
  ['3. 원자적 좌석 선점 (Lua)', '좌석 락 + 재고 차감을 한 번에. 실패하면 "이미 선택된 좌석입니다."'],
  ['4. MQ → Worker → DB', '결제 확정은 즉시 응답, 저장은 비동기'],
];

export function HomePage() {
  return (
    <>
      <Header />
      <main>
        <section class={s.hero}><div class={`${container} ${s.heroIn}`}>
          <div>
            <span class={s.badge}>TICKETING SIMULATOR</span>
            <h1 class={s.heroTitle}>이번엔 진짜 잡는다.<br />실전 같은 티켓팅 연습장</h1>
            <p class={s.heroText}>대기열, 보안문자, 그리고 <b>"이미 선택된 좌석입니다."</b>까지.<br />브라우저 안의 가상 서버 위에서 수만 명의 봇과 경쟁해 보세요.</p>
          </div>
          <div class={s.heroPoster}><Poster /></div>
        </div></section>

        <section class={container}>
          <h2 class={s.secTitle}>연습 모드</h2>
          <div class={s.modeCards}>
            <ModeCard kind="open" icon="🎫" title="오픈 티켓팅" desc="20:00:00 정각, 수만~백만 명과 동시에 예매하기 버튼을 누릅니다."
              points={['서버시간 vs 내 PC 시계 오차', '대기열 순번 · 가변 주기 폴링', '보안문자 → 좌석 선점 → 결제까지 제한시간 안에']}
              meta="⏱ 플레이 약 3~5분" cta="오픈 티켓팅 시작" />
            <ModeCard kind="cancel" icon="🔁" title="취켓팅" desc="전석 매진. 취소표가 풀리는 순간을 노립니다. 열흘을 약 8분으로 압축했습니다."
              points={['자정 무통장 입금기한 마감 물량', '취소수수료 오르기 전날 밤의 취소 러시', '새로고침 과다 시 접근 제한']}
              meta="⏱ 플레이 최대 약 8~10분" cta="취켓팅 시작" />
          </div>
        </section>

        <section class={container}>
          <h2 class={s.secTitle}>티켓오픈 소식</h2>
          <ul class={s.openList}>
            {OPENS.map(([date, title, exclusive]) => (
              <li key={title} class={s.openItem}>
                <span class={s.openDate}>{date}</span><b>{title}</b>
                <span class={tag({ tone: exclusive ? 'hot' : 'gray' })}>{exclusive ? '단독판매' : '일반'}</span>
              </li>
            ))}
          </ul>
        </section>

        <section class={container}>
          <h2 class={s.secTitle}>이 시뮬레이터 안의 서버는 이렇게 동작해요</h2>
          <ol class={s.howSteps}>
            {HOW.map(([t, d]) => <li key={t} class={s.howStep}><b>{t}</b><span class={s.howDesc}>{d}</span></li>)}
          </ol>
          <p class={s.howNote}>게임 중 오른쪽 아래 <b>🛠 서버 들여다보기</b>로 실시간 상태를 볼 수 있어요.</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
