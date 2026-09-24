import { GRADES, SHOW } from '../../shared/venue';
import { dialog, toast } from '../app/dialog';
import { resultComment, resultRank, resultRows, resultText } from '../app/result';
import { Footer, Header, Poster } from './common';
import { useSession } from './context';
import { cx } from './cx';

export function ResultPage() {
  const session = useSession();
  const r = session.lastResult.value;
  if (!r) {
    return <><Header /><main class="container result-page"><p>결과가 없습니다. <a href="#/">홈으로</a></p></main><Footer /></>;
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
      <main class="container result-page">
        <div class={cx('res-card', r.success ? 'ok' : 'fail')}>
          <div class="res-top">
            <div>
              <span class="res-mode">{r.kind === 'open' ? '🎫 오픈 티켓팅' : '🔁 취켓팅'} · {r.diff}</span>
              <h1>{r.success ? '🎉 예매 성공!' : '😭 예매 실패'}</h1>
              <p>{resultComment(r)}</p>
            </div>
            <div class={cx('res-rank', `rank-${rank}`)}>{rank}</div>
          </div>
          {r.success ? (
            <div class="res-ticket"><Poster mini /><div>
              <b>{SHOW.title}</b><span>{r.dateLabel}</span>
              {r.seats.map(s => <em key={s.label} style={{ '--c': GRADES[s.grade].color }}>{GRADES[s.grade].name} · {s.label}</em>)}
              <small>예매번호 {r.bookingNo ?? '-'}</small>
            </div></div>
          ) : <div class="res-reason">{r.reasonText ?? ''}</div>}
          <table class="res-tbl"><tbody>
            {resultRows(r).map(([k, v, note]) => <tr key={k}><th>{k}</th><td>{v}{note ? <> <small>{note}</small></> : null}</td></tr>)}
          </tbody></table>
          <div class="res-actions">
            <button class="btn-primary" onClick={() => void session.start(r.kind, r.diffKey)}>다시 도전</button>
            <button class="btn-line" onClick={() => void copy()}>결과 복사</button>
            <a class="btn-line" href="#/">홈으로</a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
