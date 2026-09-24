// 모드 A: 오픈 티켓팅
// 20:00:00 오픈 → 대기열(ZSET) → 스케줄러가 1초마다 batch 입장 → 보안문자 → 좌석 선점(Lua) → 결제 → MQ
(function (TS) {
  const OPEN = TS.T(2026, 10, 1, 20, 0, 0);

  // crowd: 동시접속 인원, tau: 도착 곡선 시정수(ms, 작을수록 다들 정각에 몰림)
  // batch: 초당 입장 인원(서버 TPS), sellout: 봇만으로 매진되는 목표 시간(초)
  const DIFF = {
    easy: { label: '쉬움', crowd: 20000, tau: 2000, batch: 250, sellout: 300, peakLat: 150, activeTtl: 420 },
    normal: { label: '보통', crowd: 150000, tau: 1200, batch: 1250, sellout: 150, peakLat: 300, activeTtl: 300 },
    hard: { label: '어려움', crowd: 1000000, tau: 500, batch: 7000, sellout: 90, peakLat: 500, activeTtl: 240 },
  };

  class ModeOpen {
    constructor(diffKey) {
      this.kind = 'open';
      this.diffKey = diffKey;
      this.D = DIFF[diffKey];
      this.maxSeats = 2;
      this.rng = TS.RNG((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    }

    // ================= lifecycle =================
    start() {
      const D = this.D, rng = this.rng;
      this.clock = new TS.Clock(OPEN - Math.round(rng.range(12000, 16000)));
      this.redis = new TS.MiniRedis(this.clock);
      this.mq = new TS.MQ(this.clock);
      this.venue = TS.buildVenue();
      this.engine = new TS.BookingEngine({ redis: this.redis, mq: this.mq, venue: this.venue, showKey: 'concert:lumina' });
      this.engine.initStock();
      this.queue = new TS.QueueService({ redis: this.redis, clock: this.clock, total: D.crowd, openAt: OPEN, tau: D.tau });
      this.api = new TS.Api({ latency: () => this.latency() });
      // 입장한 군중 중 실제 좌석 선점까지 가는 비율 (봇 1회 평균 약 1.45석)
      this.q = this.venue.seats.length / (D.sellout * D.batch * 1.45);
      this.stats = { taken: 0, early: 0, captchaFails: 0, refreshes: 0, blocks: 0, requeues: 0 };
      this.pcOffset = Math.round(rng.range(-700, 700));
      this.player = { uuid: null, phase: 'product', date: null };
      this.admits = []; // [time, count] 최근 입장 기록 (active 추정용)
      this.bot = { seq: 0, attempts: 0, ok: 0, fail: 0 };
      this.showServerClock = true;

      this.clock.at(OPEN, () => TS.log('system', '⏰ 20:00:00.000 예매 오픈', 'ok'));
      this.clock.setInterval(() => this.schedulerTick(), 1000, OPEN + 1000);
      this.clock.setInterval(() => this.redis.sweep(), 1000);
      this.mq.startWorker({ every: 250, batch: 8 });
      TS.log('system', `게임 시작 · 동시접속 ${TS.fmt.num(D.crowd)}명 · 입장 배치 ${TS.fmt.num(D.batch)}명/초 · 좌석 ${TS.fmt.num(this.venue.seats.length)}석`);

      this.clock.start();
      this.uiIv = setInterval(() => this.frame(), 50);
    }

    destroy() {
      this.clock.destroy();
      this.api.alive = false;
      clearInterval(this.uiIv);
      if (this.flow) this.flow.close();
      this.closeQueue();
    }

    latency() {
      const t = this.clock.now - OPEN;
      const load = t < -2000 ? 0.08 : Math.exp(-Math.max(0, t) / 45000);
      return 35 + this.rng.range(0, 50) + this.D.peakLat * load * this.rng.range(0.2, 0.9);
    }

    // ================= 서버: 입장 스케줄러 (md 4.3) =================
    schedulerTick() {
      const res = this.queue.popMin(this.D.batch);
      for (const m of res.members) {
        this.redis.set('active:user:' + m, '1', { ex: this.D.activeTtl });
        TS.log('redis', `SET active:user:${m.slice(0, 8)}… 1 EX ${this.D.activeTtl}`, 'ok');
      }
      const n = res.crowd + res.members.length;
      this.admits.push([this.clock.now, n]);
      while (this.admits.length && this.admits[0][0] < this.clock.now - this.D.activeTtl * 1000) this.admits.shift();

      // 입장한 군중 중 일부가 몇 초 뒤(보안문자·좌석 고르는 시간) 좌석 선점을 시도한다
      const attempts = Math.floor(res.crowd * this.q + this.rng.next());
      for (let i = 0; i < attempts; i++) this.clock.setTimeout(() => this.botGrab(), this.rng.range(4000, 22000));

      const beforeOk = this.bot.lastOk || 0, beforeFail = this.bot.lastFail || 0;
      this.bot.lastOk = this.bot.ok; this.bot.lastFail = this.bot.fail;
      if (n > 0 || this.bot.ok !== beforeOk) {
        TS.log('scheduler', `ZPOPMIN queue:wait ${TS.fmt.num(this.D.batch)} → ${TS.fmt.num(n)}명 입장 · 대기 ${TS.fmt.num(this.queue.size())} · 직전 1초 봇 선점 성공 ${this.bot.ok - beforeOk} / 실패 ${this.bot.fail - beforeFail}`);
      }

      if (!this.soldOutAnnounced && this.engine.stockTotal() === 0 && this.redis.countPrefix('seat:lock:') === 0) {
        this.soldOutAnnounced = true;
        TS.log('system', '전석 매진', 'warn');
        if (this.player.phase !== 'done') {
          TS.dialog.alert('전석 매진되었습니다.').then(() => { if (TS.game === this) this.finish(false, 'SOLDOUT'); });
        }
      }
    }

    botGrab() {
      this.bot.attempts++;
      const avail = this.engine.availableIds();
      if (!avail.length) { this.bot.fail++; return; }
      let sum = 0; for (const id of avail) sum += this.venue.byId[id].w;
      let r = this.rng.next() * sum, pick = avail[avail.length - 1];
      for (const id of avail) { r -= this.venue.byId[id].w; if (r <= 0) { pick = id; break; } }
      const ids = [pick];
      const s = this.venue.byId[pick];
      if (this.rng.chance(0.45)) {
        const nb = `${s.zone}-${s.row}-${s.col + 1}`;
        if (this.venue.byId[nb] && this.engine.isAvailable(nb)) ids.push(nb);
      }
      const botId = 'bot:' + (++this.bot.seq);
      const res = this.engine.lockSeats(botId, ids, 150);
      if (!res.ok) { this.bot.fail++; return; }
      this.bot.ok++;
      // 결제까지 걸리는 시간. 일부는 결제를 포기해 좌석이 다시 풀린다.
      this.clock.setTimeout(() => {
        if (this.rng.chance(0.92)) this.engine.confirm(botId, ids);
        else this.engine.release(botId, ids);
      }, this.rng.range(20000, 90000));
    }

    // ================= 클라이언트 API =================
    async clickBook() {
      if (this.player.phase !== 'product' || this.pending) return;
      if (!this.player.date) { TS.dialog.alert('관람일을 선택해 주세요.'); return; }
      this.enterQueue(false);
    }

    async enterQueue(isRequeue) {
      this.pending = true;
      const clickedAt = this.clock.now;
      this.setBookBtn(true);
      const r = await this.api.call('POST /queue/enter', () => {
        if (this.clock.now < OPEN) return { error: 'NOT_OPEN' };
        const uuid = TS.uuid();
        const score = this.queue.enter(uuid);
        TS.log('redis', `ZADD queue:wait NX ${score} ${uuid.slice(0, 8)}… → ZRANK ${TS.fmt.num(this.queue.rank(uuid) - 1)}`);
        return { uuid, arrivedAt: score, rank: this.queue.rank(uuid) };
      });
      this.pending = false;
      this.setBookBtn(false);
      if (r.error) {
        this.stats.early++;
        TS.log('api', `403 NOT_OPEN · 서버 시각 ${TS.fmt.hmsms(clickedAt)}`, 'warn');
        await TS.dialog.alert('예매 오픈 전입니다.\n오픈 시간 이후에 다시 시도해 주세요.');
        return;
      }
      if (!this.firstClick) this.firstClick = { clickedAt, arrivedAt: r.arrivedAt, rank: r.rank };
      if (isRequeue) TS.toast('대기순서가 초기화되었습니다.', 'warn');
      this.player.uuid = r.uuid;
      this.player.phase = 'queue';
      this.queueStart = r.arrivedAt;
      this.initialRank = r.rank;
      this.qState = { rank: r.rank, behind: 0, est: r.rank / this.D.batch, next_poll_ttl: 1 };
      this.openQueue();
      this.poll();
    }

    // Adaptive Polling + Jitter (md 4.1, 5-1)
    poll() {
      if (this.player.phase !== 'queue') return;
      const uuid = this.player.uuid;
      this.polling = true;
      this.api.call('GET /queue/status', () => {
        if (this.redis.has('active:user:' + uuid)) return { status: 'ACTIVE', ttl: this.redis.ttl('active:user:' + uuid) };
        const rank = this.queue.rank(uuid);
        if (rank == null) return { status: 'GONE' };
        const total = this.queue.size();
        const est = rank / this.D.batch;
        const next = est > 10 ? 5 : est > 3 ? 2 : 1;
        return { status: 'WAITING', rank, behind: Math.max(0, total - rank), est, next_poll_ttl: next };
      }).then(r => {
        this.polling = false;
        if (this.player.uuid !== uuid || this.player.phase !== 'queue') return;
        if (r.status === 'ACTIVE') { this.enterBooking(r.ttl); return; }
        if (r.status === 'GONE') { this.player.phase = 'product'; this.closeQueue(); TS.dialog.alert('대기 정보가 만료되었습니다. 다시 시도해 주세요.'); return; }
        this.qState = r;
        this.lastJitter = this.rng.range(-0.5, 0.5);
        this.nextPollAt = this.clock.now + (r.next_poll_ttl + this.lastJitter) * 1000;
        this.pollTimer = this.clock.at(this.nextPollAt, () => this.poll());
      });
    }

    enterBooking(ttl) {
      this.player.phase = 'booking';
      this.activatedAt = this.clock.now;
      this.activeUntil = this.clock.now + ttl * 1000;
      if (this.soldPctAtEntry == null) this.soldPctAtEntry = 1 - this.engine.stockTotal() / this.venue.seats.length;
      if (this.waitSec == null) this.waitSec = (this.activatedAt - this.queueStart) / 1000;
      this.closeQueue();
      TS.log('system', `입장 허용 · active:user TTL ${ttl}초`, 'ok');
      this.flow = new TS.BookingFlow(this);
      this.flow.open({ captcha: true });
    }

    isActive() { return this.player.uuid && this.redis.has('active:user:' + this.player.uuid); }

    reqSeatView(zoneId) {
      this.stats.refreshes++;
      const uuid = this.player.uuid;
      return this.api.call('GET /seats' + (zoneId ? '/' + zoneId : ''), () => {
        const rl = this.api.rateLimit('seat:' + uuid, { max: 10, windowMs: 5000, blockMs: 8000 });
        if (rl.blocked) { if (rl.justBlocked) this.stats.blocks++; return { blocked: true, until: rl.until }; }
        if (!this.redis.has('active:user:' + uuid)) return { error: 'EXPIRED' };
        return this.engine.view(zoneId);
      });
    }

    reqLock(ids) {
      const uuid = this.player.uuid;
      return this.api.call('POST /seats/lock', () => {
        if (!this.redis.has('active:user:' + uuid)) return { error: 'EXPIRED' };
        const ttl = Math.max(1, this.redis.ttl('active:user:' + uuid));
        return this.engine.lockSeats(uuid, ids, ttl);
      });
    }

    reqRelease(ids) {
      const uuid = this.player.uuid;
      return this.api.call('POST /seats/release', () => this.engine.release(uuid, ids));
    }

    reqPay(ids, method) {
      const uuid = this.player.uuid;
      return this.api.call('POST /payment', () => {
        const r = this.engine.confirm(uuid, ids, { method });
        if (r.ok) {
          this.redis.del('active:user:' + uuid);
          TS.log('redis', `DEL active:user:${uuid.slice(0, 8)}… (다음 대기자에게 자리 양보)`);
          this.player.phase = 'done';
          this.booked = { ids, bookingNo: r.bookingNo };
        }
        return r;
      });
    }

    timeLeft() {
      if (this.player.phase !== 'booking') return null;
      return this.activeUntil - this.clock.now;
    }

    onTimeout() {
      TS.log('system', 'active:user TTL 만료 → 예매창 종료', 'warn');
      if (this.flow) { this.flow.close(); this.flow = null; }
      this.player.phase = 'product'; this.player.uuid = null;
      TS.dialog.alert('예매 가능 시간이 만료되었습니다.\n다시 예매하려면 대기열에 재진입해야 합니다.').then(() => {
        if (TS.game === this) this.renderPanel();
      });
    }

    onLockLost() { if (this.flow) this.flow.gotoSeat(false); }

    onAbort() {
      this.flow = null;
      this.player.phase = 'product'; this.player.uuid = null;
      this.stats.requeues++;
      TS.toast('예매창을 닫았습니다. 다시 예매하려면 대기열에 재진입해야 합니다.');
      this.renderPanel();
    }

    finishSuccess() { this.finish(true); }

    finish(success, reason) {
      const seats = (success && this.booked ? this.booked.ids : []).map(id => this.venue.byId[id]);
      const reasonText = { SOLDOUT: '전석 매진되었습니다.', GIVEUP: '예매를 포기했습니다.', TIMEOUT: '예매 가능 시간이 만료되었습니다.' }[reason];
      TS.lastResult = {
        kind: 'open', diff: this.D.label, diffKey: this.diffKey, success, reason, reasonText,
        seats: seats.map(s => ({ grade: s.grade, label: s.label })),
        bookingNo: this.booked && this.booked.bookingNo,
        dateLabel: this.dateLabel(),
        reactionMs: this.firstClick ? this.firstClick.arrivedAt - OPEN : null,
        clickErrMs: this.firstClick ? this.firstClick.clickedAt - OPEN : null,
        rank: this.firstClick ? this.firstClick.rank : null,
        pcOffset: this.pcOffset, early: this.stats.early, waitSec: this.waitSec,
        soldPctAtEntry: this.soldPctAtEntry, taken: this.stats.taken, captchaFails: this.stats.captchaFails,
        requeues: this.stats.requeues, persistLagMs: this.persistLagMs,
        elapsed: (this.clock.now - OPEN) / 1000,
      };
      TS.endGame();
      location.hash = '#/result';
    }

    // F5: 상품 페이지 → 무해, 대기 중 → 대기순서 초기화(!), 예매창 좌석 단계 → 좌석 새로고침
    onF5() {
      if (this.player.phase === 'queue') {
        this.stats.requeues++;
        this.clock.clear(this.pollTimer);
        TS.log('system', `F5 새로고침 → 새 UUID로 재진입 (이전 UUID는 대기열에 유령으로 남아 TTL로 회수됨)`, 'warn');
        this.player.uuid = null; this.player.phase = 'product';
        this.closeQueue();
        this.enterQueue(true);
      } else if (this.player.phase === 'booking' && this.flow) {
        this.flow.onF5();
      } else if (this.player.phase === 'product') {
        const root = TS.$('#app');
        root.classList.add('reloading');
        setTimeout(() => root.classList.remove('reloading'), 180);
      }
    }

    // ================= UI =================
    dateLabel() {
      const d = TS.SHOW.dates.find(x => x.key === (this.player.date || '1010'));
      return `${d.label} ${d.time}`;
    }
    fmtTime(t) { return TS.fmt.hmsms(t); }

    noticeHtml() {
      return `<div class="notice-box"><b>티켓오픈 안내</b><p>일반예매 <em>2026.10.01(목) 20:00</em></p><p class="muted">※ 오픈 시간 이전에는 예매가 불가합니다. 정확한 시간은 서버시간을 기준으로 합니다.</p></div>`;
    }

    panelHtml() {
      const d = TS.SHOW.dates.find(x => x.key === this.player.date);
      return `<div class="bp-title">관람일 선택</div>
        ${TS.pages.calendar({ sel: this.player.date, enabled: ['1010', '1011'] })}
        <div class="bp-title">회차 선택</div>
        <div class="bp-rounds">${d ? `<button class="round sel">1회 ${d.time}</button>` : '<p class="muted">관람일을 먼저 선택하세요.</p>'}</div>
        <div class="bp-remain">${d ? '잔여석은 예매하기 이후 확인할 수 있습니다.' : ''}</div>
        <button class="btn-book" data-act="book">예매하기</button>`;
    }

    renderPanel() { const p = TS.$('#bookPanel'); if (p) p.innerHTML = this.panelHtml(); }

    setBookBtn(loading) {
      const b = TS.$('.btn-book');
      if (!b) return;
      b.classList.toggle('loading', loading);
      b.textContent = loading ? '접속 중…' : '예매하기';
    }

    bindPage(root) {
      root.addEventListener('click', e => {
        const d = e.target.closest('[data-date]');
        if (d && this.player.phase === 'product') { this.player.date = d.dataset.date; this.renderPanel(); return; }
        if (e.target.closest('[data-act="book"]')) this.clickBook();
      });
    }

    hudHtml() {
      return `<div class="hud-in">
        <span class="hud-mode">🎫 오픈 티켓팅 <em>${this.D.label}</em></span>
        <span class="hud-item">내 PC 시계 <b data-h="pc">--:--:--</b></span>
        <span class="hud-item" data-h="cd"></span>
        <span class="hud-sp"></span>
        <button class="hud-btn" data-h="clockbtn">⏱ 서버시간</button>
        <button class="hud-btn" data-h="quit">포기하기</button>
      </div>`;
    }

    sideHtml() {
      return `<div class="srv-clock" data-h="srvbox">
        <div class="sc-head"><span>🕐 서버시간 확인</span><small>tickets.tikitaka.example</small></div>
        <div class="sc-time" data-h="srv">--:--:--.---</div>
        <div class="sc-foot">응답 지연 약 <b data-h="lat">-</b>ms · 20:00:00 정각에 눌러보세요</div>
      </div>`;
    }

    bindHud(hud, side) {
      hud.addEventListener('click', e => {
        const b = e.target.closest('[data-h]'); if (!b) return;
        if (b.dataset.h === 'clockbtn') { this.showServerClock = !this.showServerClock; TS.$('[data-h="srvbox"]', side).hidden = !this.showServerClock; }
        if (b.dataset.h === 'quit') TS.dialog.confirm('예매를 포기하고 결과를 보시겠습니까?').then(ok => { if (ok && TS.game === this) this.finish(false, 'GIVEUP'); });
      });
    }

    frame() {
      const now = this.clock.now;
      const pcNow = now + this.pcOffset;
      const set = (sel, v) => { const el = TS.$(`[data-h="${sel}"]`); if (el) el.innerHTML = v; };
      set('pc', TS.fmt.hms(pcNow));
      set('srv', TS.fmt.hmsms(now));
      set('lat', this.api.lastMs ? this.api.lastMs : Math.round(this.latency()));
      set('cd', pcNow < OPEN ? `오픈까지 <b>${TS.fmt.mmss(OPEN - pcNow)}</b> <small>(내 PC 기준)</small>` : `오픈 후 <b>+${TS.fmt.mmss(pcNow - OPEN)}</b>`);
      if (this.player.phase === 'queue') this.renderQueue();
    }

    // ---------- 대기창 ----------
    openQueue() {
      this.closeQueue();
      this.qnode = TS.el(`<div class="popup-backdrop"><div class="popup-win qwin">
        <div class="pw-bar"><span class="pw-dots"><i></i><i></i><i></i></span><span class="pw-url">🔒 tickets.tikitaka.example/waiting</span><button class="pw-x" data-q="close" title="닫기">✕</button></div>
        <div class="q-body">
          <div class="q-logo"><span class="logo-mark">T</span>티키타카 TICKET</div>
          <h2>접속 대기 중입니다</h2>
          <p class="q-sub">현재 접속 인원이 많아 대기 중입니다.<br>잠시만 기다리시면 예매 페이지로 자동 연결됩니다.</p>
          <div class="q-rank"><span>나의 대기순서</span><strong data-q="rank">-</strong></div>
          <div class="q-bar"><i data-q="bar"></i></div>
          <div class="q-meta"><span>뒤에 <b data-q="behind">-</b>명</span><span>예상 대기 <b data-q="eta">-</b></span></div>
          <div class="q-warn">새로고침(F5)하거나 창을 닫으면 대기순서가 초기화되어<br>대기시간이 더 길어질 수 있습니다.</div>
          <div class="q-poll" data-q="poll"></div>
        </div>
      </div></div>`);
      TS.$('#layer').appendChild(this.qnode);
      TS.$('[data-q="close"]', this.qnode).onclick = async () => {
        const ok = await TS.dialog.confirm('대기를 취소하시겠습니까?\n다시 접속하면 대기순서가 초기화됩니다.');
        if (!ok || this.player.phase !== 'queue') return;
        this.clock.clear(this.pollTimer);
        this.stats.requeues++;
        this.player.phase = 'product'; this.player.uuid = null;
        this.closeQueue();
      };
      this.renderQueue();
    }

    closeQueue() { if (this.qnode) { this.qnode.remove(); this.qnode = null; } }

    renderQueue() {
      if (!this.qnode) return;
      const s = this.qState; const $ = k => TS.$(`[data-q="${k}"]`, this.qnode);
      $('rank').textContent = TS.fmt.num(s.rank);
      $('behind').textContent = TS.fmt.num(s.behind);
      $('eta').textContent = TS.fmt.mmss(s.est * 1000);
      const pct = this.initialRank > 1 ? (1 - (s.rank - 1) / this.initialRank) * 100 : 100;
      $('bar').style.width = Math.max(2, Math.min(100, pct)) + '%';
      if (this.polling || !this.nextPollAt) $('poll').innerHTML = '<span class="spin"></span> 순번 확인 중…';
      else {
        const left = Math.max(0, this.nextPollAt - this.clock.now) / 1000;
        const j = this.lastJitter;
        $('poll').innerHTML = `다음 확인까지 <b>${left.toFixed(1)}s</b> · next_poll_ttl=<code>${s.next_poll_ttl}s</code> · jitter <code>${j >= 0 ? '+' : ''}${j.toFixed(2)}s</code>`;
      }
    }

    // ---------- 서버 들여다보기 ----------
    inspect() {
      const r = this.redis, st = this.engine.stock(), q = this.queue;
      const activeEst = this.admits.reduce((a, [, n]) => a + n, 0);
      const keys = [
        ['queue:wait', 'ZSET', TS.fmt.num(q.size()), `군중 모델 ${TS.fmt.num(q.crowdWaiting())} + 실제 멤버 ${r.zcard('queue:wait')}`],
        ['active:user:*', 'STRING EX', TS.fmt.num(activeEst), `최근 ${this.D.activeTtl}초 입장 인원 (TTL 만료 전)`],
      ];
      if (this.player.uuid) {
        const k = 'active:user:' + this.player.uuid;
        const ttl = r.ttl(k);
        keys.push([`active:user:${this.player.uuid.slice(0, 8)}…`, '나', ttl > 0 ? `TTL ${ttl}s` : '(없음)', ttl > 0 ? '예매창 남은 시간' : '아직 대기열']);
      }
      for (const g in TS.GRADES) keys.push([this.engine.stockKey(g), 'STRING', TS.fmt.num(st[g]), 'lock_seats.lua로만 차감']);
      keys.push(['seat:lock:*', 'STRING NX EX', TS.fmt.num(r.countPrefix('seat:lock:')), '결제 진행 중인 좌석']);
      keys.push(['seat:sold:*', 'STRING', TS.fmt.num(r.countPrefix('seat:sold:')), '결제 완료 좌석']);
      const e = this.engine.stats;
      return {
        keys,
        metrics: [
          ['스케줄러 배치', `${TS.fmt.num(this.D.batch)}명/초`],
          ['누적 입장', TS.fmt.num(q.admittedTotal)],
          ['Lua 성공 / 실패', `${TS.fmt.num(e.luaOk)} / ${TS.fmt.num(e.luaFail)}`],
          ['봇 선점 시도', TS.fmt.num(this.bot.attempts)],
          ['MQ 대기 / 발행', `${this.mq.q.length} / ${TS.fmt.num(this.mq.published)}`],
          ['Worker → RDB', `${TS.fmt.num(this.mq.consumed)}건 (${this.mq.tps} TPS)`],
          ['Redis ops', TS.fmt.num(r.ops)],
          ['API 응답 지연', `${this.api.lastMs}ms`],
        ],
      };
    }
  }

  TS.ModeOpen = ModeOpen;
  TS.ModeOpen.DIFF = DIFF;
})(window.TS);
