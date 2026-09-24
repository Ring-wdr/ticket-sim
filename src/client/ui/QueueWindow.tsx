// 접속 대기창 (오픈 티켓팅)
import { fmt } from '../../shared/time';
import type { OpenGame } from '../game/openGame';
import { useSession } from './context';
import { PopupWindow } from './PopupWindow';
import * as s from './QueueWindow.css';
import { logoMark, spinner } from './shared.css';

export function QueueWindow({ g }: { g: OpenGame }) {
  const session = useSession();
  const q = g.queue.value;
  if (!q) return null;
  const pct = q.initialRank > 1 ? (1 - (q.rank - 1) / q.initialRank) * 100 : 100;
  const left = q.nextPollAt != null ? Math.max(0, q.nextPollAt - session.now.value) / 1000 : 0;
  return (
    <PopupWindow path="waiting" size="narrow" onClose={() => void g.cancelQueue()}>
      <div class={s.body}>
        <div class={s.logo}><span class={logoMark({ size: 'small' })}>T</span>티키타카 TICKET</div>
        <h2 class={s.title}>접속 대기 중입니다</h2>
        <p class={s.sub}>현재 접속 인원이 많아 대기 중입니다.<br />잠시만 기다리시면 예매 페이지로 자동 연결됩니다.</p>
        <div class={s.rank}><span class={s.rankLabel}>나의 대기순서</span><strong class={s.rankNum}>{fmt.num(q.rank)}<small class={s.rankUnit}>번째</small></strong></div>
        <div class={s.bar}><i class={s.barFill} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} /></div>
        <div class={s.meta}><span>뒤에 <b>{fmt.num(q.behind)}</b>명</span><span>예상 대기 <b>{fmt.mmss(q.est * 1000)}</b></span></div>
        <div class={s.warn}>새로고침(F5)하거나 창을 닫으면 대기순서가 초기화되어<br />대기시간이 더 길어질 수 있습니다.</div>
        <div class={s.poll}>
          {q.polling || q.nextPollAt == null
            ? <><span class={spinner} /> 순번 확인 중…</>
            : <>다음 확인까지 <b>{left.toFixed(1)}s</b> · next_poll_ttl=<code class={s.pollCode}>{q.nextPollTtl}s</code> · jitter <code class={s.pollCode}>{q.jitter >= 0 ? '+' : ''}{q.jitter.toFixed(2)}s</code></>}
        </div>
      </div>
    </PopupWindow>
  );
}
