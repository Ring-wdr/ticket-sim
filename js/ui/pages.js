// 사이트 페이지 템플릿: 홈 · 상품 상세 · 결과
(function (TS) {
  const P = TS.pages = {};

  P.header = () => `<header class="site-header"><div class="container hd-in">
    <a class="logo" href="#/" data-nav="home"><span class="logo-mark">T</span>티키타카<small>TICKET</small></a>
    <nav class="gnb"><a class="on">콘서트</a><a>뮤지컬</a><a>연극</a><a>클래식/무용</a><a>전시/행사</a><a>스포츠</a></nav>
    <div class="hd-util"><span class="search">🔍 공연, 아티스트를 검색하세요</span><span>게스트님</span><span>마이티켓</span></div>
  </div></header>`;

  P.footer = () => `<footer class="site-footer"><div class="container">
    <p><b>티키타카 TICKET</b> 은 가상의 티켓 예매 시뮬레이터입니다. 실제 예매 · 결제는 이루어지지 않으며, 공연 · 아티스트 · 공연장은 모두 가상입니다.</p>
    <p class="muted">모든 서버 동작(대기열 · 좌석 선점 · MQ)은 브라우저 안에서 시뮬레이션됩니다.</p>
  </div></footer>`;

  const diffSeg = (kind, items) => `<div class="seg" data-kind="${kind}">${items.map(([k, label, desc], i) =>
    `<label><input type="radio" name="diff-${kind}" value="${k}" ${i === 1 ? 'checked' : ''}><span><b>${label}</b><small>${desc}</small></span></label>`).join('')}</div>`;

  P.home = () => `${P.header()}<main class="home">
    <section class="hero"><div class="container hero-in">
      <div class="hero-copy">
        <span class="badge">TICKETING SIMULATOR</span>
        <h1>이번엔 진짜 잡는다.<br>실전 같은 티켓팅 연습장</h1>
        <p>대기열, 보안문자, 그리고 <b>"이미 선택된 좌석입니다."</b>까지.<br>브라우저 안의 가상 서버 위에서 수만 명의 봇과 경쟁해 보세요.</p>
      </div>
      <div class="hero-poster">${TS.poster()}</div>
    </div></section>

    <section class="container modes">
      <h2 class="sec-title">연습 모드</h2>
      <div class="mode-cards">
        <article class="mode-card">
          <div class="mc-head"><span class="mc-ico">🎫</span><div><h3>오픈 티켓팅</h3><p>20:00:00 정각, 수만~백만 명과 동시에 예매하기 버튼을 누릅니다.</p></div></div>
          <ul class="mc-points"><li>서버시간 vs 내 PC 시계 오차</li><li>대기열 순번 · 가변 주기 폴링</li><li>보안문자 → 좌석 선점 → 결제까지 제한시간 안에</li></ul>
          ${diffSeg('open', [['easy', '쉬움', '동시접속 2만'], ['normal', '보통', '동시접속 15만'], ['hard', '어려움', '동시접속 100만']])}
          <div class="mc-meta">⏱ 플레이 약 3~5분</div>
          <button class="btn-primary btn-block" data-start="open">오픈 티켓팅 시작</button>
        </article>
        <article class="mode-card">
          <div class="mc-head"><span class="mc-ico">🔁</span><div><h3>취켓팅</h3><p>전석 매진. 취소표가 풀리는 순간을 노립니다. 열흘을 약 8분으로 압축했습니다.</p></div></div>
          <ul class="mc-points"><li>자정 무통장 입금기한 마감 물량</li><li>취소수수료 오르기 전날 밤의 취소 러시</li><li>새로고침 과다 시 접근 제한</li></ul>
          ${diffSeg('cancel', [['easy', '쉬움', '봇 반응 느림'], ['normal', '보통', '봇 반응 보통'], ['hard', '어려움', '봇 반응 빠름']])}
          <div class="mc-meta">⏱ 플레이 최대 약 8~10분</div>
          <button class="btn-primary btn-block" data-start="cancel">취켓팅 시작</button>
        </article>
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
  </main>${P.footer()}`;

  P.calendar = ({ sel, enabled, soldout = [] }) => {
    let h = `<div class="cal"><div class="cal-head"><button disabled>‹</button><b>2026.10</b><button disabled>›</button></div><div class="cal-grid">`;
    h += ['일', '월', '화', '수', '목', '금', '토'].map(d => `<span class="dow">${d}</span>`).join('');
    const first = new Date(Date.UTC(2026, 9, 1)).getUTCDay();
    for (let i = 0; i < first; i++) h += '<span></span>';
    for (let d = 1; d <= 31; d++) {
      const key = '10' + TS.fmt.p2(d);
      const on = enabled.includes(key);
      h += `<button class="cal-day ${on ? 'on' : ''} ${sel === key ? 'sel' : ''} ${soldout.includes(key) ? 'so' : ''}" ${on ? `data-date="${key}"` : 'disabled'}>${d}</button>`;
    }
    return h + '</div></div>';
  };

  P.product = g => `${P.header()}<main class="container prod-page">
    <div class="crumb">홈 › 콘서트 › 국내 콘서트</div>
    <div class="prod-head"><span class="tag">단독판매</span><h1>${TS.esc(TS.SHOW.title)}</h1><div class="prod-sub">콘서트 · 주간 랭킹 1위 · ★ 9.8</div></div>
    <div class="prod">
      <div class="prod-poster">${TS.poster()}</div>
      <div class="prod-info">
        <table class="info-tbl"><tbody>
          <tr><th>장소</th><td>${TS.SHOW.venue} ›</td></tr>
          <tr><th>공연기간</th><td>${TS.SHOW.period}</td></tr>
          <tr><th>공연시간</th><td>${TS.SHOW.runtime}</td></tr>
          <tr><th>관람연령</th><td>${TS.SHOW.age}</td></tr>
          <tr><th>가격</th><td><ul class="price-list">${Object.values(TS.GRADES).map(gr => `<li><i style="background:${gr.color}"></i>${gr.name}<b>${TS.fmt.won(gr.price)}</b></li>`).join('')}</ul></td></tr>
          <tr><th>혜택</th><td>무이자할부 · 1인 최대 2매</td></tr>
        </tbody></table>
        ${g.noticeHtml()}
      </div>
      <aside class="book-panel" id="bookPanel">${g.panelHtml()}</aside>
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
  </main>${P.footer()}`;

  // ---------- 결과 ----------
  const GRADE_BY_SEAT = { VIP: 'S', R: 'A', S: 'B' };
  P.result = r => {
    if (!r) return `${P.header()}<main class="container result-page"><p>결과가 없습니다. <a href="#/">홈으로</a></p></main>`;
    const best = r.seats.length ? r.seats.map(s => s.grade).sort((a, b) => ['VIP', 'R', 'S'].indexOf(a) - ['VIP', 'R', 'S'].indexOf(b))[0] : null;
    const rank = r.success ? GRADE_BY_SEAT[best] : 'F';
    const title = r.success ? '🎉 예매 성공!' : '😭 예매 실패';
    const rows = r.kind === 'open' ? openRows(r) : cancelRows(r);
    const comment = r.kind === 'open' ? openComment(r) : cancelComment(r);
    return `${P.header()}<main class="container result-page">
      <div class="res-card ${r.success ? 'ok' : 'fail'}">
        <div class="res-top">
          <div><span class="res-mode">${r.kind === 'open' ? '🎫 오픈 티켓팅' : '🔁 취켓팅'} · ${r.diff}</span><h1>${title}</h1><p>${comment}</p></div>
          <div class="res-rank rank-${rank}">${rank}</div>
        </div>
        ${r.success ? `<div class="res-ticket">${TS.poster('poster-mini')}<div>
          <b>${TS.esc(TS.SHOW.title)}</b><span>${TS.esc(r.dateLabel)}</span>
          ${r.seats.map(s => `<em style="--c:${TS.GRADES[s.grade].color}">${TS.GRADES[s.grade].name} · ${TS.esc(s.label)}</em>`).join('')}
          <small>예매번호 ${r.bookingNo || '-'}</small></div></div>` : `<div class="res-reason">${TS.esc(r.reasonText || '')}</div>`}
        <table class="res-tbl"><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>
        <div class="res-actions">
          <button class="btn-primary" data-again="${r.kind}" data-diff="${r.diffKey}">다시 도전</button>
          <button class="btn-line" data-copy>결과 복사</button>
          <a class="btn-line" href="#/">홈으로</a>
        </div>
      </div>
    </main>${P.footer()}`;
  };

  function openRows(r) {
    const out = [];
    if (r.reactionMs != null) {
      out.push(['서버 도착 시각', `20:00:00 ${TS.fmt.signedSec(r.reactionMs)}`]);
      out.push(['클릭 시각 (서버 기준)', `20:00:00 ${TS.fmt.signedSec(r.clickErrMs)} <small>네트워크 지연 ${TS.fmt.num(r.reactionMs - r.clickErrMs)}ms</small>`]);
    } else out.push(['서버 도착 시각', '대기열 진입 실패']);
    out.push(['내 PC 시계 오차', `${TS.fmt.signedSec(r.pcOffset)} <small>(서버보다 ${r.pcOffset >= 0 ? '빠름' : '느림'})</small>`]);
    out.push(['오픈 전 클릭', `${r.early}회`]);
    if (r.rank != null) out.push(['최초 대기순번', `${TS.fmt.num(r.rank)}번째`]);
    if (r.waitSec != null) out.push(['대기 시간', `${r.waitSec.toFixed(1)}초`]);
    if (r.soldPctAtEntry != null) out.push(['입장 시점 판매율', `${Math.round(r.soldPctAtEntry * 100)}%`]);
    out.push(['"이미 선택된 좌석입니다."', `${r.taken}회`]);
    out.push(['보안문자 오입력', `${r.captchaFails}회`]);
    out.push(['대기열 재진입', `${r.requeues}회`]);
    if (r.persistLagMs != null) out.push(['예매 DB 저장 지연 (MQ)', `${TS.fmt.num(r.persistLagMs)}ms`]);
    out.push(['총 소요 (오픈 기준)', `${Math.round(r.elapsed)}초`]);
    return out;
  }
  function cancelRows(r) {
    return [
      ['예매 시각 (게임 내)', r.gotAt ? `${TS.fmt.mdd(r.gotAt)} ${TS.fmt.hms(r.gotAt)} <small>${r.dday}</small>` : '-'],
      ['풀린 취소표', `${r.releases}장 <small>봇이 가져간 표 ${r.botTakes}장</small>`],
      ['새로고침/조회', `${r.refreshes}회`],
      ['접근 제한', `${r.blocks}회`],
      ['"이미 선택된 좌석입니다."', `${r.taken}회`],
      ['보안문자 오입력', `${r.captchaFails}회`],
      ['실제 플레이 시간', `${Math.floor(r.realSec / 60)}분 ${Math.round(r.realSec % 60)}초`],
    ];
  }
  function openComment(r) {
    if (r.success) {
      if (r.reactionMs != null && r.reactionMs < 150) return '0.1초대 도착. 손가락이 서버보다 빠릅니다.';
      if (r.taken >= 3) return `이선좌 ${r.taken}번을 뚫고 결국 잡았습니다.`;
      return '축하합니다! 이번 공연은 직관입니다.';
    }
    if (r.reason === 'SOLDOUT') return '전석 매진. 취켓팅 모드로 다시 노려보세요.';
    if (r.reason === 'TIMEOUT') return '예매 가능 시간이 만료되었습니다.';
    return '다음엔 서버시간을 확인하고 정각에 눌러보세요.';
  }
  function cancelComment(r) {
    if (r.success) return r.gotAt && new Date(r.gotAt).getUTCHours() === 0 ? '자정 입금마감 물량을 정확히 노렸습니다.' : '끈질긴 새로고침의 승리!';
    if (r.reason === 'DEADLINE') return '취소마감 시간이 지났습니다. 핫타임 힌트를 잘 살펴보세요.';
    return '취소표는 기다리는 사람에게 옵니다. 다시 도전해 보세요.';
  }

  P.resultText = r => {
    const lines = [`[티키타카 티켓팅 시뮬레이터] ${r.kind === 'open' ? '오픈 티켓팅' : '취켓팅'} (${r.diff})`,
      r.success ? `✅ 성공 · ${r.seats.map(s => `${TS.GRADES[s.grade].name} ${s.label}`).join(', ')}` : '❌ 실패'];
    if (r.kind === 'open' && r.reactionMs != null) lines.push(`도착 ${TS.fmt.signedSec(r.reactionMs)} · 대기순번 ${TS.fmt.num(r.rank)} · 이선좌 ${r.taken}회`);
    if (r.kind === 'cancel') lines.push(`새로고침 ${r.refreshes}회 · 차단 ${r.blocks}회 · 이선좌 ${r.taken}회`);
    return lines.join('\n');
  };
})(window.TS);
