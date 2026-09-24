// DOM 헬퍼 · 브라우저 alert 풍 대화상자 · 토스트 · 포스터
(function (TS) {
  TS.$ = (sel, root = document) => root.querySelector(sel);
  TS.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  TS.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  TS.el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  // 네이티브 alert()은 JS 스레드를 멈춰 게임 시계까지 멈추므로, 크롬 alert 모양의 비차단 대화상자를 쓴다.
  TS.dialog = {
    _open(msg, buttons) {
      return new Promise(resolve => {
        const root = TS.$('#dialogs');
        const node = TS.el(`<div class="dlg-backdrop"><div class="dlg" role="alertdialog">
          <div class="dlg-origin">tickets.tikitaka.example 내용:</div>
          <div class="dlg-msg">${TS.esc(msg).replace(/\n/g, '<br>')}</div>
          <div class="dlg-actions">${buttons.map((b, i) => `<button class="dlg-btn ${b.primary ? 'primary' : ''}" data-i="${i}">${b.label}</button>`).join('')}</div>
        </div></div>`);
        root.appendChild(node);
        const close = v => { node.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
        const onKey = e => {
          if (root.lastElementChild !== node) return;
          if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); close(buttons.find(b => b.primary).value); }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(buttons[0].value); }
        };
        document.addEventListener('keydown', onKey, true);
        node.addEventListener('click', e => {
          const b = e.target.closest('[data-i]');
          if (b) close(buttons[+b.dataset.i].value);
        });
        setTimeout(() => { const p = node.querySelector('.primary'); if (p) p.focus(); });
      });
    },
    alert(msg) { return this._open(msg, [{ label: '확인', value: true, primary: true }]); },
    confirm(msg) { return this._open(msg, [{ label: '취소', value: false }, { label: '확인', value: true, primary: true }]); },
    isOpen() { return !!TS.$('#dialogs').children.length; },
  };

  TS.toast = (msg, kind = '') => {
    const n = TS.el(`<div class="toast ${kind}">${TS.esc(msg)}</div>`);
    TS.$('#toasts').appendChild(n);
    setTimeout(() => n.classList.add('out'), 3000);
    setTimeout(() => n.remove(), 3400);
  };

  TS.poster = (cls = '') => `<div class="poster ${cls}">
    <div class="poster-top">2026 WORLD TOUR</div>
    <div class="poster-title">LUMINA</div>
    <div class="poster-sub">〈AFTERGLOW〉<br>IN SEOUL</div>
    <div class="poster-foot">2026.10.10 — 10.11 · 티키타카 아레나</div>
  </div>`;
})(window.TS);
