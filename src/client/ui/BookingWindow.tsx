// 예매창(팝업 윈도 연출): 단계 표시 · 남은 시간 · 03~완료 단계. 02 좌석 선택은 SeatStep.
import { assignInlineVars } from '@vanilla-extract/dynamic';
import type { PayMethod } from '../../shared/model';
import { fmt } from '../../shared/time';
import { GRADES, SHOW, type GradeKey } from '../../shared/venue';
import { STEPS, type BookingFlow, type Receive } from '../game/bookingFlow';
import * as s from './BookingWindow.css';
import { Captcha } from './Captcha';
import { PopupWindow } from './PopupWindow';
import { SeatStep } from './SeatStep';
import { btn, gradeColor, muted, table } from './shared.css';

function Timer({ flow }: { flow: BookingFlow }) {
  const ms = flow.game.timeLeft.value;
  if (ms == null) return null;
  return <div class={s.timer}><span class={s.timerLabel}>남은 시간</span><b class={s.timerValue({ warn: ms < 60000 })}>{fmt.mmss(ms)}</b></div>;
}

function Summary({ flow }: { flow: BookingFlow }) {
  const a = flow.amount();
  return (
    <aside class={s.summary}><h4 class={s.summaryTitle}>My 예매정보</h4><dl class={s.summaryList}>
      <dt class={s.summaryKey}>일시</dt><dd class={s.summaryVal}>{flow.game.dateLabel()}</dd>
      <dt class={s.summaryKey}>선택좌석</dt><dd class={s.summaryVal}>{flow.seats().map(x => <div key={x.id}>{GRADES[x.grade].name} {x.label}</div>)}</dd>
      <dt class={s.summaryKey}>티켓금액</dt><dd class={s.summaryVal}>{fmt.won(a.ticket)}</dd>
      <dt class={s.summaryKey}>예매수수료</dt><dd class={s.summaryVal}>{fmt.won(a.fee)}</dd>
      <dt class={`${s.summaryKey} ${s.total}`}>총 결제금액</dt><dd class={`${s.summaryVal} ${s.total}`}>{fmt.won(a.total)}</dd>
    </dl></aside>
  );
}

function Actions({ onPrev, onNext, next = '다음단계', busy = false }: {
  onPrev: () => void; onNext: () => void; next?: string; busy?: boolean;
}) {
  return (
    <div class={s.actions}>
      <button class={`${btn({ kind: 'line' })} ${s.actionBtn}`} onClick={onPrev}>이전단계</button>
      <button class={`${btn()} ${s.actionBtn}`} disabled={busy} onClick={onNext}>{next}</button>
    </div>
  );
}

function PriceStep({ flow }: { flow: BookingFlow }) {
  const byGrade = new Map<GradeKey, number>();
  for (const x of flow.seats()) byGrade.set(x.grade, (byGrade.get(x.grade) ?? 0) + 1);
  return (
    <>
      <div class={s.stepWrap({ twoCol: true })}>
        <section><h3 class={s.sectionTitle}>가격/할인 선택</h3>
          <table class={table()}><thead><tr><th>좌석등급</th><th>가격구분</th><th>가격</th><th>매수</th></tr></thead><tbody>
            {[...byGrade].map(([g, n]) => (
              <tr key={g}>
                <td><i class={s.tableDot} style={assignInlineVars({ [gradeColor]: GRADES[g].color })} />{GRADES[g].name}</td>
                <td>일반(정가)</td><td>{fmt.won(GRADES[g].price)}</td>
                <td><select disabled><option>{n}매</option></select></td>
              </tr>
            ))}
          </tbody></table>
          <ul class={s.note}><li>할인은 증빙이 필요하며, 본 시뮬레이터에서는 일반가만 제공됩니다.</li><li>이전단계로 돌아가면 선택한 좌석은 반환됩니다.</li></ul>
        </section>
        <Summary flow={flow} />
      </div>
      <Actions onPrev={() => flow.backToSeat()} onNext={() => flow.gotoConfirm()} />
    </>
  );
}

const RECEIVE: [Receive, string][] = [['mobile', '모바일티켓'], ['onsite', '현장수령']];
const BUYER: [string, string][] = [['이름', '김티켓'], ['생년월일', '******'], ['휴대폰', '010-1234-****'], ['이메일', 'guest@tikitaka.example']];

function ConfirmStep({ flow }: { flow: BookingFlow }) {
  const receive = flow.receive.value;
  return (
    <>
      <div class={s.stepWrap({ twoCol: true })}>
        <section><h3 class={s.sectionTitle}>티켓 수령방법</h3>
          <div class={s.choices}>
            {RECEIVE.map(([v, label]) => (
              <label key={v}><input type="radio" name="rcv" value={v} checked={receive === v} onChange={() => { flow.receive.value = v; }} /> {label}</label>
            ))}
          </div>
          <h3 class={s.sectionTitle}>예매자 확인</h3>
          <table class={s.formTbl}><tbody>
            {BUYER.map(([k, v]) => <tr key={k}><th class={s.formTh}>{k}</th><td><input class={s.formInput} value={v} readOnly /></td></tr>)}
          </tbody></table>
          <label class={s.agree}>
            <input type="checkbox" checked={flow.agreeInfo.value} onChange={e => { flow.agreeInfo.value = e.currentTarget.checked; }} />
            {' '}위 예매자 정보를 확인하였으며, 개인정보 제3자 제공에 동의합니다.
          </label>
        </section>
        <Summary flow={flow} />
      </div>
      <Actions onPrev={() => flow.gotoPrice()} onNext={() => void flow.gotoPayment()} />
    </>
  );
}

const PAY_METHODS: [PayMethod, string][] = [['card', '신용카드'], ['bank', '무통장입금'], ['easy', '간편결제'], ['phone', '휴대폰결제']];

function PaymentStep({ flow }: { flow: BookingFlow }) {
  const method = flow.payMethod.value;
  return (
    <>
      <div class={s.stepWrap({ twoCol: true })}>
        <section><h3 class={s.sectionTitle}>결제수단 선택</h3>
          <div class={s.choices}>
            {PAY_METHODS.map(([v, label]) => (
              <label key={v} class={s.payMethod({ on: method === v })}><input type="radio" name="pay" value={v} checked={method === v} onChange={() => { flow.payMethod.value = v; }} /> {label}</label>
            ))}
          </div>
          <p class={s.payNote}>
            {method === 'bank'
              ? '무통장입금: 예매 다음날 23:59까지 입금하지 않으면 자동 취소됩니다. (이 표들이 자정에 취소표로 풀립니다)'
              : method === 'card' ? '신용카드 결제 시 즉시 예매가 확정됩니다.' : '선택하신 결제수단으로 즉시 결제 후 예매가 확정됩니다.'}
          </p>
          <h3 class={s.sectionTitle}>취소수수료 안내</h3>
          <table class={table({ size: 'small' })}><tbody>
            <tr><td>예매 후 7일 이내</td><td>없음</td></tr>
            <tr><td>예매 후 8일 ~ 관람일 10일전</td><td>뮤지컬/콘서트 4,000원</td></tr>
            <tr><td>관람일 9일전 ~ 7일전</td><td>티켓금액의 10%</td></tr>
            <tr><td>관람일 6일전 ~ 3일전</td><td>티켓금액의 20%</td></tr>
            <tr><td>관람일 2일전 ~ 1일전</td><td>티켓금액의 30%</td></tr>
          </tbody></table>
          <label class={s.agree}>
            <input type="checkbox" checked={flow.agreeAll.value} onChange={e => { flow.agreeAll.value = e.currentTarget.checked; }} />
            {' '}취소기한 및 취소수수료, 예매 약관에 모두 동의합니다.
          </label>
        </section>
        <Summary flow={flow} />
      </div>
      <Actions onPrev={() => flow.gotoConfirm()} onNext={() => void flow.pay()}
        next={flow.paying.value ? '결제 처리 중…' : '결제하기'} busy={flow.paying.value} />
    </>
  );
}

function DoneStep({ flow }: { flow: BookingFlow }) {
  const a = flow.amount();
  const lag = flow.persistLag.value;
  return (
    <div class={s.done}>
      <div class={s.doneIcon}>✓</div>
      <h2 class={s.doneTitle}>예매가 완료되었습니다</h2>
      <p class={muted}>예매번호 <b class={s.bookingNo}>{flow.bookingNo.value}</b></p>
      <div class={s.doneCard}>
        <div class={s.doneRow}><span class={s.doneKey}>공연</span><b>{SHOW.title}</b></div>
        <div class={s.doneRow}><span class={s.doneKey}>일시</span><b>{flow.game.dateLabel()}</b></div>
        <div class={s.doneRow}><span class={s.doneKey}>좌석</span><b>{flow.seats().map(x => <div key={x.id}>{GRADES[x.grade].name} {x.label}</div>)}</b></div>
        <div class={s.doneRow}><span class={s.doneKey}>결제금액</span><b>{fmt.won(a.total)}</b></div>
        <div class={s.doneRow}><span class={s.doneKey}>DB 저장</span>
          <b class={s.persist({ saved: lag != null })}>{lag != null ? `✅ 저장 완료 (MQ 지연 ${fmt.num(lag)}ms)` : '⏳ MQ 대기 중… Worker가 곧 저장합니다'}</b>
        </div>
      </div>
      <button class={btn()} onClick={() => flow.game.finishSuccess()}>결과 보기</button>
    </div>
  );
}

export function BookingWindow({ flow }: { flow: BookingFlow }) {
  const step = flow.step.value;
  const picker = flow.picker.value;
  return (
    <PopupWindow path="booking/lumina2026" size="wide" onClose={() => void flow.askClose()}>
      <div class={s.head}>
        <div><b class={s.showTitle}>{SHOW.title}</b><span class={s.showSub}>{flow.game.dateLabel()} · {SHOW.venue}</span></div>
        <Timer flow={flow} />
      </div>
      <ol class={s.steps}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          return <li key={label} class={s.step({ state: n === step ? 'on' : n < step ? 'done' : 'todo' })}><em class={s.stepNo}>0{n}</em>{label}</li>;
        })}
      </ol>
      <div class={s.body}>
        {step === 2 && picker && <div class={s.stepWrap()}><SeatStep picker={picker} game={flow.game} /></div>}
        {step === 2 && flow.captcha.value && <Captcha onPass={() => flow.passCaptcha()} onFail={() => flow.failCaptcha()} />}
        {step === 3 && <PriceStep flow={flow} />}
        {step === 4 && <ConfirmStep flow={flow} />}
        {step === 5 && <PaymentStep flow={flow} />}
        {step === 6 && <DoneStep flow={flow} />}
      </div>
    </PopupWindow>
  );
}
