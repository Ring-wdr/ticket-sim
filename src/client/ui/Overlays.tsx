// 대화상자 · 토스트 · 서버 들여다보기
import { useEffect, useRef } from 'preact/hooks';
import type { LogSrc } from '../../shared/model';
import { fmt } from '../../shared/time';
import { dialogs, toasts, type DialogReq } from '../app/dialog';
import { useSession } from './context';

function Dialog({ d, top }: { d: DialogReq; top: boolean }) {
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => { setTimeout(() => primary.current?.focus()); }, []);
  useEffect(() => {
    if (!top) return;
    // 게임의 F5 처리 등보다 먼저 받아서 Enter/Esc를 대화상자가 가져간다
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); d.close(d.buttons.find(b => b.primary)?.value ?? true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); d.close(d.buttons[0]!.value); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [d, top]);
  return (
    <div class="dlg-backdrop"><div class="dlg" role="alertdialog">
      <div class="dlg-origin">tickets.tikitaka.example 내용:</div>
      <div class="dlg-msg">{d.msg.split('\n').map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</div>
      <div class="dlg-actions">
        {d.buttons.map(b => (
          <button key={b.label} ref={b.primary ? primary : undefined} class={`dlg-btn ${b.primary ? 'primary' : ''}`} onClick={() => d.close(b.value)}>{b.label}</button>
        ))}
      </div>
    </div></div>
  );
}

export function Dialogs() {
  const list = dialogs.value;
  return <div id="dialogs">{list.map((d, i) => <Dialog key={d.id} d={d} top={i === list.length - 1} />)}</div>;
}

export function Toasts() {
  return <div id="toasts">{toasts.value.map(t => <div key={t.id} class={`toast ${t.kind} ${t.out ? 'out' : ''}`}>{t.msg}</div>)}</div>;
}

const CHECKLIST: [string, string][] = [
  ['대기열 ZSET', 'queue:wait에 도착 시각을 score로 ZADD NX. 대기창의 순번이 ZRANK 결과입니다.'],
  ['Lua 원자 연산', 'lock_seats.lua가 좌석 락(SET NX EX)과 재고 차감(DECRBY)을 한 번에 처리합니다. 실패 시 "이미 선택된 좌석입니다".'],
  ['next_poll_ttl + Jitter', '대기창 하단에 서버가 내려준 다음 폴링 주기와 ±0.5초 지터가 표시됩니다.'],
  ['Active TTL', 'active:user:{uuid}에 EX를 걸어 예매창 남은 시간이 됩니다. 만료 키는 1초마다 sweep.'],
  ['MQ + Worker', '결제 성공 시 booking.confirmed를 발행하고 즉시 응답. Worker가 TPS 한도로 RDB에 저장합니다.'],
];
const SRC_LABEL: Record<LogSrc, string> = { system: 'SYS', scheduler: 'SCHED', redis: 'REDIS', lua: 'LUA', mq: 'MQ', api: 'API', cancel: 'CANCEL', bot: 'BOT' };

export function Inspector() {
  const session = useSession();
  const g = session.game.value;
  const open = session.inspectorOpen.value;
  const snap = session.inspect.value;
  const toggle = (): void => { session.inspectorOpen.value = !open; };
  const logTime = g?.kind === 'cancel' ? (t: number) => `${fmt.mdd(t)} ${fmt.hms(t)}` : fmt.hmsms;
  return (
    <div id="inspector" hidden={!g} class={open ? 'open' : ''}>
      <button class="insp-fab" onClick={toggle}>🛠 서버 들여다보기</button>
      <div class="insp-panel">
        <div class="insp-head"><div><b>🛠 서버 들여다보기</b><span>브라우저 안에서 돌아가는 가상 서버</span></div><button title="닫기" onClick={toggle}>✕</button></div>
        {open && (
          <div class="insp-body">
            <div class="insp-stats">{snap && <>
              <h5>Redis 키</h5>
              <table class="insp-tbl"><tbody>{snap.keys.map(([k, type, val, note]) => (
                <tr key={k}><td><code>{k}</code><small>{type}</small></td><td><b>{val}</b>{note && <small>{note}</small>}</td></tr>
              ))}</tbody></table>
              <h5>지표</h5>
              <div class="insp-metrics">{snap.metrics.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
            </>}</div>
            <h5>이벤트 로그</h5>
            <ol class="insp-logs">{session.logs.value.slice(-80).reverse().map((l, i) => (
              <li key={`${l.t}-${i}`} class={`lv-${l.level}`}><time>{logTime(l.t)}</time><em class={`src-${l.src}`}>{SRC_LABEL[l.src]}</em><span>{l.msg}</span></li>
            ))}</ol>
            <h5>md 체크리스트 대응</h5>
            <ul class="insp-check">{CHECKLIST.map(([t, d]) => <li key={t}><b>✅ {t}</b><span>{d}</span></li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}
