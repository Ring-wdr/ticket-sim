// 사이트 공통: 헤더 · 푸터 · 포스터 · 달력
import type { ComponentChildren } from 'preact';
import { p2 } from '../../shared/time';
import { dialog } from '../app/dialog';
import { navigate } from '../app/router';
import * as s from './common.css';
import { useSession } from './context';
import { container, logoMark, muted } from './shared.css';

/** 게임 중에 사이트 내 다른 페이지로 가면 게임을 끝낼지 묻는다 */
function SiteLink({ href, class: cls, children }: { href: string; class?: string; children: ComponentChildren }) {
  const session = useSession();
  const onClick = async (e: MouseEvent): Promise<void> => {
    if (!session.game.value) return;
    e.preventDefault();
    if (await dialog.confirm('진행 중인 게임을 종료하고 이동하시겠습니까?')) {
      session.end();
      navigate(href.slice(1));
    }
  };
  return <a class={cls} href={href} onClick={e => void onClick(e)}>{children}</a>;
}

const GNB = ['콘서트', '뮤지컬', '연극', '클래식/무용', '전시/행사', '스포츠'];

export function Header() {
  return (
    <header class={s.header}><div class={`${container} ${s.headerIn}`}>
      <SiteLink class={s.logo} href="#/"><span class={logoMark()}>T</span>티키타카<small class={s.logoSub}>TICKET</small></SiteLink>
      <nav class={s.gnb}>{GNB.map((label, i) => <a key={label} class={s.gnbItem({ on: i === 0 })}>{label}</a>)}</nav>
      <div class={s.util}><span class={s.search}>🔍 공연, 아티스트를 검색하세요</span><span>게스트님</span><span>마이티켓</span></div>
    </div></header>
  );
}

export function Footer() {
  return (
    <footer class={s.footer}><div class={container}>
      <p><b>티키타카 TICKET</b> 은 가상의 티켓 예매 시뮬레이터입니다. 실제 예매 · 결제는 이루어지지 않으며, 공연 · 아티스트 · 공연장은 모두 가상입니다.</p>
      <p class={muted}>모든 서버 동작(대기열 · 좌석 선점 · MQ)은 브라우저 안에서 시뮬레이션됩니다.</p>
    </div></footer>
  );
}

export function Poster({ mini = false }: { mini?: boolean }) {
  return (
    <div class={s.poster({ mini })}>
      {!mini && <div class={s.posterTop}>2026 WORLD TOUR</div>}
      <div class={s.posterTitle({ mini })}>LUMINA</div>
      {!mini && <>
        <div class={s.posterSub}>〈AFTERGLOW〉<br />IN SEOUL</div>
        <div class={s.posterFoot}>2026.10.10 — 10.11 · 티키타카 아레나</div>
      </>}
    </div>
  );
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function Calendar({ sel, enabled, soldout = [], onPick }: {
  sel: string | null; enabled: string[]; soldout?: string[]; onPick?: (key: string) => void;
}) {
  const first = new Date(Date.UTC(2026, 9, 1)).getUTCDay();
  return (
    <div class={s.cal}>
      <div class={s.calHead}><button class={s.calNav} disabled>‹</button><b>2026.10</b><button class={s.calNav} disabled>›</button></div>
      <div class={s.calGrid}>
        {DOW.map(d => <span class={s.dow} key={d}>{d}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: 31 }, (_, i) => {
          const d = i + 1, key = '10' + p2(d), on = enabled.includes(key);
          return (
            <button key={key} class={s.calDay({ on, sel: sel === key, soldout: soldout.includes(key) })}
              disabled={!on} onClick={() => onPick?.(key)}>{d}</button>
          );
        })}
      </div>
    </div>
  );
}
