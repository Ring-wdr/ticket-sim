// Web Worker 진입점: 가상 서버(GameHost)를 메인 스레드 밖에서 돌린다.
// UI가 버벅여도 게임 시계 · 스케줄러 · 봇이 흔들리지 않고, UI는 메시지로 받은 스냅샷만 볼 수 있다.
import type { ClientMsg } from '../shared/protocol';
import { GameHost } from './gameHost';

const host = new GameHost(m => postMessage(m));
addEventListener('message', (e: MessageEvent<ClientMsg>) => host.handle(e.data));
