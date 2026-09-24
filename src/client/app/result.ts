// 게임 결과 (결과 화면 · 결과 복사)
import type { DiffKey, ModeKind } from '../../shared/model';
import { fmt } from '../../shared/time';
import { GRADES, GRADE_KEYS, type GradeKey } from '../../shared/venue';

export interface ResultSeat { grade: GradeKey; label: string }

interface ResultBase {
  kind: ModeKind;
  diff: string;
  diffKey: DiffKey;
  success: boolean;
  reasonText: string | null;
  seats: ResultSeat[];
  bookingNo: string | null;
  dateLabel: string;
  taken: number;
  captchaFails: number;
}

export interface OpenResult extends ResultBase {
  kind: 'open';
  reason: 'SOLDOUT' | 'GIVEUP' | 'TIMEOUT' | null;
  /** 서버 도착 시각 - 오픈 */
  reactionMs: number | null;
  /** 클릭 시각(서버 시계 기준) - 오픈 */
  clickErrMs: number | null;
  rank: number | null;
  pcOffset: number;
  early: number;
  waitSec: number | null;
  soldPctAtEntry: number | null;
  requeues: number;
  persistLagMs: number | null;
  elapsed: number;
}

export interface CancelResult extends ResultBase {
  kind: 'cancel';
  reason: 'DEADLINE' | 'GIVEUP' | null;
  gotAt: number | null;
  dday: string;
  releases: number;
  botTakes: number;
  refreshes: number;
  blocks: number;
  realSec: number;
}

export type GameResult = OpenResult | CancelResult;

/** [항목, 값, 보조설명] */
export type ResultRow = [string, string, string?];

const RANK_BY_GRADE: Record<GradeKey, string> = { VIP: 'S', R: 'A', S: 'B' };

export function resultRank(r: GameResult): string {
  if (!r.success || !r.seats.length) return 'F';
  const best = GRADE_KEYS.find(g => r.seats.some(s => s.grade === g))!;
  return RANK_BY_GRADE[best];
}

export function resultRows(r: GameResult): ResultRow[] {
  return r.kind === 'open' ? openRows(r) : cancelRows(r);
}

function openRows(r: OpenResult): ResultRow[] {
  const out: ResultRow[] = [];
  if (r.reactionMs != null && r.clickErrMs != null) {
    out.push(['서버 도착 시각', `20:00:00 ${fmt.signedSec(r.reactionMs)}`]);
    out.push(['클릭 시각 (서버 기준)', `20:00:00 ${fmt.signedSec(r.clickErrMs)}`, `네트워크 지연 ${fmt.num(r.reactionMs - r.clickErrMs)}ms`]);
  } else out.push(['서버 도착 시각', '대기열 진입 실패']);
  out.push(['내 PC 시계 오차', fmt.signedSec(r.pcOffset), `(서버보다 ${r.pcOffset >= 0 ? '빠름' : '느림'})`]);
  out.push(['오픈 전 클릭', `${r.early}회`]);
  if (r.rank != null) out.push(['최초 대기순번', `${fmt.num(r.rank)}번째`]);
  if (r.waitSec != null) out.push(['대기 시간', `${r.waitSec.toFixed(1)}초`]);
  if (r.soldPctAtEntry != null) out.push(['입장 시점 판매율', `${Math.round(r.soldPctAtEntry * 100)}%`]);
  out.push(['"이미 선택된 좌석입니다."', `${r.taken}회`]);
  out.push(['보안문자 오입력', `${r.captchaFails}회`]);
  out.push(['대기열 재진입', `${r.requeues}회`]);
  if (r.persistLagMs != null) out.push(['예매 DB 저장 지연 (MQ)', `${fmt.num(r.persistLagMs)}ms`]);
  out.push(['총 소요 (오픈 기준)', `${Math.round(r.elapsed)}초`]);
  return out;
}

function cancelRows(r: CancelResult): ResultRow[] {
  return [
    ['예매 시각 (게임 내)', r.gotAt ? `${fmt.mdd(r.gotAt)} ${fmt.hms(r.gotAt)}` : '-', r.gotAt ? r.dday : undefined],
    ['풀린 취소표', `${r.releases}장`, `봇이 가져간 표 ${r.botTakes}장`],
    ['새로고침/조회', `${r.refreshes}회`],
    ['접근 제한', `${r.blocks}회`],
    ['"이미 선택된 좌석입니다."', `${r.taken}회`],
    ['보안문자 오입력', `${r.captchaFails}회`],
    ['실제 플레이 시간', `${Math.floor(r.realSec / 60)}분 ${Math.round(r.realSec % 60)}초`],
  ];
}

export function resultComment(r: GameResult): string {
  if (r.kind === 'open') {
    if (r.success) {
      if (r.reactionMs != null && r.reactionMs < 150) return '0.1초대 도착. 손가락이 서버보다 빠릅니다.';
      if (r.taken >= 3) return `이선좌 ${r.taken}번을 뚫고 결국 잡았습니다.`;
      return '축하합니다! 이번 공연은 직관입니다.';
    }
    if (r.reason === 'SOLDOUT') return '전석 매진. 취켓팅 모드로 다시 노려보세요.';
    if (r.reason === 'TIMEOUT') return '예매 가능 시간이 만료되었습니다.';
    return '다음엔 서버시간을 확인하고 정각에 눌러보세요.';
  }
  if (r.success) return r.gotAt && new Date(r.gotAt).getUTCHours() === 0 ? '자정 입금마감 물량을 정확히 노렸습니다.' : '끈질긴 새로고침의 승리!';
  if (r.reason === 'DEADLINE') return '취소마감 시간이 지났습니다. 핫타임 힌트를 잘 살펴보세요.';
  return '취소표는 기다리는 사람에게 옵니다. 다시 도전해 보세요.';
}

export function resultText(r: GameResult): string {
  const lines = [
    `[티키타카 티켓팅 시뮬레이터] ${r.kind === 'open' ? '오픈 티켓팅' : '취켓팅'} (${r.diff})`,
    r.success ? `✅ 성공 · ${r.seats.map(s => `${GRADES[s.grade].name} ${s.label}`).join(', ')}` : '❌ 실패',
  ];
  if (r.kind === 'open' && r.reactionMs != null) lines.push(`도착 ${fmt.signedSec(r.reactionMs)} · 대기순번 ${fmt.num(r.rank ?? 0)} · 이선좌 ${r.taken}회`);
  if (r.kind === 'cancel') lines.push(`새로고침 ${r.refreshes}회 · 차단 ${r.blocks}회 · 이선좌 ${r.taken}회`);
  return lines.join('\n');
}
