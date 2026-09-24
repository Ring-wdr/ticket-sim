// 안심예매 보안문자 (게임 내 연출용 캡차)
import { useEffect, useRef, useState } from 'preact/hooks';
import * as s from './Captcha.css';
import { btn } from './shared.css';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function draw(canvas: HTMLCanvasElement, text: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#f3f0e8';
  ctx.fillRect(0, 0, W, H);
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
    ctx.fillText(text[i]!, -10, 0);
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

const randomText = (): string => Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');

export function Captcha({ onPass, onFail }: { onPass: () => void; onFail: () => void }) {
  const [text, setText] = useState(randomText);
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<HTMLInputElement>(null);

  // 문자가 바뀔 때마다(오입력 후 흔들림으로 다시 그려진 뒤 포함) 다시 그리고 입력칸에 초점
  useEffect(() => {
    if (canvas.current) draw(canvas.current, text);
    const t = setTimeout(() => field.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [text]);

  const regen = (): void => { setText(randomText()); setInput(''); };
  const submit = (): void => {
    if (input.trim().toUpperCase() === text) { onPass(); return; }
    setErr('문자를 정확히 입력해 주세요.');
    setShake(s => s + 1);
    onFail();
    regen();
  };

  return (
    <div class={s.overlay}>
      {/* key를 바꿔 흔들림 애니메이션을 다시 재생한다 */}
      <div class={s.box({ shake: shake > 0 })} key={shake}>
        <div class={s.title}><span>🛡</span><b class={s.brand}>안심예매</b> 보안문자 입력</div>
        <p class={s.desc}>부정 예매 방지를 위해 아래 문자를 입력해 주세요.<br />인증 후 좌석을 선택할 수 있습니다.</p>
        <div class={s.image}><canvas class={s.canvas} ref={canvas} width={230} height={66} /><button class={s.regen} type="button" title="새로운 문자" onClick={regen}>↻</button></div>
        <input ref={field} class={s.input} maxLength={6} placeholder="대소문자 구분 없이 입력" autoComplete="off" spellcheck={false}
          value={input} onInput={e => setInput(e.currentTarget.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submit(); } }} />
        <div class={s.error}>{err}</div>
        <button class={btn({ block: true })} type="button" onClick={submit}>입력완료</button>
      </div>
    </div>
  );
}
