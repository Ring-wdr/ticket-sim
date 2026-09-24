// 예매창(팝업 윈도 연출) + 단계 흐름: 좌석 선택 → 가격/할인 → 배송/예매확인 → 결제 → 완료
// 게임 모드(game)가 제공해야 하는 것:
//   venue, kind, maxSeats, stats, dateLabel(), fmtTime(t), timeLeft(),
//   reqSeatView(zoneId), reqLock(ids), reqRelease(ids), reqPay(ids, method),
//   onTimeout(), onAbort(), onLockLost(), finishSuccess()
(function (TS) {
  const STEPS = ['관람일/회차', '좌석 선택', '가격/할인', '배송/예매확인', '결제하기'];
  const FEE = 2000;

  class BookingFlow {
    constructor(game) {
      this.game = game; this.locked = null; this.step = 0;
      this.bookingNo = null; this.timedOut = false;
    }

    open({ captcha = true } = {}) {
      const g = this.game;
      this.node = TS.el(`<div class="popup-backdrop ${g.kind === 'cancel' ? 'with-feed' : ''}"><div class="popup-win">
        <div class="pw-bar"><span class="pw-dots"><i></i><i></i><i></i></span><span class="pw-url">🔒 tickets.tikitaka.example/booking/lumina2026</span><button class="pw-x" data-act="close" title="닫기">✕</button></div>
        <div class="pw-head">
          <div class="pw-title"><b>${TS.esc(TS.SHOW.title)}</b><span>${TS.esc(g.dateLabel())} · ${TS.esc(TS.SHOW.venue)}</span></div>
          <div class="pw-timer" hidden><span>남은 시간</span><b>--:--</b></div>
        </div>
        <ol class="pw-steps">${STEPS.map((s, i) => `<li data-s="${i + 1}"><em>0${i + 1}</em>${s}</li>`).join('')}</ol>
        <div class="pw-body"></div>
      </div></div>`);
      TS.$('#layer').appendChild(this.node);
      this.body = TS.$('.pw-body', this.node);
      TS.$('[data-act="close"]', this.node).onclick = () => this.askClose();
      this.timerIv = setInterval(() => this.updateTimer(), 100);
      this.offPersist = TS.bus.on('mq:persisted', row => {
        if (this.bookingNo && row.payload.bookingNo === this.bookingNo) this.onPersisted(row);
      });
      this.gotoSeat(captcha);
    }

    close() {
      clearInterval(this.timerIv);
      if (this.offPersist) this.offPersist();
      if (this.node) this.node.remove();
      this.node = null;
    }

    setStep(n) {
      this.step = n;
      TS.$$('.pw-steps li', this.node).forEach(li => {
        const s = +li.dataset.s;
        li.classList.toggle('on', s === n);
        li.classList.toggle('done', s < n);
      });
    }

    updateTimer() {
      if (!this.node) return;
      const ms = this.game.timeLeft();
      const box = TS.$('.pw-timer', this.node);
      if (ms == null) { box.hidden = true; return; }
      box.hidden = false;
      box.querySelector('b').textContent = TS.fmt.mmss(ms);
      box.classList.toggle('warn', ms < 60000);
      if (ms <= 0 && !this.timedOut) { this.timedOut = true; this.game.onTimeout(); }
    }

    // ---------- 02 좌석 선택 ----------
    gotoSeat(captcha) {
      this.setStep(2); this.locked = null;
      this.body.innerHTML = '<div class="step-wrap"></div>';
      this.seatStep = new TS.SeatStep({
        root: TS.$('.step-wrap', this.body), game: this.game,
        onLocked: ids => { this.locked = ids; this.timedOut = false; this.gotoPrice(); },
      });
      this.seatStep.load(null);
      if (captcha) TS.captcha.mount(this.body, { onFail: () => this.game.stats.captchaFails++ });
    }

    onF5() {
      if (this.step === 2 && this.seatStep && !TS.$('.cap-overlay', this.body)) this.seatStep.refresh();
    }

    seatsOf() { return this.locked.map(id => this.game.venue.byId[id]); }
    amount() {
      const seats = this.seatsOf();
      const ticket = seats.reduce((a, s) => a + TS.GRADES[s.grade].price, 0);
      return { ticket, fee: FEE * seats.length, total: ticket + FEE * seats.length, n: seats.length };
    }

    summaryHtml() {
      const a = this.amount();
      return `<aside class="my-info"><h4>My 예매정보</h4><dl>
        <dt>일시</dt><dd>${TS.esc(this.game.dateLabel())}</dd>
        <dt>선택좌석</dt><dd>${this.seatsOf().map(s => `<div>${TS.GRADES[s.grade].name} ${TS.esc(s.label)}</div>`).join('')}</dd>
        <dt>티켓금액</dt><dd>${TS.fmt.won(a.ticket)}</dd>
        <dt>예매수수료</dt><dd>${TS.fmt.won(a.fee)}</dd>
        <dt class="tot">총 결제금액</dt><dd class="tot">${TS.fmt.won(a.total)}</dd>
      </dl></aside>`;
    }

    actions(prevLabel = '이전단계', nextLabel = '다음단계') {
      return `<div class="step-actions"><button class="btn-line" data-a="prev">${prevLabel}</button><button class="btn-primary" data-a="next">${nextLabel}</button></div>`;
    }

    bindActions(onPrev, onNext) {
      TS.$('[data-a="prev"]', this.body).onclick = onPrev;
      TS.$('[data-a="next"]', this.body).onclick = onNext;
    }

    backToSeat() {
      const ids = this.locked; this.locked = null;
      if (ids) this.game.reqRelease(ids);
      this.gotoSeat(false);
    }

    // ---------- 03 가격/할인 ----------
    gotoPrice() {
      this.setStep(3);
      const byGrade = {};
      this.seatsOf().forEach(s => { byGrade[s.grade] = (byGrade[s.grade] || 0) + 1; });
      const rows = Object.entries(byGrade).map(([g, n]) => `<tr>
        <td><i class="dot" style="background:${TS.GRADES[g].color}"></i>${TS.GRADES[g].name}</td>
        <td>일반(정가)</td><td>${TS.fmt.won(TS.GRADES[g].price)}</td>
        <td><select disabled><option>${n}매</option></select></td></tr>`).join('');
      this.body.innerHTML = `<div class="step-wrap two-col">
        <section class="step-main"><h3 class="st-title">가격/할인 선택</h3>
          <table class="tbl"><thead><tr><th>좌석등급</th><th>가격구분</th><th>가격</th><th>매수</th></tr></thead><tbody>${rows}</tbody></table>
          <ul class="note"><li>할인은 증빙이 필요하며, 본 시뮬레이터에서는 일반가만 제공됩니다.</li><li>이전단계로 돌아가면 선택한 좌석은 반환됩니다.</li></ul>
        </section>${this.summaryHtml()}</div>${this.actions()}`;
      this.bindActions(() => this.backToSeat(), () => this.gotoConfirm());
    }

    // ---------- 04 배송/예매확인 ----------
    gotoConfirm() {
      this.setStep(4);
      this.body.innerHTML = `<div class="step-wrap two-col">
        <section class="step-main"><h3 class="st-title">티켓 수령방법</h3>
          <div class="radio-row"><label><input type="radio" name="rcv" checked> 모바일티켓</label><label><input type="radio" name="rcv"> 현장수령</label></div>
          <h3 class="st-title">예매자 확인</h3>
          <table class="form-tbl">
            <tr><th>이름</th><td><input value="김티켓" readonly></td></tr>
            <tr><th>생년월일</th><td><input value="******" readonly></td></tr>
            <tr><th>휴대폰</th><td><input value="010-1234-****" readonly></td></tr>
            <tr><th>이메일</th><td><input value="guest@tikitaka.example" readonly></td></tr>
          </table>
          <label class="agree"><input type="checkbox" id="agreeInfo"> 위 예매자 정보를 확인하였으며, 개인정보 제3자 제공에 동의합니다.</label>
        </section>${this.summaryHtml()}</div>${this.actions()}`;
      this.bindActions(() => this.gotoPrice(), () => {
        if (!TS.$('#agreeInfo', this.body).checked) { TS.dialog.alert('예매자 정보 확인 및 개인정보 제3자 제공에 동의해 주세요.'); return; }
        this.gotoPayment();
      });
    }

    // ---------- 05 결제 ----------
    gotoPayment() {
      this.setStep(5);
      this.body.innerHTML = `<div class="step-wrap two-col">
        <section class="step-main"><h3 class="st-title">결제수단 선택</h3>
          <div class="pay-methods">
            <label><input type="radio" name="pay" value="card" checked> 신용카드</label>
            <label><input type="radio" name="pay" value="bank"> 무통장입금</label>
            <label><input type="radio" name="pay" value="easy"> 간편결제</label>
            <label><input type="radio" name="pay" value="phone"> 휴대폰결제</label>
          </div>
          <p class="pay-note" data-note>신용카드 결제 시 즉시 예매가 확정됩니다.</p>
          <h3 class="st-title">취소수수료 안내</h3>
          <table class="tbl small"><tbody>
            <tr><td>예매 후 7일 이내</td><td>없음</td></tr>
            <tr><td>예매 후 8일 ~ 관람일 10일전</td><td>뮤지컬/콘서트 4,000원</td></tr>
            <tr><td>관람일 9일전 ~ 7일전</td><td>티켓금액의 10%</td></tr>
            <tr><td>관람일 6일전 ~ 3일전</td><td>티켓금액의 20%</td></tr>
            <tr><td>관람일 2일전 ~ 1일전</td><td>티켓금액의 30%</td></tr>
          </tbody></table>
          <label class="agree"><input type="checkbox" id="agreeAll"> 취소기한 및 취소수수료, 예매 약관에 모두 동의합니다.</label>
        </section>${this.summaryHtml()}</div>${this.actions('이전단계', '결제하기')}`;
      TS.$$('input[name="pay"]', this.body).forEach(r => r.onchange = () => {
        TS.$('[data-note]', this.body).textContent = r.value === 'bank'
          ? '무통장입금: 예매 다음날 23:59까지 입금하지 않으면 자동 취소됩니다. (이 표들이 자정에 취소표로 풀립니다)'
          : '선택하신 결제수단으로 즉시 결제 후 예매가 확정됩니다.';
      });
      this.bindActions(() => this.gotoConfirm(), async () => {
        if (!TS.$('#agreeAll', this.body).checked) { TS.dialog.alert('취소기한 및 취소수수료 약관에 동의해 주세요.'); return; }
        const btn = TS.$('[data-a="next"]', this.body);
        if (btn.disabled) return;
        btn.disabled = true; btn.textContent = '결제 처리 중…';
        const method = TS.$('input[name="pay"]:checked', this.body).value;
        const r = await this.game.reqPay(this.locked, method);
        if (!this.node) return;
        if (!r || !r.ok) {
          btn.disabled = false; btn.textContent = '결제하기';
          await TS.dialog.alert('좌석 선점 시간이 만료되어 결제할 수 없습니다.\n좌석을 다시 선택해 주세요.');
          this.game.onLockLost();
          return;
        }
        this.gotoDone(r);
      });
    }

    // ---------- 완료 ----------
    gotoDone(r) {
      this.bookingNo = r.bookingNo;
      TS.$$('.pw-steps li', this.node).forEach(li => { li.classList.remove('on'); li.classList.add('done'); });
      const a = this.amount();
      this.body.innerHTML = `<div class="done-wrap">
        <div class="done-ico">✓</div>
        <h2>예매가 완료되었습니다</h2>
        <p class="muted">예매번호 <b class="bno">${r.bookingNo}</b></p>
        <div class="done-card">
          <div><span>공연</span><b>${TS.esc(TS.SHOW.title)}</b></div>
          <div><span>일시</span><b>${TS.esc(this.game.dateLabel())}</b></div>
          <div><span>좌석</span><b>${this.seatsOf().map(s => `${TS.GRADES[s.grade].name} ${TS.esc(s.label)}`).join('<br>')}</b></div>
          <div><span>결제금액</span><b>${TS.fmt.won(a.total)}</b></div>
          <div><span>DB 저장</span><b class="persist" data-persist>⏳ MQ 대기 중… Worker가 곧 저장합니다</b></div>
        </div>
        <button class="btn-primary" data-a="result">결과 보기</button>
      </div>`;
      TS.$('[data-a="result"]', this.body).onclick = () => this.game.finishSuccess();
    }

    onPersisted(row) {
      const el = this.node && TS.$('[data-persist]', this.node);
      if (el) { el.textContent = `✅ 저장 완료 (MQ 지연 ${TS.fmt.num(row.savedAt - row.at)}ms)`; el.classList.add('ok'); }
      this.game.persistLagMs = row.savedAt - row.at;
    }

    async askClose() {
      if (this.bookingNo) { this.game.finishSuccess(); return; }
      const ok = await TS.dialog.confirm('예매를 취소하고 창을 닫으시겠습니까?\n선택하신 좌석은 반환됩니다.');
      if (!ok || !this.node) return;
      if (this.locked) this.game.reqRelease(this.locked);
      this.locked = null;
      this.close();
      this.game.onAbort();
    }
  }

  TS.BookingFlow = BookingFlow;
})(window.TS);
