// SPA 진입점: 해시 라우터(file://에서도 동작) · 게임 시작/종료 · F5 가로채기
(function (TS) {
  const MODES = { open: TS.ModeOpen, cancel: TS.ModeCancel };
  const app = TS.$('#app'), hud = TS.$('#hud'), side = TS.$('#side'), layer = TS.$('#layer');

  TS.startGame = function (kind, diff) {
    if (TS.game) TS.endGame();
    TS.inspector.reset();
    const g = new MODES[kind](diff);
    TS.game = g;
    g.start();
    hud.innerHTML = g.hudHtml();
    side.innerHTML = g.sideHtml();
    document.body.classList.add('in-game', 'mode-' + kind);
    g.bindHud(hud, side);
    TS.inspector.show(true);
    if (location.hash === '#/' + kind) render(); else location.hash = '#/' + kind;
  };

  TS.endGame = function () {
    const g = TS.game;
    if (!g) return;
    g.destroy();
    TS.game = null;
    hud.innerHTML = ''; side.innerHTML = ''; layer.innerHTML = '';
    TS.$('#dialogs').innerHTML = '';
    document.body.classList.remove('in-game', 'mode-open', 'mode-cancel');
    TS.inspector.show(false);
  };

  function route() { return (location.hash || '#/').slice(1) || '/'; }

  function render() {
    const r = route();
    // 게임 도중 다른 페이지로 이동하면 게임 종료
    if (TS.game && r !== '/' + TS.game.kind) TS.endGame();
    window.scrollTo(0, 0);
    if (r === '/open' || r === '/cancel') {
      const g = TS.game;
      if (!g) { location.hash = '#/'; return; }
      app.innerHTML = TS.pages.product(g);
      g.bindPage(app);
      return;
    }
    if (r === '/result') {
      app.innerHTML = TS.pages.result(TS.lastResult);
      return;
    }
    app.innerHTML = TS.pages.home();
  }

  // 전역 클릭: 게임 시작 · 결과 화면 버튼 · 게임 중 로고 클릭
  app.addEventListener('click', async e => {
    const start = e.target.closest('[data-start]');
    if (start) {
      const kind = start.dataset.start;
      const diff = (TS.$(`input[name="diff-${kind}"]:checked`) || {}).value || 'normal';
      TS.startGame(kind, diff);
      return;
    }
    const again = e.target.closest('[data-again]');
    if (again) { TS.startGame(again.dataset.again, again.dataset.diff); return; }
    if (e.target.closest('[data-copy]')) {
      const text = TS.pages.resultText(TS.lastResult);
      try { await navigator.clipboard.writeText(text); TS.toast('결과를 복사했습니다'); }
      catch (err) { TS.dialog.alert(text); }
      return;
    }
    const nav = e.target.closest('a[href^="#/"]');
    if (nav && TS.game) {
      e.preventDefault();
      if (await TS.dialog.confirm('진행 중인 게임을 종료하고 이동하시겠습니까?')) location.hash = nav.getAttribute('href');
    }
  });

  // F5 / Ctrl+R 은 게임 안의 "새로고침"으로 해석한다 (대기 중이면 순번 초기화!)
  document.addEventListener('keydown', e => {
    const isReload = e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'));
    if (!isReload || !TS.game) return;
    e.preventDefault();
    if (TS.dialog.isOpen()) return;
    TS.game.onF5();
  });

  window.addEventListener('hashchange', render);
  TS.inspector.init();
  render();
})(window.TS);
