import type { LogEntry, SimEvent } from '../../shared/model';
import type { Clock } from '../clock';
import type { Log } from '../log';

/** 모드 서버가 바깥(Worker 또는 테스트)에 요구하는 것 */
export interface SimHost {
  log(e: LogEntry): void;
  emit(e: SimEvent): void;
  /** 실제 시각(epoch ms). 요청 빈도 제한에 쓴다 */
  wallNow(): number;
}

/** 게임 시각을 붙여 host로 넘기는 로거 */
export const clockLog = (host: SimHost, clock: Clock): Log =>
  (src, msg, level = 'info') => host.log({ src, msg, level, t: clock.now });
