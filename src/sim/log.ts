import type { LogLevel, LogSrc } from '../shared/model';

/** 서버 이벤트 로그. 시각은 호출하는 쪽이 아니라 로거가 게임 시계에서 붙인다 */
export type Log = (src: LogSrc, msg: string, level?: LogLevel) => void;

export const silentLog: Log = () => {};
