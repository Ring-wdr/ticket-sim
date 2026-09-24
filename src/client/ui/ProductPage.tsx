import { assignInlineVars } from '@vanilla-extract/dynamic';
import { fmt } from '../../shared/time';
import { GRADES, SHOW } from '../../shared/venue';
import type { Game } from '../app/session';
import type { CancelGame } from '../game/cancelGame';
import type { OpenGame } from '../game/openGame';
import { Calendar, Footer, Header, Poster } from './common';
import * as s from './ProductPage.css';
import { container, gradeColor, muted, swatch, table, tag } from './shared.css';

function OpenNotice() {
  return (
    <div class={s.notice}><b class={s.noticeTitle()}>티켓오픈 안내</b><p>일반예매 <em class={s.noticeEm}>2026.10.01(목) 20:00</em></p>
      <p class={muted}>※ 오픈 시간 이전에는 예매가 불가합니다. 정확한 시간은 서버시간을 기준으로 합니다.</p></div>
  );
}

function CancelNotice() {
  return (
    <div class={s.notice}><b class={s.noticeTitle({ soldout: true })}>매진</b><p>전 회차 매진되었습니다. 취소표 발생 시 예매가 가능합니다.</p>
      <p class={muted}>※ 취소마감: 관람일 전일 17:00 · 무통장입금 미입금 시 익일 자동취소</p></div>
  );
}

function OpenPanel({ g }: { g: OpenGame }) {
  const d = SHOW.dates.find(x => x.key === g.date.value);
  const loading = g.entering.value;
  return (
    <>
      <div class={s.panelTitle}>관람일 선택</div>
      <Calendar sel={g.date.value} enabled={['1010', '1011']} onPick={k => g.selectDate(k)} />
      <div class={s.panelTitle}>회차 선택</div>
      <div class={s.rounds}>{d ? <button class={s.round}>1회 {d.time}</button> : <p class={muted}>관람일을 먼저 선택하세요.</p>}</div>
      <div class={s.remain()}>{d ? '잔여석은 예매하기 이후 확인할 수 있습니다.' : ''}</div>
      <button class={s.bookBtn} disabled={loading} onClick={() => void g.clickBook()}>{loading ? '접속 중…' : '예매하기'}</button>
    </>
  );
}

function CancelPanel({ g }: { g: CancelGame }) {
  return (
    <>
      <div class={s.panelTitle}>관람일 선택</div>
      <Calendar sel="1011" enabled={['1011']} soldout={['1010']} />
      <div class={s.panelTitle}>회차 선택</div>
      <div class={s.rounds}><button class={s.round}>1회 17:00</button></div>
      <div class={s.remain({ soldout: true })}>전석 매진 · 취소표 발생 시 예매 가능</div>
      <button class={s.bookBtn} onClick={() => g.openBooking()}>예매하기</button>
    </>
  );
}

const TABS = ['공연정보', '판매정보', '관람후기 (2,481)', '기대평'];

export function ProductPage({ g }: { g: Game }) {
  return (
    <>
      <Header />
      <main class={`${container} ${s.page}`}>
        <div class={s.crumb}>홈 › 콘서트 › 국내 콘서트</div>
        <div class={s.head}><span class={tag()}>단독판매</span><h1 class={s.title}>{SHOW.title}</h1><div class={s.sub}>콘서트 · 주간 랭킹 1위 · ★ 9.8</div></div>
        <div class={s.layoutGrid}>
          <div class={s.poster}><Poster /></div>
          <div>
            <table class={s.infoTbl}><tbody>
              <tr><th class={s.infoTh}>장소</th><td class={s.infoTd}>{SHOW.venue} ›</td></tr>
              <tr><th class={s.infoTh}>공연기간</th><td class={s.infoTd}>{SHOW.period}</td></tr>
              <tr><th class={s.infoTh}>공연시간</th><td class={s.infoTd}>{SHOW.runtime}</td></tr>
              <tr><th class={s.infoTh}>관람연령</th><td class={s.infoTd}>{SHOW.age}</td></tr>
              <tr><th class={s.infoTh}>가격</th><td class={s.infoTd}><ul class={s.priceList}>{Object.values(GRADES).map(gr =>
                <li key={gr.name} class={s.priceItem}><i class={swatch} style={assignInlineVars({ [gradeColor]: gr.color })} />{gr.name}<b class={s.price}>{fmt.won(gr.price)}</b></li>)}</ul></td></tr>
              <tr><th class={s.infoTh}>혜택</th><td class={s.infoTd}>무이자할부 · 1인 최대 2매</td></tr>
            </tbody></table>
            {g.kind === 'open' ? <OpenNotice /> : <CancelNotice />}
          </div>
          <aside class={s.bookPanel}>{g.kind === 'open' ? <OpenPanel g={g} /> : <CancelPanel g={g} />}</aside>
        </div>
        <div class={s.tabs}>{TABS.map((t, i) => <a key={t} class={s.tab({ on: i === 0 })}>{t}</a>)}</div>
        <div class={s.detail}>
          <h3 class={s.detailTitle}>예매 유의사항</h3>
          <ul class={s.detailList}>
            <li>1인 1회 최대 2매까지 예매 가능합니다.</li>
            <li>무통장입금 예매 시 <b>예매 다음날 23:59</b>까지 입금하지 않으면 자동 취소됩니다.</li>
            <li>취소마감시간은 관람일 전일 17:00이며, 이후에는 취소가 불가능합니다.</li>
            <li>비정상적인 방법(매크로 등)으로 예매한 경우 예고 없이 취소될 수 있습니다.</li>
          </ul>
          <h3 class={s.detailTitle}>취소수수료</h3>
          <table class={table({ size: 'small' })}><tbody>
            <tr><td>관람일 10일전까지</td><td>4,000원</td></tr>
            <tr><td>관람일 9일전 ~ 7일전</td><td>티켓금액의 10%</td></tr>
            <tr><td>관람일 6일전 ~ 3일전</td><td>티켓금액의 20%</td></tr>
            <tr><td>관람일 2일전 ~ 1일전</td><td>티켓금액의 30%</td></tr>
          </tbody></table>
        </div>
      </main>
      <Footer />
    </>
  );
}
