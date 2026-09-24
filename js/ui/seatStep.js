// 좌석 선택 단계.
// 핵심 메커니즘: 화면의 좌석도는 "마지막으로 조회한 순간"의 스냅샷이다.
// 그 사이 다른 사람이 좌석을 잡아가도 새로고침 전까지는 비어 보인다 → 선택완료 시 "이미 선택된 좌석입니다."
(function (TS) {
  class SeatStep {
    constructor({ root, game, onLocked }) {
      this.root = root; this.game = game; this.onLocked = onLocked;
      this.venue = game.venue;
      this.view = null; this.zone = null; this.selected = [];
      this.busy = false; this.blockedUntil = 0;
      root.innerHTML = `<div class="seat-step">
        <div class="seat-main">
          <div class="seat-toolbar">
            <button class="btn-sm" data-act="map">전체 좌석도</button>
            <button class="btn-sm btn-refresh" data-act="refresh" title="새로고침 (F5)">↻ 새로고침</button>
            <span class="snap-time"></span>
          </div>
          <div class="seat-canvas"><div class="seat-loading">좌석 정보를 불러오는 중…</div></div>
          ${game.seatHint ? `<div class="seat-hint">${game.seatHint}</div>` : ''}
        </div>
        <aside class="seat-side">
          <div class="side-box"><h4>좌석등급 / 잔여석</h4><ul class="grade-list"></ul></div>
          <div class="side-box"><h4>선택좌석 <small>최대 ${game.maxSeats}매</small></h4><ul class="sel-list"></ul></div>
          <button class="btn-primary btn-block btn-done" data-act="done">좌석선택완료</button>
        </aside>
      </div>`;
      this.canvas = TS.$('.seat-canvas', root);
      root.addEventListener('click', e => this.onClick(e));
    }

    onClick(e) {
      const act = e.target.closest('[data-act]');
      if (act) {
        const a = act.dataset.act;
        if (a === 'refresh') return this.refresh();
        if (a === 'map') return this.load(null);
        if (a === 'done') return this.done();
      }
      const z = e.target.closest('[data-zone]');
      if (z) return this.load(z.dataset.zone);
      const s = e.target.closest('[data-seat]');
      if (s) return this.toggleSeat(s.dataset.seat);
    }

    refresh() { return this.load(this.zone); }

    async load(zoneId) {
      if (this.busy) return;
      if (performance.now() < this.blockedUntil) return this.showBlocked();
      this.busy = true; this.root.classList.add('is-loading');
      const r = await this.game.reqSeatView(zoneId);
      this.busy = false; this.root.classList.remove('is-loading');
      if (!r) return;
      if (r.blocked) { this.blockedUntil = r.until; return this.showBlocked(); }
      if (r.error) return;
      this.view = r; this.zone = zoneId;
      this.selected = []; // 새 조회 시 선택 초기화 (실제 예매창과 동일)
      this.render();
    }

    showBlocked() {
      const sec = Math.ceil((this.blockedUntil - performance.now()) / 1000);
      TS.dialog.alert(`비정상적인 접근이 감지되어 서비스 이용이 일시적으로 제한되었습니다.\n약 ${sec}초 후 다시 시도해 주세요.`);
      let ov = TS.$('.seat-blocked', this.root);
      if (!ov) { ov = TS.el('<div class="seat-blocked"><b>⛔ 접근 제한</b><span></span></div>'); TS.$('.seat-main', this.root).appendChild(ov); }
      const tick = () => {
        const left = this.blockedUntil - performance.now();
        if (left <= 0 || !ov.isConnected) { ov.remove(); return; }
        ov.querySelector('span').textContent = `${Math.ceil(left / 1000)}초 후 해제`;
        requestAnimationFrame(tick);
      };
      tick();
    }

    toggleSeat(id) {
      if (!this.view || !this.view.avail || !this.view.avail.has(id)) return;
      const i = this.selected.indexOf(id);
      if (i >= 0) this.selected.splice(i, 1);
      else {
        if (this.selected.length >= this.game.maxSeats) { TS.dialog.alert(`1인 최대 ${this.game.maxSeats}매까지 선택 가능합니다.`); return; }
        this.selected.push(id);
      }
      this.renderGrid(); this.renderSide();
    }

    async done() {
      if (this.busy) return;
      if (!this.selected.length) { TS.dialog.alert('좌석을 선택해 주세요.'); return; }
      this.busy = true;
      const btn = TS.$('.btn-done', this.root); btn.classList.add('loading'); btn.textContent = '처리 중…';
      const ids = this.selected.slice();
      const r = await this.game.reqLock(ids);
      this.busy = false; btn.classList.remove('loading'); btn.textContent = '좌석선택완료';
      if (!r || r.error) return;
      if (!r.ok) {
        this.game.stats.taken++;
        await TS.dialog.alert(r.reason === 'SOLD_OUT' ? '선택하신 등급의 잔여석이 없습니다.' : '이미 선택된 좌석입니다.');
        if (r.failed && this.view.avail) this.view.avail.delete(r.failed);
        this.selected = this.selected.filter(id => id !== r.failed);
        this.render();
        return;
      }
      this.onLocked(ids);
    }

    render() {
      const at = this.view.at;
      TS.$('.snap-time', this.root).innerHTML = `조회 기준 <b>${this.game.fmtTime(at)}</b>`;
      if (this.zone) this.renderGrid(); else this.renderMap();
      this.renderSide();
    }

    renderMap() {
      const v = this.view;
      const zones = this.venue.zones.map(z => {
        const [x, y, w, h] = z.rect; const n = v.zoneCounts[z.id];
        const col = n > 0 ? TS.GRADES[z.grade].color : '#d4d4db';
        return `<g class="zone ${n > 0 ? '' : 'soldout'}" data-zone="${z.id}">
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${col}"/>
          <text x="${x + w / 2}" y="${y + h / 2 - 6}">${z.id}</text>
          <text class="cnt" x="${x + w / 2}" y="${y + h / 2 + 12}">${n > 0 ? n + '석' : '매진'}</text>
        </g>`;
      }).join('');
      this.canvas.innerHTML = `<svg class="venue-map" viewBox="0 0 640 400" role="img" aria-label="좌석도">
        <rect class="stage" x="220" y="20" width="200" height="44" rx="4"/><text class="stage-t" x="320" y="47">STAGE</text>
        <rect class="floor-bg" x="214" y="82" width="212" height="172" rx="8"/>
        ${zones}
      </svg>
      <p class="map-note">구역을 선택하면 해당 구역의 좌석을 불러옵니다.</p>`;
    }

    renderGrid() {
      const z = this.venue.zoneById[this.zone]; const v = this.view;
      const g = TS.GRADES[z.grade];
      let cells = '';
      for (let r = 1; r <= z.rows; r++) {
        cells += `<div class="row-label">${r}열</div>`;
        for (let c = 1; c <= z.cols; c++) {
          const id = `${z.id}-${r}-${c}`;
          const on = v.avail.has(id); const sel = this.selected.includes(id);
          cells += `<button class="seat ${on ? 'on' : ''} ${sel ? 'sel' : ''}" data-seat="${id}" title="${TS.esc(this.venue.byId[id].label)}" ${on ? '' : 'disabled'} style="--c:${g.color}"></button>`;
        }
      }
      this.canvas.innerHTML = `<div class="grid-head"><button class="btn-sm" data-act="map">‹ 구역 다시 선택</button><b>${z.name}</b><span class="g-chip" style="--c:${g.color}">${g.name}</span></div>
        <div class="stage-bar">STAGE 방향</div>
        <div class="seat-grid" style="grid-template-columns: 36px repeat(${z.cols}, var(--seat))">${cells}</div>`;
    }

    renderSide() {
      const v = this.view;
      TS.$('.grade-list', this.root).innerHTML = Object.entries(TS.GRADES).map(([k, g]) =>
        `<li><i style="background:${g.color}"></i><span class="gn">${g.name}</span><span class="gp">${TS.fmt.won(g.price)}</span><b class="${v.stock[k] ? '' : 'zero'}">${v.stock[k]}석</b></li>`).join('');
      TS.$('.sel-list', this.root).innerHTML = this.selected.length
        ? this.selected.map(id => { const s = this.venue.byId[id]; return `<li><i style="background:${TS.GRADES[s.grade].color}"></i>${TS.GRADES[s.grade].name} · ${s.label}</li>`; }).join('')
        : '<li class="muted">선택한 좌석이 없습니다.</li>';
    }
  }

  TS.SeatStep = SeatStep;
})(window.TS);
