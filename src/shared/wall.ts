// 양쪽 스레드(메인 · Worker)에서 같은 기준으로 읽히는 실제 시각 (epoch ms).
// performance.now()는 컨텍스트마다 기준점이 달라 timeOrigin을 더한다.
// 브라우저 API라 순수 시뮬레이션 프로젝트(tsconfig.sim.json)에서는 제외된다.
export const wallNow = (): number => performance.timeOrigin + performance.now();
