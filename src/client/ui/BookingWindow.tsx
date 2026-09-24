// 예매창(팝업 윈도 연출): 단계 표시 · 남은 시간 · 03~완료 단계. 02 좌석 선택은 SeatStep.
import type { PayMethod } from '../../shared/model';
import { fmt } from '../../shared/time';
import { GRADES, SHOW, type GradeKey } from '../../shared/venue';
import { STEPS, type BookingFlow, type Receive } from '../game/bookingFlow';
import { Captcha } from './Captcha';
import { cx } from './cx';
import { SeatStep } from './SeatStep';

function Timer({ flow }: { flow: BookingFlow }) {
  const ms = flow.game.timeLeft.value;
  if (ms == null) return null;
  return <div class={cx('pw-timer', ms < 60000 && 'warn')}><span>남은 시간</span><b>{fmt.mmss(ms)}</b></div>;
}

function Summary({ flow }: { flow: BookingFlow }) {
  const a = flow.amount();
  return (
    <aside class="my-info"><h4>My 예매정보</h4><dl>
      <dt>일시</dt><dd>{flow.game.dateLabel()}</dd>
      <dt>선택좌석</dt><dd>{flow.seats().map(s => <div key={s.id}>{GRADES[s.grade].name} {s.label}</div>)}</dd>
      <dt>티켓금액</dt><dd>{fmt.won(a.ticket)}</dd>
      <dt>예매수수료</dt><dd>{fmt.won(a.fee)}</dd>
      <dt class="tot">총 결제금액</dt><dd class="tot">{fmt.won(a.total)}</dd>
    </dl></aside>
  );
}

function Actions({ onPrev, onNext, next = '다음단계', busy = false }: {
  onPrev: () => void; onNext: () => void; next?: string; busy?: boolean;
}) {
  return (
    <div class="step-actions">
      <button class="btn-line" onClick={onPrev}>이전단계</button>
      <button class="btn-primary" disabled={busy} onClick={onNext}>{next}</button>
    </div>
  );
}

function PriceStep({ flow }: { flow: BookingFlow }) {
  const byGrade = new Map<GradeKey, number>();
  for (const s of flow.seats()) byGrade.set(s.grade, (byGrade.get(s.grade) ?? 0) + 1);
  return (
    <>
      <div class="step-wrap two-col">
        <section class="step-main"><h3 class="st-title">가격/할인 선택</h3>
          <table class="tbl"><thead><tr><th>좌석등급</th><th>가격구분</th><th>가격</th><th>매수</th></tr></thead><tbody>
            {[...byGrade].map(([g, n]) => (
              <tr key={g}>
                <td><i class="dot" style={{ background: GRADES[g].color }} />{GRADES[g].name}</td>
                <td>일반(정가)</td><td>{fmt.won(GRADES[g].price)}</td>
                <td><select disabled><option>{n}매</option></select></td>
              </tr>
            ))}
          </tbody></table>
          <ul class="note"><li>할인은 증빙이 필요하며, 본 시뮬레이터에서는 일반가만 제공됩니다.</li><li>이전단계로 돌아가면 선택한 좌석은 반환됩니다.</li></ul>
        </section>
        <Summary flow={flow} />
      </div>
      <Actions onPrev={() => flow.backToSeat()} onNext={() => flow.gotoConfirm()} />
    </>
  );
}

const RECEIVE: [Receive, string][] = [['mobile', '모바일티켓'], ['onsite', '현장수령']];

function ConfirmStep({ flow }: { flow: BookingFlow }) {
  const receive = flow.receive.value;
  return (
    <>
      <div class="step-wrap two-col">
        <section class="step-main"><h3 class="st-title">티켓 수령방법</h3>
          <div class="radio-row">
            {RECEIVE.map(([v, label]) => (
              <label key={v}><input type="radio" name="rcv" value={v} checked={receive === v} onChange={() => { flow.receive.value = v; }} /> {label}</label>
            ))}
          </div>
          <h3 class="st-title">예매자 확인</h3>
          <table class="form-tbl"><tbody>
            <tr><th>이름</th><td><input value="김티켓" readOnly /></td></tr>
            <tr><th>생년월일</th><td><input value="******" readOnly /></td></tr>
            <tr><th>휴대폰</th><td><input value="010-1234-****" readOnly /></td></tr>
            <tr><th>이메일</th><td><input value="guest@tikitaka.example" readOnly /></td></tr>
          </tbody></table>
          <label class="agree">
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
      <div class="step-wrap two-col">
        <section class="step-main"><h3 class="st-title">결제수단 선택</h3>
          <div class="pay-methods">
            {PAY_METHODS.map(([v, label]) => (
              <label key={v} class={cx(method === v && 'on')}><input type="radio" name="pay" value={v} checked={method === v} onChange={() => { flow.payMethod.value = v; }} /> {label}</label>
            ))}
          </div>
          <p class="pay-note">
            {method === 'bank'
              ? '무통장입금: 예매 다음날 23:59까지 입금하지 않으면 자동 취소됩니다. (이 표들이 자정에 취소표로 풀립니다)'
              : method === 'card' ? '신용카드 결제 시 즉시 예매가 확정됩니다.' : '선택하신 결제수단으로 즉시 결제 후 예매가 확정됩니다.'}
          </p>
          <h3 class="st-title">취소수수료 안내</h3>
          <table class="tbl small"><tbody>
            <tr><td>예매 후 7일 이내</td><td>없음</td></tr>
            <tr><td>예매 후 8일 ~ 관람일 10일전</td><td>뮤지컬/콘서트 4,000원</td></tr>
            <tr><td>관람일 9일전 ~ 7일전</td><td>티켓금액의 10%</td></tr>
            <tr><td>관람일 6일전 ~ 3일전</td><td>티켓금액의 20%</td></tr>
            <tr><td>관람일 2일전 ~ 1일전</td><td>티켓금액의 30%</td></tr>
          </tbody></table>
          <label class="agree">
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
    <div class="done-wrap">
      <div class="done-ico">✓</div>
      <h2>예매가 완료되었습니다</h2>
      <p class="muted">예매번호 <b class="bno">{flow.bookingNo.value}</b></p>
      <div class="done-card">
        <div><span>공연</span><b>{SHOW.title}</b></div>
        <div><span>일시</span><b>{flow.game.dateLabel()}</b></div>
        <div><span>좌석</span><b>{flow.seats().map(s => <div key={s.id}>{GRADES[s.grade].name} {s.label}</div>)}</b></div>
        <div><span>결제금액</span><b>{fmt.won(a.total)}</b></div>
        <div><span>DB 저장</span>
          <b class={cx('persist', lag != null && 'ok')}>{lag != null ? `✅ 저장 완료 (MQ 지연 ${fmt.num(lag)}ms)` : '⏳ MQ 대기 중… Worker가 곧 저장합니다'}</b>
        </div>
      </div>
      <button class="btn-primary" onClick={() => flow.game.finishSuccess()}>결과 보기</button>
    </div>
  );
}

export function BookingWindow({ flow }: { flow: BookingFlow }) {
  const step = flow.step.value;
  const picker = flow.picker.value;
  return (
    <div class="popup-backdrop"><div class="popup-win">
      <div class="pw-bar">
        <span class="pw-dots"><i /><i /><i /></span>
        <span class="pw-url">🔒 tickets.tikitaka.example/booking/lumina2026</span>
        <button class="pw-x" title="닫기" onClick={() => void flow.askClose()}>✕</button>
      </div>
      <div class="pw-head">
        <div class="pw-title"><b>{SHOW.title}</b><span>{flow.game.dateLabel()} · {SHOW.venue}</span></div>
        <Timer flow={flow} />
      </div>
      <ol class="pw-steps">
        {STEPS.map((s, i) => {
          const n = i + 1;
          return <li key={s} class={cx(n === step && 'on', n < step && 'done')}><em>0{n}</em>{s}</li>;
        })}
      </ol>
      <div class="pw-body">
        {step === 2 && picker && <div class="step-wrap"><SeatStep picker={picker} game={flow.game} /></div>}
        {step === 2 && flow.captcha.value && <Captcha onPass={() => flow.passCaptcha()} onFail={() => flow.failCaptcha()} />}
        {step === 3 && <PriceStep flow={flow} />}
        {step === 4 && <ConfirmStep flow={flow} />}
        {step === 5 && <PaymentStep flow={flow} />}
        {step === 6 && <DoneStep flow={flow} />}
      </div>
    </div></div>
  );
}
