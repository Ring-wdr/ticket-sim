// 안심예매 보안문자 (게임 내 연출용 캡차)
(function (TS) {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

  function draw(canvas, text) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#f3f0e8'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `hsla(${Math.random() * 360},40%,40%,0.25)`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    ctx.textBaseline = 'middle';
    const step = W / (text.length + 0.6);
    for (let i = 0; i < text.length; i++) {
      ctx.save();
      ctx.translate(step * (i + 0.6), H / 2 + (Math.random() * 12 - 6));
      ctx.rotate((Math.random() - 0.5) * 0.7);
      ctx.font = `bold ${26 + Math.random() * 8}px Georgia, 'Times New Roman', serif`;
      ctx.fillStyle = `hsl(${Math.random() * 360},55%,30%)`;
      ctx.fillText(text[i], -10, 0);
      ctx.restore();
    }
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `hsla(${Math.random() * 360},50%,35%,0.55)`;
      ctx.lineWidth = 1 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, Math.random() * H);
      ctx.bezierCurveTo(W * 0.3, Math.random() * H, W * 0.6, Math.random() * H, W, Math.random() * H);
      ctx.stroke();
    }
  }

  TS.captcha = {
    mount(host, { onPass, onFail }) {
      const node = TS.el(`<div class="cap-overlay"><div class="cap-box">
        <div class="cap-title"><span class="cap-shield">🛡</span><b>안심예매</b> 보안문자 입력</div>
        <p class="cap-desc">부정 예매 방지를 위해 아래 문자를 입력해 주세요.<br>인증 후 좌석을 선택할 수 있습니다.</p>
        <div class="cap-img"><canvas width="230" height="66"></canvas><button class="cap-re" type="button" title="새로운 문자">↻</button></div>
        <input class="cap-input" maxlength="6" placeholder="대소문자 구분 없이 입력" autocomplete="off" spellcheck="false">
        <div class="cap-err"></div>
        <button class="btn-primary btn-block cap-ok" type="button">입력완료</button>
      </div></div>`);
      host.appendChild(node);
      const canvas = TS.$('canvas', node), input = TS.$('.cap-input', node), err = TS.$('.cap-err', node), box = TS.$('.cap-box', node);
      let text = '';
      const regen = () => {
        text = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
        draw(canvas, text); input.value = '';
      };
      const submit = () => {
        if (input.value.trim().toUpperCase() === text) { node.remove(); TS.log('system', '보안문자 인증 통과'); onPass && onPass(); return; }
        err.textContent = '문자를 정확히 입력해 주세요.';
        box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
        onFail && onFail(); regen(); input.focus();
      };
      TS.$('.cap-re', node).onclick = () => { regen(); input.focus(); };
      TS.$('.cap-ok', node).onclick = submit;
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submit(); } });
      regen();
      setTimeout(() => input.focus(), 30);
      return node;
    },
  };
})(window.TS);
