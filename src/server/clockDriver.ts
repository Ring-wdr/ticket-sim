// 게임 시계를 실제 시간으로 구동한다 (Worker 안에서 실행).
// 탭이 가려지면 UI가 pause를 보내 게임 시간을 멈춘다 — 프로토타입의 "탭 비활성 시 사실상 정지"를 명시적으로 유지.
import type { Clock } from '../sim/clock';

const FRAME_MS = 16;
/** 한 프레임에 흘릴 수 있는 최대 실제 시간 (타이머 지연 후 폭주 방지) */
const MAX_STEP_MS = 200;

export class ClockDriver {
  private iv: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private paused = false;

  constructor(private readonly clock: Clock, private readonly onFrame: () => void = () => {}) {}

  start(): void {
    if (this.iv != null || this.clock.dead) return;
    this.last = performance.now();
    this.iv = setInterval(() => this.frame(), FRAME_MS);
  }

  stop(): void {
    if (this.iv != null) clearInterval(this.iv);
    this.iv = null;
  }

  setPaused(p: boolean): void {
    this.paused = p;
    this.last = performance.now(); // 재개할 때 멈춰 있던 시간을 흘리지 않는다
  }

  private frame(): void {
    const now = performance.now();
    const dt = Math.min(now - this.last, MAX_STEP_MS);
    this.last = now;
    if (this.paused) return;
    this.clock.advance(dt);
    this.onFrame();
  }
}
