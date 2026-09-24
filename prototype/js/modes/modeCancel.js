// 모드 B: 취켓팅 — 압축 시간선
// 10.01(목) 09:00 ~ 10.10(토) 17:00 취소마감까지 약 9일을 게임 시계 배속으로 압축한다.
// 평소에는 고배속, 취소표가 몰리는 "핫타임"은 자동으로 느려지고, 좌석을 잡으면 실시간으로 흐른다.
(function (TS) {
  const START = TS.T(2026, 10, 1, 9, 0, 0);
  const END = TS.T(2026, 10, 10, 17, 0, 0);      // 취소마감 (관람일 전일 17:00)
  const SHOW_T = TS.T(2026, 10, 11, 17, 0, 0);
  const day = (d, h = 0, m = 0, s = 0) => TS.T(2026, 10, d, h, m, s);
  const H = 3600e3, MIN = 60e3;

  const SPEEDS = { slow: 720, norm: 5760, fast: 23040 }; // 게임 하루 = 120초 / 15초 / 3.75초
  const SLEEP_SPEED = 40000;

  const DIFF = {
    easy: { label: '쉬움', f: 1.7, big: [18, 26] },
    normal: { label: '보통', f: 1, big: [12, 18] },
    hard: { label: '어려움', f: 0.55, big: [8, 12] },
  };

  const NICKS = ['취켓러', '루미나봉', '새벽세시', '티켓요정', '광클장인', '자리요정', '막차탑승', '포도알', '빛나는밤', '애프터글로우', '예대기', '플로어가자'];
  const CHATTER = [
    '오늘은 조용하네요… 다들 뭐 하세요',
    '어제 새벽에 3층 하나 떴다가 1초만에 사라짐 ㅋㅋ',
    '취켓팅은 체력전입니다 여러분',
    '매크로 돌리는 사람 신고하고 싶다',
    '혹시 2연석 보신 분?',
    '방금 새로고침 너무 많이 해서 차단당함 ㅠ',
    '양도 글은 사기 조심하세요!!',
    '플로어는 포기하고 1층 노리는 중',
    '이선좌 뜰 때마다 수명 줄어드는 느낌',
    '낮에도 가끔 한두 장씩 풀리긴 해요',
    '다들 성공하시길 🙏',
  ];

  class ModeCancel {
    constructor(diffKey) {
      this.kind = 'cancel';
      this.diffKey = diffKey;
      this.D = DIFF[diffKey];
      this.maxSeats = 2;
      this.rng = TS.RNG((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      this.seatHint = '💡 취소표는 새로고침(↻ 또는 F5)해야 보입니다. 너무 자주 누르면 접근이 제한됩니다.';
    }

    start() {
      this.clock = new TS.Clock(START);
      this.redis = new TS.MiniRedis(this.clock);
      this.mq = new TS.MQ(this.clock);
      this.venue = TS.buildVenue();
      this.engine = new TS.BookingEngine({ redis: this.redis, mq: this.mq, venue: this.venue, showKey: 'concert:lumina:1011' });
      this.engine.markSoldAll();
      this.api = new TS.Api({ latency: () => this.latency() });
      this.stats = { taken: 0, captchaFails: 0, refreshes: 0, blocks: 0, releases: 0, botTakes: 0 };
      this.uuid = TS.uuid();
      this.player = { phase: 'product' };
      this.speedMode = 'norm';
      this.sleepUntil = null;
      this.focus = false;
      this.feed = [];
      this.realStart = performance.now();

      this.buildTimeline();
      this.clock.speedFn = now => this.speedAt(now);
      this.clock.setInterval(() => this.redis.sweep(), 1000);
      this.clock.at(END, () => this.onDeadline());
      this.mq.startWorker({ every: 250, batch: 8 });

      TS.log('system', `취켓팅 시작 · 전석 매진 상태 · 취소마감 ${TS.fmt.mdd(END)} ${TS.fmt.hm(END)}`);
      this.clock.start();
      this.uiIv = setInterval(() => this.frame(), 80);
    }

    destroy() {
      this.clock.destroy();
      this.api.alive = false;
      clearInterval(this.uiIv);
      if (this.flow) this.flow.close();
    }

    latency() {
      const w = this.windowAt(this.clock.now);
      const spike = w && w.kind === 'big' && this.clock.now - (w.from + 10000) < 40000 ? this.rng.range(150, 500) : 0;
      return 40 + this.rng.range(0, 80) + spike;
    }

    // ================= 타임라인 생성 =================
    buildTimeline() {
      const rng = this.rng, f = this.D.f;
      const W = this.windows = [];

      // 1) 매일 자정: 무통장 입금기한 마감 → 미입금 표 자동취소
      const bigDays = new Set([2, ...rng.shuffle([3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 3)]);
      for (let d = 2; d <= 10; d++) {
        const t0 = day(d);
        if (bigDays.has(d)) {
          const w = { from: t0 - 10000, to: t0 + 50000, speed: 1, kind: 'big', label: '자정 입금마감 물량', revealed: false };
          W.push(w);
          const n = rng.int(this.D.big[0], this.D.big[1]);
          for (let i = 0; i < n; i++) this.scheduleRelease(t0 + rng.range(300, 25000), 1000 + rng.exp(8000 * f));
          this.post(day(d - 1, 21, rng.int(0, 50)), rng.pick([
            '오늘 자정에 입금기한 끝나는 표 꽤 있대요 👀',
            '자정 취켓 가실 분? 무통장 미입금 물량 좀 될 듯',
            '어제 무통장으로 잡은 사람 많던데 오늘 자정 노려봐요',
          ]), null, w);
          this.clock.at(t0 + rng.range(8000, 20000), () => this.pushFeed(rng.pick(['00시 VIP 잡았어요ㅠㅠㅠ 감사합니다', '와 진짜 3초컷', '또 이선좌… 손이 느린가 봐요', 'R석 겨우 잡음!! 다들 화이팅']), null));
        } else {
          W.push({ from: t0 - MIN, to: t0 + 8 * MIN, speed: 90, kind: 'small', label: '자정', revealed: true });
          const n = rng.int(1, 4);
          for (let i = 0; i < n; i++) this.scheduleRelease(t0 + rng.range(0, 60000), 5000 + rng.exp(150000 * f));
        }
      }

      // 2) 취소수수료 구간이 바뀌기 전날 밤 취소 러시
      const surges = [
        [day(1, 21), day(2, 0), '내일부터 취소수수료 10%라 오늘 밤 취소 좀 나올 듯요'],
        [day(4, 21), day(5, 0), '자정 지나면 수수료 20%로 오름 → 오늘 밤이 기회'],
        [day(8, 21), day(9, 0), '내일부터 수수료 30%… 마지막 고민하는 사람들 취소할 듯'],
        [day(10, 14), END, '오늘 17시 취소마감! 마지막 물량 노려봅시다 🔥'],
      ];
      for (const [from, to, hint] of surges) {
        const w = { from, to, speed: 240, kind: 'surge', label: to === END ? '취소마감 직전' : '수수료 인상 전 취소 러시', revealed: false };
        W.push(w);
        const n = rng.poisson(5 * (to - from) / H);
        for (let i = 0; i < n; i++) this.scheduleRelease(rng.range(from, to), 20000 + rng.exp(15 * MIN * f));
        this.post(from - rng.range(40, 90) * MIN, hint, null, w);
      }

      // 3) 평소 랜덤 취소
      for (let t = START; t < END; t += H) {
        const h = new Date(t).getUTCHours();
        const n = rng.poisson(h >= 9 ? 0.4 : 0.05);
        for (let i = 0; i < n; i++) this.scheduleRelease(t + rng.range(0, H), MIN + rng.exp(60 * MIN * f));
      }

      // 커뮤니티 잡담 · 팁
      this.post(START + 3000, '취켓팅 팁) 무통장 입금기한 지난 표는 자정 넘어서 한꺼번에 풀리는 경우가 많아요');
      this.post(START + 9000, '그리고 수수료 오르기 전날 밤에 취소가 몰려요. 달력 체크 필수!');
      for (let t = START + 2 * H; t < END; t += rng.range(2, 5) * H) {
        const h = new Date(t).getUTCHours();
        if (h >= 9) this.post(t, rng.pick(CHATTER));
      }

      W.sort((a, b) => a.from - b.from);
      const b = new Set([END]);
      W.forEach(w => { b.add(w.from); b.add(w.to); });
      this.boundaries = [...b].sort((x, y) => x - y);

      // 핫타임 진입 알림
      for (const w of W) {
        if (w.kind === 'small') continue;
        this.clock.at(w.from, () => {
          if (this.sleepUntil) return;
          TS.toast(w.kind === 'big' ? '⏰ 곧 자정! 시간이 실시간으로 흐릅니다' : `🔥 ${w.label} · 시간이 느려집니다`, 'hot');
        });
      }
    }

    scheduleRelease(at, survival) {
      if (at >= END) return;
      this.clock.at(at, () => {
        const ids = this.pickSoldSeats();
        for (const id of ids) {
          if (!this.engine.freeSold(id)) continue;
          this.stats.releases++;
          TS.log('cancel', `취소 발생 → DEL seat:sold:${id} · INCRBY 재고 +1 (${this.venue.byId[id].short})`);
          this.clock.setTimeout(() => this.botTake(id), survival * this.rng.range(0.8, 1.2));
        }
      });
    }

    pickSoldSeats() {
      for (let i = 0; i < 60; i++) {
        const s = this.rng.pick(this.venue.seats);
        if (this.redis.get('seat:sold:' + s.id) === this.uuid) continue;
        if (!this.redis.has('seat:sold:' + s.id)) continue;
        const ids = [s.id];
        const nb = `${s.zone}-${s.row}-${s.col + 1}`;
        if (this.rng.chance(0.25) && this.venue.byId[nb] && this.redis.has('seat:sold:' + nb)) ids.push(nb);
        return ids;
      }
      return [];
    }

    botTake(id) {
      if (!this.engine.isAvailable(id)) return;
      const botId = 'bot:c' + (++this.stats.botTakes);
      const r = this.engine.lockSeats(botId, [id], 120);
      if (r.ok) {
        this.engine.confirm(botId, [id]);
        TS.log('bot', `다른 취켓러가 ${this.venue.byId[id].short} 선점 → 결제 완료`);
      }
    }

    post(t, text, user, reveal) { this.clock.at(t, () => this.pushFeed(text, user, reveal)); }

    pushFeed(text, user, reveal) {
      if (reveal) reveal.revealed = true;
      const item = { t: this.clock.now, user: user || this.rng.pick(NICKS) + this.rng.int(1, 99), text, hint: !!reveal };
      this.feed.push(item);
      const list = TS.$('.feed-list');
      if (list) {
        list.insertAdjacentHTML('beforeend', this.feedItemHtml(item));
        list.scrollTop = list.scrollHeight;
      }
      if (reveal) this.renderTimeline();
    }

    feedItemHtml(it) {
      return `<li class="${it.hint ? 'hint' : ''}"><div class="fi-head"><b>${TS.esc(it.user)}</b><time>${TS.fmt.mdd(it.t)} ${TS.fmt.hm(it.t)}</time></div><p>${TS.esc(it.text)}</p></li>`;
    }

    // ================= 시간 흐름 =================
    windowAt(now) {
      let best = null;
      for (const w of this.windows) if (now >= w.from && now < w.to && (!best || w.speed < best.speed)) best = w;
      return best;
    }

    speedAt(now) {
      if (this.focus) return { speed: 1, until: null };
      if (this.sleepUntil) {
        if (now < this.sleepUntil) return { speed: SLEEP_SPEED, until: this.sleepUntil };
        this.sleepUntil = null;
        TS.toast('☀️ 기상! 09:00입니다');
      }
      const base = SPEEDS[this.speedMode];
      const w = this.windowAt(now);
      const speed = w ? Math.min(base, w.speed) : base;
      let until = null;
      for (const b of this.boundaries) if (b > now) { until = b; break; }
      return { speed, until };
    }

    goSleep() {
      if (this.focus) { TS.toast('예매 진행 중에는 잘 수 없어요'); return; }
      const d = new Date(this.clock.now);
      let wake = TS.T(2026, d.getUTCMonth() + 1, d.getUTCDate(), 9);
      if (wake <= this.clock.now) wake += 24 * H;
      this.sleepUntil = Math.min(wake, END);
      TS.log('system', `💤 잠자기 → ${TS.fmt.mdd(this.sleepUntil)} ${TS.fmt.hm(this.sleepUntil)}까지 스킵`);
    }

    // ================= 클라이언트 API =================
    openBooking() {
      if (this.flow) return;
      if (this.player.phase === 'done') return;
      this.player.phase = 'booking';
      this.flow = new TS.BookingFlow(this);
      this.flow.open({ captcha: true });
    }

    reqSeatView(zoneId) {
      this.stats.refreshes++;
      return this.api.call('GET /seats' + (zoneId ? '/' + zoneId : ''), () => {
        const rl = this.api.rateLimit('seat:' + this.uuid, { max: 6, windowMs: 4000, blockMs: 10000 });
        if (rl.blocked) { if (rl.justBlocked) this.stats.blocks++; return { blocked: true, until: rl.until }; }
        return this.engine.view(zoneId);
      });
    }

    reqLock(ids) {
      return this.api.call('POST /seats/lock', () => {
        const r = this.engine.lockSeats(this.uuid, ids, 300);
        if (r.ok) {
          this.lockIds = ids; this.lockUntil = this.clock.now + 300000; this.focus = true;
          this.sleepUntil = null;
          TS.log('system', '🎯 좌석 선점 성공 → 결제 완료까지 시간이 실시간으로 흐릅니다', 'ok');
        }
        return r;
      });
    }

    // 플레이어가 놓은 좌석은 잠시 뒤 다른 취켓러가 가져간다
    rescheduleBots(ids) {
      for (const id of ids) this.clock.setTimeout(() => this.botTake(id), 2000 + this.rng.exp(20000 * this.D.f));
    }

    // focus는 해제 요청이 서버에 도착한 뒤에 푼다 (먼저 풀면 고배속으로 돌아가 네트워크 지연 동안 락이 만료됨)
    reqRelease(ids) {
      this.lockIds = null; this.releasing = true;
      return this.api.call('POST /seats/release', () => {
        const r = this.engine.release(this.uuid, ids);
        this.rescheduleBots(ids);
        this.releasing = false;
        if (!this.lockIds) this.focus = false;
        return r;
      });
    }

    reqPay(ids, method) {
      return this.api.call('POST /payment', () => {
        const r = this.engine.confirm(this.uuid, ids, { method });
        if (r.ok) {
          // focus 유지 → 실시간으로 흘러야 MQ Worker가 저장을 마친다
          this.player.phase = 'done'; this.lockIds = null;
          this.booked = { ids, bookingNo: r.bookingNo, at: this.clock.now };
        }
        return r;
      });
    }

    timeLeft() { return this.lockIds && this.player.phase !== 'done' ? this.lockUntil - this.clock.now : null; }

    onTimeout() {
      const ids = this.lockIds;
      this.focus = false; this.lockIds = null;
      if (ids) this.rescheduleBots(ids);
      if (this.flow) this.flow.gotoSeat(false);
      TS.dialog.alert('좌석 선점 시간이 만료되었습니다.\n좌석을 다시 선택해 주세요.');
      if (this.deadlinePassed) this.finish(false, 'DEADLINE');
    }

    onLockLost() { this.onTimeout(); }

    onAbort() {
      this.flow = null; this.lockIds = null;
      if (!this.releasing) this.focus = false;
      this.player.phase = 'product';
      if (this.deadlinePassed) this.finish(false, 'DEADLINE');
    }

    onDeadline() {
      this.deadlinePassed = true;
      TS.log('system', '취소마감 (관람일 전일 17:00)', 'warn');
      if (this.focus || this.player.phase === 'done') return; // 결제 중이면 마무리까지 기다린다
      this.clock.stop();
      TS.dialog.alert('취소마감 시간이 지났습니다.\n더 이상 취소표가 나오지 않습니다.').then(() => { if (TS.game === this) this.finish(false, 'DEADLINE'); });
    }

    finishSuccess() { this.finish(true); }

    finish(success, reason) {
      const seats = (success && this.booked ? this.booked.ids : []).map(id => this.venue.byId[id]);
      TS.lastResult = {
        kind: 'cancel', diff: this.D.label, diffKey: this.diffKey, success, reason,
        reasonText: { DEADLINE: '취소마감(관람일 전일 17:00)까지 표를 구하지 못했습니다.', GIVEUP: '취켓팅을 포기했습니다.' }[reason],
        seats: seats.map(s => ({ grade: s.grade, label: s.label })),
        bookingNo: this.booked && this.booked.bookingNo,
        dateLabel: this.dateLabel(),
        gotAt: this.booked && this.booked.at,
        dday: this.booked ? this.ddayLabel(this.booked.at) : '',
        releases: this.stats.releases, botTakes: this.stats.botTakes,
        refreshes: this.stats.refreshes, blocks: this.stats.blocks, taken: this.stats.taken, captchaFails: this.stats.captchaFails,
        realSec: (performance.now() - this.realStart) / 1000,
      };
      TS.endGame();
      location.hash = '#/result';
    }

    onF5() {
      if (this.flow) this.flow.onF5();
    }

    // ================= UI =================
    dateLabel() { return '2026.10.11(일) 17:00'; }
    fmtTime(t) { return `${TS.fmt.mdd(t)} ${TS.fmt.hmsms(t)}`; }
    fmtLogTime(t) { return `${TS.fmt.mdd(t)} ${TS.fmt.hms(t)}`; }
    ddayLabel(t) {
      const d0 = new Date(t); const dd = Math.round((TS.T(2026, 10, 11) - TS.T(2026, d0.getUTCMonth() + 1, d0.getUTCDate())) / (24 * H));
      return `D-${dd}`;
    }

    noticeHtml() {
      return `<div class="notice-box soldout"><b>매진</b><p>전 회차 매진되었습니다. 취소표 발생 시 예매가 가능합니다.</p><p class="muted">※ 취소마감: 관람일 전일 17:00 · 무통장입금 미입금 시 익일 자동취소</p></div>`;
    }

    panelHtml() {
      return `<div class="bp-title">관람일 선택</div>
        ${TS.pages.calendar({ sel: '1011', enabled: ['1011'], soldout: ['1010'] })}
        <div class="bp-title">회차 선택</div>
        <div class="bp-rounds"><button class="round sel">1회 17:00</button></div>
        <div class="bp-remain soldout">전석 매진 · 취소표 발생 시 예매 가능</div>
        <button class="btn-book" data-act="book">예매하기</button>`;
    }

    bindPage(root) {
      root.addEventListener('click', e => { if (e.target.closest('[data-act="book"]')) this.openBooking(); });
    }

    hudHtml() {
      return `<div class="hud-in">
        <span class="hud-mode">🔁 취켓팅 <em>${this.D.label}</em></span>
        <span class="hud-item hud-time"><b data-h="time">--</b><em data-h="dday"></em></span>
        <span class="hud-speed" data-h="speed"></span>
        <div class="hud-ctrl" role="group" aria-label="배속">
          <button data-sp="slow" title="느리게 (하루 2분)">🐢</button><button data-sp="norm" class="on" title="보통 (하루 15초)">▶</button><button data-sp="fast" title="빠르게 (하루 4초)">⏩</button>
          <button data-h="sleep" title="다음 날 09:00까지 스킵">💤 잠자기</button>
        </div>
        <span class="hud-sp"></span>
        <button class="hud-btn" data-h="quit">포기하기</button>
      </div>
      <div class="hud-tl"><div class="tl-track" data-h="track"></div></div>`;
    }

    sideHtml() {
      return `<aside class="feed"><div class="feed-head"><b>💬 취켓팅 커뮤니티</b><span>실시간</span></div><ol class="feed-list">${this.feed.map(it => this.feedItemHtml(it)).join('')}</ol>
        <div class="feed-foot">📌 표시된 글은 핫타임 힌트예요</div></aside>`;
    }

    bindHud(hud) {
      hud.addEventListener('click', e => {
        const sp = e.target.closest('[data-sp]');
        if (sp) {
          this.speedMode = sp.dataset.sp;
          TS.$$('[data-sp]', hud).forEach(b => b.classList.toggle('on', b === sp));
          return;
        }
        const b = e.target.closest('[data-h]'); if (!b) return;
        if (b.dataset.h === 'sleep') { if (this.sleepUntil) this.sleepUntil = null; else this.goSleep(); }
        if (b.dataset.h === 'quit') TS.dialog.confirm('취켓팅을 포기하고 결과를 보시겠습니까?').then(ok => { if (ok && TS.game === this) this.finish(false, 'GIVEUP'); });
      });
      this.renderTimeline();
    }

    renderTimeline() {
      const track = TS.$('[data-h="track"]'); if (!track) return;
      const pos = t => ((t - START) / (END - START) * 100).toFixed(3) + '%';
      let h = '';
      for (let d = 2; d <= 10; d++) h += `<span class="tl-day" style="left:${pos(day(d))}"><i>${TS.fmt.p2(10)}.${TS.fmt.p2(d)}</i></span>`;
      for (const w of this.windows) {
        if (!w.revealed || w.kind === 'small') continue;
        h += `<span class="tl-win ${w.kind}" style="left:${pos(w.from)};width:max(4px, ${((w.to - w.from) / (END - START) * 100).toFixed(3)}%)" title="${w.label}"></span>`;
      }
      h += '<span class="tl-now" data-h="now"></span>';
      track.innerHTML = h;
    }

    frame() {
      const now = this.clock.now;
      const set = (sel, v) => { const el = TS.$(`[data-h="${sel}"]`); if (el) el.innerHTML = v; };
      set('time', `${TS.fmt.mdd(now)} ${TS.fmt.hms(now)}`);
      set('dday', this.ddayLabel(now));
      const { speed } = this.clock.speedInfo();
      const w = this.windowAt(now);
      let label;
      if (this.player.phase === 'done') label = '✅ 예매 완료';
      else if (this.focus) label = '🎯 예매 진행 중 · 실시간';
      else if (this.sleepUntil) label = `💤 수면 중 · ${TS.fmt.hm(this.sleepUntil)} 기상`;
      else if (speed === 1) label = `⏰ 실시간 · ${w ? w.label : ''}`;
      else if (w && w.kind !== 'small') label = `🔥 ${w.label} · ×${TS.fmt.num(speed)}`;
      else label = `⚡ ×${TS.fmt.num(speed)}`;
      const sp = TS.$('[data-h="speed"]');
      if (sp) { sp.textContent = label; sp.classList.toggle('hot', speed <= 240 || this.focus); }
      const sleepBtn = TS.$('[data-h="sleep"]');
      if (sleepBtn) sleepBtn.textContent = this.sleepUntil ? '☀️ 깨어나기' : '💤 잠자기';
      const nowEl = TS.$('[data-h="now"]');
      if (nowEl) nowEl.style.left = Math.min(100, (now - START) / (END - START) * 100) + '%';
    }

    inspect() {
      const r = this.redis, st = this.engine.stock(), e = this.engine.stats;
      const keys = [];
      for (const g in TS.GRADES) keys.push([this.engine.stockKey(g), 'STRING', TS.fmt.num(st[g]), '취소 시 INCRBY, 선점 시 DECRBY']);
      keys.push(['seat:lock:*', 'STRING NX EX', TS.fmt.num(r.countPrefix('seat:lock:')), '결제 진행 중인 좌석']);
      keys.push(['seat:sold:*', 'STRING', TS.fmt.num(r.countPrefix('seat:sold:')), '판매 완료 좌석']);
      if (this.lockIds) keys.push([`seat:lock:${this.lockIds[0]}`, '나', `TTL ${r.ttl('seat:lock:' + this.lockIds[0])}s`, '결제 제한시간']);
      const { speed } = this.clock.speedInfo();
      return {
        keys,
        metrics: [
          ['게임 배속', `×${TS.fmt.num(speed)}`],
          ['풀린 취소표', TS.fmt.num(this.stats.releases)],
          ['다른 취켓러 선점', TS.fmt.num(this.stats.botTakes)],
          ['Lua 성공 / 실패', `${TS.fmt.num(e.luaOk)} / ${TS.fmt.num(e.luaFail)}`],
          ['내 조회 / 차단', `${this.stats.refreshes} / ${this.stats.blocks}`],
          ['MQ 대기 / 발행', `${this.mq.q.length} / ${TS.fmt.num(this.mq.published)}`],
          ['Worker → RDB', `${TS.fmt.num(this.mq.consumed)}건`],
          ['API 응답 지연', `${this.api.lastMs}ms`],
        ],
      };
    }
  }

  TS.ModeCancel = ModeCancel;
})(window.TS);
