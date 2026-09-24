import { fmt } from '../../shared/time';
import { GRADES, SHOW } from '../../shared/venue';
import type { Game } from '../app/session';
import type { CancelGame } from '../game/cancelGame';
import type { OpenGame } from '../game/openGame';
import { Calendar, Footer, Header, Poster } from './common';

function OpenNotice() {
  return (
    <div class="notice-box"><b>티켓오픈 안내</b><p>일반예매 <em>2026.10.01(목) 20:00</em></p>
      <p class="muted">※ 오픈 시간 이전에는 예매가 불가합니다. 정확한 시간은 서버시간을 기준으로 합니다.</p></div>
  );
}

function CancelNotice() {
  return (
    <div class="notice-box soldout"><b>매진</b><p>전 회차 매진되었습니다. 취소표 발생 시 예매가 가능합니다.</p>
      <p class="muted">※ 취소마감: 관람일 전일 17:00 · 무통장입금 미입금 시 익일 자동취소</p></div>
  );
}

function OpenPanel({ g }: { g: OpenGame }) {
  const d = SHOW.dates.find(x => x.key === g.date.value);
  const loading = g.entering.value;
  return (
    <>
      <div class="bp-title">관람일 선택</div>
      <Calendar sel={g.date.value} enabled={['1010', '1011']} onPick={k => g.selectDate(k)} />
      <div class="bp-title">회차 선택</div>
      <div class="bp-rounds">{d ? <button class="round sel">1회 {d.time}</button> : <p class="muted">관람일을 먼저 선택하세요.</p>}</div>
      <div class="bp-remain">{d ? '잔여석은 예매하기 이후 확인할 수 있습니다.' : ''}</div>
      <button class={`btn-book ${loading ? 'loading' : ''}`} onClick={() => void g.clickBook()}>{loading ? '접속 중…' : '예매하기'}</button>
    </>
  );
}

function CancelPanel({ g }: { g: CancelGame }) {
  return (
    <>
      <div class="bp-title">관람일 선택</div>
      <Calendar sel="1011" enabled={['1011']} soldout={['1010']} />
      <div class="bp-title">회차 선택</div>
      <div class="bp-rounds"><button class="round sel">1회 17:00</button></div>
      <div class="bp-remain soldout">전석 매진 · 취소표 발생 시 예매 가능</div>
      <button class="btn-book" onClick={() => g.openBooking()}>예매하기</button>
    </>
  );
}

export function ProductPage({ g }: { g: Game }) {
  return (
    <>
      <Header />
      <main class="container prod-page">
        <div class="crumb">홈 › 콘서트 › 국내 콘서트</div>
        <div class="prod-head"><span class="tag">단독판매</span><h1>{SHOW.title}</h1><div class="prod-sub">콘서트 · 주간 랭킹 1위 · ★ 9.8</div></div>
        <div class="prod">
          <div class="prod-poster"><Poster /></div>
          <div class="prod-info">
            <table class="info-tbl"><tbody>
              <tr><th>장소</th><td>{SHOW.venue} ›</td></tr>
              <tr><th>공연기간</th><td>{SHOW.period}</td></tr>
              <tr><th>공연시간</th><td>{SHOW.runtime}</td></tr>
              <tr><th>관람연령</th><td>{SHOW.age}</td></tr>
              <tr><th>가격</th><td><ul class="price-list">{Object.values(GRADES).map(gr =>
                <li key={gr.name}><i style={{ background: gr.color }} />{gr.name}<b>{fmt.won(gr.price)}</b></li>)}</ul></td></tr>
              <tr><th>혜택</th><td>무이자할부 · 1인 최대 2매</td></tr>
            </tbody></table>
            {g.kind === 'open' ? <OpenNotice /> : <CancelNotice />}
          </div>
          <aside class="book-panel">{g.kind === 'open' ? <OpenPanel g={g} /> : <CancelPanel g={g} />}</aside>
        </div>
        <div class="prod-tabs"><a class="on">공연정보</a><a>판매정보</a><a>관람후기 (2,481)</a><a>기대평</a></div>
        <div class="prod-detail">
          <h3>예매 유의사항</h3>
          <ul>
            <li>1인 1회 최대 2매까지 예매 가능합니다.</li>
            <li>무통장입금 예매 시 <b>예매 다음날 23:59</b>까지 입금하지 않으면 자동 취소됩니다.</li>
            <li>취소마감시간은 관람일 전일 17:00이며, 이후에는 취소가 불가능합니다.</li>
            <li>비정상적인 방법(매크로 등)으로 예매한 경우 예고 없이 취소될 수 있습니다.</li>
          </ul>
          <h3>취소수수료</h3>
          <table class="tbl small"><tbody>
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
