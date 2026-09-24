// 사이트 공통: 헤더 · 푸터 · 포스터 · 달력
import type { ComponentChildren } from 'preact';
import { p2 } from '../../shared/time';
import { dialog } from '../app/dialog';
import { navigate } from '../app/router';
import { useSession } from './context';
import { cx } from './cx';

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

export function Header() {
  return (
    <header class="site-header"><div class="container hd-in">
      <SiteLink class="logo" href="#/"><span class="logo-mark">T</span>티키타카<small>TICKET</small></SiteLink>
      <nav class="gnb"><a class="on">콘서트</a><a>뮤지컬</a><a>연극</a><a>클래식/무용</a><a>전시/행사</a><a>스포츠</a></nav>
      <div class="hd-util"><span class="search">🔍 공연, 아티스트를 검색하세요</span><span>게스트님</span><span>마이티켓</span></div>
    </div></header>
  );
}

export function Footer() {
  return (
    <footer class="site-footer"><div class="container">
      <p><b>티키타카 TICKET</b> 은 가상의 티켓 예매 시뮬레이터입니다. 실제 예매 · 결제는 이루어지지 않으며, 공연 · 아티스트 · 공연장은 모두 가상입니다.</p>
      <p class="muted">모든 서버 동작(대기열 · 좌석 선점 · MQ)은 브라우저 안에서 시뮬레이션됩니다.</p>
    </div></footer>
  );
}

export function Poster({ mini = false }: { mini?: boolean }) {
  return (
    <div class={cx('poster', mini && 'poster-mini')}>
      <div class="poster-top">2026 WORLD TOUR</div>
      <div class="poster-title">LUMINA</div>
      <div class="poster-sub">〈AFTERGLOW〉<br />IN SEOUL</div>
      <div class="poster-foot">2026.10.10 — 10.11 · 티키타카 아레나</div>
    </div>
  );
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function Calendar({ sel, enabled, soldout = [], onPick }: {
  sel: string | null; enabled: string[]; soldout?: string[]; onPick?: (key: string) => void;
}) {
  const first = new Date(Date.UTC(2026, 9, 1)).getUTCDay();
  return (
    <div class="cal">
      <div class="cal-head"><button disabled>‹</button><b>2026.10</b><button disabled>›</button></div>
      <div class="cal-grid">
        {DOW.map(d => <span class="dow" key={d}>{d}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: 31 }, (_, i) => {
          const d = i + 1, key = '10' + p2(d), on = enabled.includes(key);
          return (
            <button key={key} class={cx('cal-day', on && 'on', sel === key && 'sel', soldout.includes(key) && 'so')}
              disabled={!on} onClick={() => onPick?.(key)}>{d}</button>
          );
        })}
      </div>
    </div>
  );
}
