// 좌석 선택 단계.
// 핵심 메커니즘: 화면의 좌석도는 "마지막으로 조회한 순간"의 스냅샷이다.
// 그 사이 다른 사람이 좌석을 잡아가도 새로고침 전까지는 비어 보인다 → 선택완료 시 "이미 선택된 좌석입니다."
import { batch, computed, signal } from '@preact/signals';
import type { SeatView } from '../../shared/model';
import { wallNow } from '../../shared/wall';
import type { SeatId } from '../../shared/venue';
import { dialog } from '../app/dialog';
import type { BookingGame } from './types';

export class SeatPicker {
  readonly view = signal<SeatView | null>(null);
  readonly avail = computed(() => new Set(this.view.value?.avail ?? []));
  readonly zone = signal<string | null>(null);
  readonly selected = signal<SeatId[]>([]);
  /** 조회 · 선점 요청 중 */
  readonly busy = signal(false);
  readonly locking = signal(false);
  /** 접근 제한 해제 시각 (실제 시각, epoch ms) */
  readonly blockedUntil = signal(0);

  constructor(private readonly game: BookingGame, private readonly onLocked: (ids: SeatId[]) => void) {}

  refresh(): Promise<void> { return this.load(this.zone.value); }

  async load(zone: string | null): Promise<void> {
    if (this.busy.value) return;
    if (wallNow() < this.blockedUntil.value) return this.showBlocked();
    this.busy.value = true;
    this.game.stats.refreshes++;
    const r = await this.game.seatView(zone);
    this.busy.value = false;
    if ('blocked' in r) {
      if (r.justBlocked) this.game.stats.blocks++;
      this.blockedUntil.value = r.until;
      return this.showBlocked();
    }
    if ('error' in r) return; // 예매 가능 시간 만료 — 타이머가 처리한다
    batch(() => {
      this.view.value = r;
      this.zone.value = zone;
      this.selected.value = []; // 새 조회 시 선택 초기화 (실제 예매창과 동일)
    });
  }

  private showBlocked(): Promise<void> {
    const sec = Math.ceil((this.blockedUntil.value - wallNow()) / 1000);
    return dialog.alert(`비정상적인 접근이 감지되어 서비스 이용이 일시적으로 제한되었습니다.\n약 ${sec}초 후 다시 시도해 주세요.`);
  }

  toggle(id: SeatId): void {
    if (!this.avail.value.has(id)) return;
    const sel = this.selected.value;
    if (sel.includes(id)) { this.selected.value = sel.filter(x => x !== id); return; }
    if (sel.length >= this.game.maxSeats) {
      void dialog.alert(`1인 최대 ${this.game.maxSeats}매까지 선택 가능합니다.`);
      return;
    }
    this.selected.value = [...sel, id];
  }

  async done(): Promise<void> {
    if (this.busy.value) return;
    if (!this.selected.value.length) { await dialog.alert('좌석을 선택해 주세요.'); return; }
    this.busy.value = true;
    this.locking.value = true;
    const ids = this.selected.value.slice();
    const r = await this.game.lock(ids);
    this.busy.value = false;
    this.locking.value = false;
    if ('error' in r) return;
    if (!r.ok) {
      this.game.stats.taken++;
      await dialog.alert(r.reason === 'SOLD_OUT' ? '선택하신 등급의 잔여석이 없습니다.' : '이미 선택된 좌석입니다.');
      if (r.reason === 'TAKEN') {
        const failed = r.failed;
        const v = this.view.value;
        batch(() => {
          if (v?.avail) this.view.value = { ...v, avail: v.avail.filter(x => x !== failed) };
          this.selected.value = this.selected.value.filter(x => x !== failed);
        });
      }
      return;
    }
    this.onLocked(ids);
  }
}
