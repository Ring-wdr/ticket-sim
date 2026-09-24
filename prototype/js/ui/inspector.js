// 🛠 서버 들여다보기: 가상 서버 상태 · 로그 · md 체크리스트 대응표
(function (TS) {
  const CHECKLIST = [
    ['대기열 ZSET', '<code>queue:wait</code>에 도착 시각을 score로 <code>ZADD NX</code>. 대기창의 순번이 <code>ZRANK</code> 결과입니다.'],
    ['Lua 원자 연산', '<code>lock_seats.lua</code>가 좌석 락(SET NX EX)과 재고 차감(DECRBY)을 한 번에 처리합니다. 실패 시 "이미 선택된 좌석입니다".'],
    ['next_poll_ttl + Jitter', '대기창 하단에 서버가 내려준 다음 폴링 주기와 ±0.5초 지터가 표시됩니다.'],
    ['Active TTL', '<code>active:user:{uuid}</code>에 EX를 걸어 예매창 남은 시간이 됩니다. 만료 키는 1초마다 sweep.'],
    ['MQ + Worker', '결제 성공 시 <code>booking.confirmed</code>를 발행하고 즉시 응답. Worker가 TPS 한도로 RDB에 저장합니다.'],
  ];
  const SRC_LABEL = { system: 'SYS', scheduler: 'SCHED', redis: 'REDIS', lua: 'LUA', mq: 'MQ', api: 'API', cancel: 'CANCEL', bot: 'BOT' };

  TS.inspector = {
    open: false, logs: [], dirty: false,
    init() {
      this.node = TS.$('#inspector');
      this.node.innerHTML = `<button class="insp-fab" data-act="insp">🛠 서버 들여다보기</button>
        <div class="insp-panel">
          <div class="insp-head"><div><b>🛠 서버 들여다보기</b><span>브라우저 안에서 돌아가는 가상 서버</span></div><button data-act="insp" title="닫기">✕</button></div>
          <div class="insp-body">
            <div class="insp-stats"></div>
            <h5>이벤트 로그</h5><ol class="insp-logs"></ol>
            <h5>md 체크리스트 대응</h5>
            <ul class="insp-check">${CHECKLIST.map(([t, d]) => `<li><b>✅ ${t}</b><span>${d}</span></li>`).join('')}</ul>
          </div>
        </div>`;
      this.node.addEventListener('click', e => { if (e.target.closest('[data-act="insp"]')) this.toggle(); });
      TS.bus.on('log', e => { this.logs.push(e); if (this.logs.length > 300) this.logs.splice(0, 100); this.dirty = true; });
      setInterval(() => { if (this.open) this.render(); }, 300);
    },
    show(v) { this.node.hidden = !v; if (!v) { this.open = false; this.node.classList.remove('open'); } },
    reset() { this.logs = []; this.dirty = true; },
    toggle() { this.open = !this.open; this.node.classList.toggle('open', this.open); if (this.open) { this.dirty = true; this.render(); } },

    render() {
      const g = TS.game; if (!g || !g.inspect) return;
      const d = g.inspect();
      TS.$('.insp-stats', this.node).innerHTML = `
        <h5>Redis 키</h5>
        <table class="insp-tbl"><tbody>${d.keys.map(([k, type, val, note]) =>
          `<tr><td><code>${TS.esc(k)}</code><small>${type}</small></td><td><b>${val}</b>${note ? `<small>${note}</small>` : ''}</td></tr>`).join('')}</tbody></table>
        <h5>지표</h5>
        <div class="insp-metrics">${d.metrics.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
      if (this.dirty) {
        this.dirty = false;
        const fmt = g.fmtLogTime || (t => TS.fmt.hmsms(t));
        TS.$('.insp-logs', this.node).innerHTML = this.logs.slice(-80).reverse().map(l =>
          `<li class="lv-${l.level}"><time>${fmt(l.t)}</time><em class="src-${l.src}">${SRC_LABEL[l.src] || l.src}</em><span>${TS.esc(l.msg)}</span></li>`).join('');
      }
    },
  };
})(window.TS);
