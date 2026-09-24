// 대화상자 · 토스트 · 서버 들여다보기
import { useEffect, useRef } from 'preact/hooks';
import type { LogSrc } from '../../shared/model';
import { fmt } from '../../shared/time';
import { dialogs, toasts, type DialogReq } from '../app/dialog';
import type { Game } from '../app/session';
import { useSession } from './context';
import * as s from './Overlays.css';

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
    <div class={s.dialogBackdrop}><div class={s.dialog} role="alertdialog">
      <div class={s.dialogOrigin}>tickets.tikitaka.example 내용:</div>
      <div class={s.dialogMsg}>{d.msg.split('\n').map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</div>
      <div class={s.dialogActions}>
        {d.buttons.map(b => (
          <button key={b.label} ref={b.primary ? primary : undefined} class={s.dialogBtn({ primary: !!b.primary })} onClick={() => d.close(b.value)}>{b.label}</button>
        ))}
      </div>
    </div></div>
  );
}

export function Dialogs() {
  const list = dialogs.value;
  return <>{list.map((d, i) => <Dialog key={d.id} d={d} top={i === list.length - 1} />)}</>;
}

export function Toasts() {
  return <div class={s.toasts}>{toasts.value.map(t => <div key={t.id} class={s.toast({ kind: t.kind, out: t.out })}>{t.msg}</div>)}</div>;
}

const CHECKLIST: [string, string][] = [
  ['대기열 ZSET', 'queue:wait에 도착 시각을 score로 ZADD NX. 대기창의 순번이 ZRANK 결과입니다.'],
  ['Lua 원자 연산', 'lock_seats.lua가 좌석 락(SET NX EX)과 재고 차감(DECRBY)을 한 번에 처리합니다. 실패 시 "이미 선택된 좌석입니다".'],
  ['next_poll_ttl + Jitter', '대기창 하단에 서버가 내려준 다음 폴링 주기와 ±0.5초 지터가 표시됩니다.'],
  ['Active TTL', 'active:user:{uuid}에 EX를 걸어 예매창 남은 시간이 됩니다. 만료 키는 1초마다 sweep.'],
  ['MQ + Worker', '결제 성공 시 booking.confirmed를 발행하고 즉시 응답. Worker가 TPS 한도로 RDB에 저장합니다.'],
];
const SRC_LABEL: Record<LogSrc, string> = { system: 'SYS', scheduler: 'SCHED', redis: 'REDIS', lua: 'LUA', mq: 'MQ', api: 'API', cancel: 'CANCEL', bot: 'BOT' };

export function Inspector({ g }: { g: Game }) {
  const session = useSession();
  const open = session.inspectorOpen.value;
  const snap = session.inspect.value;
  const toggle = (): void => { session.inspectorOpen.value = !open; };
  const logTime = g.kind === 'cancel' ? (t: number) => `${fmt.mdd(t)} ${fmt.hms(t)}` : fmt.hmsms;
  return (
    <>
      {!open && <button class={s.fab} onClick={toggle}>🛠 서버 들여다보기</button>}
      <div class={s.panel({ open })}>
        <div class={s.head}><div><b class={s.headTitle}>🛠 서버 들여다보기</b><span class={s.headSub}>{session.link.where === 'worker' ? 'Web Worker 안에서' : '메인 스레드에서'} 돌아가는 가상 서버</span></div><button class={s.close} title="닫기" onClick={toggle}>✕</button></div>
        {open && (
          <div class={s.body}>
            {snap && <>
              <h5 class={s.section}>Redis 키</h5>
              <table class={s.keys}><tbody>{snap.keys.map(([k, type, val, note]) => (
                <tr key={k}>
                  <td class={s.keyCell}><code class={s.keyName}>{k}</code><small class={s.keyNote}>{type}</small></td>
                  <td class={s.keyCell}><b class={s.keyVal}>{val}</b>{note && <small class={s.keyNote}>{note}</small>}</td>
                </tr>
              ))}</tbody></table>
              <h5 class={s.section}>지표</h5>
              <div class={s.metrics}>{snap.metrics.map(([k, v]) => <div key={k} class={s.metric}><span class={s.metricName}>{k}</span><b class={s.keyVal}>{v}</b></div>)}</div>
            </>}
            <h5 class={s.section}>이벤트 로그</h5>
            <ol class={s.logs}>{session.logs.value.slice(-80).reverse().map((l, i) => (
              <li key={`${l.t}-${i}`} class={s.log}><time class={s.logTime}>{logTime(l.t)}</time><em class={s.logSrc({ src: l.src })}>{SRC_LABEL[l.src]}</em><span class={s.logMsg({ level: l.level })}>{l.msg}</span></li>
            ))}</ol>
            <h5 class={s.section}>md 체크리스트 대응</h5>
            <ul class={s.checklist}>{CHECKLIST.map(([t, d]) => <li key={t} class={s.checkItem}><b class={s.checkTitle}>✅ {t}</b><span class={s.checkDesc}>{d}</span></li>)}</ul>
          </div>
        )}
      </div>
    </>
  );
}
