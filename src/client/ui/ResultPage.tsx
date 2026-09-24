import { assignInlineVars } from '@vanilla-extract/dynamic';
import { GRADES, SHOW } from '../../shared/venue';
import { dialog, toast } from '../app/dialog';
import { resultComment, resultRank, resultRows, resultText } from '../app/result';
import { Footer, Header, Poster } from './common';
import { useSession } from './context';
import * as s from './ResultPage.css';
import { btn, container, gradeColor } from './shared.css';

export function ResultPage() {
  const session = useSession();
  const r = session.lastResult.value;
  if (!r) {
    return <><Header /><main class={`${container} ${s.page}`}><p>결과가 없습니다. <a href="#/">홈으로</a></p></main><Footer /></>;
  }
  const rank = resultRank(r);
  const copy = async (): Promise<void> => {
    const text = resultText(r);
    try {
      await navigator.clipboard.writeText(text);
      toast('결과를 복사했습니다');
    } catch {
      await dialog.alert(text);
    }
  };
  return (
    <>
      <Header />
      <main class={`${container} ${s.page}`}>
        <div class={s.card}>
          <div class={s.top}>
            <div>
              <span class={s.mode}>{r.kind === 'open' ? '🎫 오픈 티켓팅' : '🔁 취켓팅'} · {r.diff}</span>
              <h1 class={s.title}>{r.success ? '🎉 예매 성공!' : '😭 예매 실패'}</h1>
              <p class={s.comment}>{resultComment(r)}</p>
            </div>
            <div class={s.rank({ rank })}>{rank}</div>
          </div>
          {r.success ? (
            <div class={s.ticket}><Poster mini /><div class={s.ticketInfo}>
              <b>{SHOW.title}</b><span class={s.ticketDate}>{r.dateLabel}</span>
              {r.seats.map(seat => (
                <em key={seat.label} class={s.ticketSeat} style={assignInlineVars({ [gradeColor]: GRADES[seat.grade].color })}>
                  {GRADES[seat.grade].name} · {seat.label}
                </em>
              ))}
              <small class={s.ticketNo}>예매번호 {r.bookingNo ?? '-'}</small>
            </div></div>
          ) : <div class={s.reason}>{r.reasonText ?? ''}</div>}
          <table class={s.stats}><tbody>
            {resultRows(r).map(([k, v, note]) => (
              <tr key={k}><th class={s.statKey}>{k}</th><td class={s.statVal}>{v}{note ? <> <small class={s.statNote}>{note}</small></> : null}</td></tr>
            ))}
          </tbody></table>
          <div class={s.actions}>
            <button class={btn()} onClick={() => void session.start(r.kind, r.diffKey)}>다시 도전</button>
            <button class={btn({ kind: 'line' })} onClick={() => void copy()}>결과 복사</button>
            <a class={btn({ kind: 'line' })} href="#/">홈으로</a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
