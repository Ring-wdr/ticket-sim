// 게임 HUD(상단 바)와 오른쪽 패널(서버시간 / 커뮤니티 피드)
import { useEffect, useRef } from 'preact/hooks';
import type { SpeedMode } from '../../shared/model';
import { fmt, p2, T } from '../../shared/time';
import type { Game } from '../app/session';
import { ddayLabel, type CancelGame } from '../game/cancelGame';
import type { OpenGame } from '../game/openGame';
import { useSession } from './context';
import * as s from './Hud.css';

// ---------- 오픈 티켓팅 ----------
function OpenHud({ g }: { g: OpenGame }) {
  const session = useSession();
  const pcNow = session.now.value + g.pcOffset;
  return (
    <div class={s.bar}>
      <span class={s.mode}>🎫 오픈 티켓팅 <em class={s.modeBadge}>{g.label}</em></span>
      <span>내 PC 시계 <b class={s.value}>{fmt.hms(pcNow)}</b></span>
      <span>
        {pcNow < g.openAt
          ? <>오픈까지 <b class={s.value}>{fmt.mmss(g.openAt - pcNow)}</b> <small class={s.note}>(내 PC 기준)</small></>
          : <>오픈 후 <b class={s.value}>+{fmt.mmss(pcNow - g.openAt)}</b></>}
      </span>
      <span class={s.spacer} />
      <button class={s.btn} onClick={() => { g.showServerClock.value = !g.showServerClock.value; }}>⏱ 서버시간</button>
      <button class={s.btn} onClick={() => void g.giveUp()}>포기하기</button>
    </div>
  );
}

function ServerClock() {
  const session = useSession();
  return (
    <div class={s.srvClock}>
      <div class={s.srvHead}><span>🕐 서버시간 확인</span><small class={s.srvHost}>tickets.tikitaka.example</small></div>
      <div class={s.srvTime}>{fmt.hmsms(session.now.value)}</div>
      <div class={s.srvFoot}>응답 지연 약 <b>{session.tick.value?.latencyMs ?? '-'}</b>ms · 20:00:00 정각에 눌러보세요</div>
    </div>
  );
}

// ---------- 취켓팅 ----------
const SPEED_BUTTONS: [SpeedMode, string, string][] = [
  ['slow', '🐢', '느리게 (하루 2분)'], ['norm', '▶', '보통 (하루 15초)'], ['fast', '⏩', '빠르게 (하루 4초)'],
];

function speedLabel(g: CancelGame, speed: number): string {
  const st = g.status.value;
  const w = st?.window ?? null;
  if (g.phase.value === 'done') return '✅ 예매 완료';
  if (st?.focus) return '🎯 예매 진행 중 · 실시간';
  if (st?.sleepUntil != null) return `💤 수면 중 · ${fmt.hm(st.sleepUntil)} 기상`;
  if (speed === 1) return `⏰ 실시간 · ${w ? w.label : ''}`;
  if (w && w.kind !== 'small') return `🔥 ${w.label} · ×${fmt.num(speed)}`;
  return `⚡ ×${fmt.num(speed)}`;
}

function Timeline({ g }: { g: CancelGame }) {
  const session = useSession();
  const { start, end } = g.info;
  const pos = (t: number): string => `${((t - start) / (end - start) * 100).toFixed(3)}%`;
  const now = Math.min(100, (session.now.value - start) / (end - start) * 100);
  return (
    <div class={s.timeline}><div class={s.track}>
      {Array.from({ length: 9 }, (_, i) => i + 2).map(d =>
        <span key={d} class={s.day} style={{ left: pos(T(2026, 10, d)) }}><i class={s.dayLabel}>10.{p2(d)}</i></span>)}
      {g.windows.value.map(w =>
        <span key={w.from} class={s.hotWindow({ kind: w.kind })} title={w.label}
          style={{ left: pos(w.from), width: `max(4px, ${((w.to - w.from) / (end - start) * 100).toFixed(3)}%)` }} />)}
      <span class={s.nowMark} style={{ left: `${now}%` }} />
    </div></div>
  );
}

function CancelHud({ g }: { g: CancelGame }) {
  const session = useSession();
  const now = session.now.value;
  const tick = session.tick.value;
  const speed = tick?.running ? tick.speed : 0;
  const st = g.status.value;
  return (
    <>
      <div class={s.bar}>
        <span class={s.mode}>🔁 취켓팅 <em class={s.modeBadge}>{g.label}</em></span>
        <span><b class={`${s.value} ${s.time}`}>{fmt.mdd(now)} {fmt.hms(now)}</b><em class={s.dday}>{ddayLabel(now)}</em></span>
        <span class={s.speed({ hot: (speed > 0 && speed <= 240) || !!st?.focus })}>{speedLabel(g, speed)}</span>
        <div class={s.ctrl} role="group" aria-label="배속">
          {SPEED_BUTTONS.map(([m, icon, title]) =>
            <button key={m} class={s.ctrlBtn({ on: g.speedMode.value === m })} title={title} onClick={() => g.setSpeed(m)}>{icon}</button>)}
          <button class={s.ctrlBtn()} title="다음 날 09:00까지 스킵" onClick={() => void g.toggleSleep()}>{g.sleeping.value ? '☀️ 깨어나기' : '💤 잠자기'}</button>
        </div>
        <span class={s.spacer} />
        <button class={s.btn} onClick={() => void g.giveUp()}>포기하기</button>
      </div>
      <Timeline g={g} />
    </>
  );
}

function Feed({ g }: { g: CancelGame }) {
  const list = useRef<HTMLOListElement>(null);
  const items = g.feed.value;
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);
  return (
    <aside class={s.feed}>
      <div class={s.feedHead}><b>💬 취켓팅 커뮤니티</b><span class={s.live}>● 실시간</span></div>
      <ol class={s.feedList} ref={list}>
        {items.map((it, i) => (
          <li key={i} class={s.feedItem({ hint: it.hint })}>
            <div class={s.feedMeta}><b class={s.feedUser}>{it.user}</b><time>{fmt.mdd(it.t)} {fmt.hm(it.t)}</time></div>
            <p class={s.feedText}>{it.hint && '📌 '}{it.text}</p>
          </li>
        ))}
      </ol>
      <div class={s.feedFoot}>📌 표시된 글은 핫타임 힌트예요</div>
    </aside>
  );
}

export function Hud({ g }: { g: Game }) {
  return g.kind === 'open' ? <OpenHud g={g} /> : <CancelHud g={g} />;
}

export function Side({ g }: { g: Game }) {
  if (g.kind === 'cancel') return <Feed g={g} />;
  return g.showServerClock.value ? <ServerClock /> : null;
}
