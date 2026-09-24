# 티키타카 TICKET — 티켓팅 시뮬레이터

`code_artifact.md`(대규모 선착순 예매 시스템 가이드)의 아키텍처를 **브라우저 안의 가상 서버**로 재현한 티켓팅 연습 게임입니다.
TypeScript + Preact SPA. 가상 서버는 **Web Worker** 안에서 돌고, UI는 메시지로 받은 스냅샷만 봅니다 (`?server=main`을 붙이면 디버깅용으로 메인 스레드에서 실행).
바닐라 JS 프로토타입은 커밋 `0d25428`에서 볼 수 있습니다.

**플레이:** https://ring-wdr.github.io/ticket-sim/ (main에 push되면 GitHub Actions가 빌드해 Pages로 배포)

## 모드
| 모드 | 내용 |
|---|---|
| 🎫 오픈 티켓팅 | 20:00:00 정각 오픈 → 대기열 → 보안문자 → 좌석 선택 → 결제. 동시접속 2만 / 15만 / 100만 |
| 🔁 취켓팅 | 전석 매진 상태에서 10.01~10.10(취소마감)까지 약 9일을 압축. 자정 입금마감 물량 · 수수료 인상 전 취소 러시 · 랜덤 취소 |

- 좌석도는 **마지막 조회 시점의 스냅샷**입니다. 그 사이 다른 사람이 잡은 좌석을 고르면 `이미 선택된 좌석입니다.`
- `F5`(또는 Ctrl+R)는 게임 내 새로고침으로 동작합니다. 대기 중에 누르면 **대기순서가 초기화**됩니다.
- 좌석 조회를 너무 자주 하면 일시적으로 접근이 제한됩니다.
- 오른쪽 아래 **🛠 서버 들여다보기**에서 Redis 키 · 스케줄러 · Lua · MQ 상태와 로그를 실시간으로 볼 수 있습니다.

## md 개념 ↔ 구현
| md | 파일 |
|---|---|
| Redis ZSET / String EX·NX / EVAL | `src/sim/miniRedis.ts` |
| 대기열 등록 · 순위 · ZPOPMIN (군중은 도착 분포 곡선으로 모델링) | `src/sim/queueService.ts` |
| 원자적 좌석 선점 + 재고 차감 (Lua) | `src/sim/bookingEngine.ts` |
| MQ + Worker → RDB | `src/sim/mq.ts` |
| Rate limit | `src/sim/rateLimiter.ts` |
| 게임 시계 (TTL · 폴링 · 압축 시간선) | `src/sim/clock.ts` |
| 입장 스케줄러 · Adaptive Polling | `src/sim/modes/openServer.ts` |
| 취소표 이벤트 · 핫타임 배속 | `src/sim/modes/cancelServer.ts` |

## 개발
```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # 시뮬레이션 코어 테스트 (Vitest)
npm run typecheck  # TypeScript 7 — sim / worker / app 프로젝트별 lib로 각각 검사
npm run lint       # oxlint
```

| 폴더 | 역할 |
|---|---|
| `src/shared` | 서버·UI 공용 타입과 순수 데이터 (좌석도, 공연 정보, 포맷) |
| `src/sim` | 가상 서버 시뮬레이션 코어. DOM · 타이머 없이 순수 TS, 시드 고정 재현 |
| `src/server` | Web Worker 진입점 · GameHost(네트워크 지연 · 시계 동기화 · 로그/들여다보기 전송) |
| `src/client` | Preact SPA — `app/`(세션 · 라우터 · 대화상자), `game/`(모드별 컨트롤러 · 예매 흐름 스토어), `net/`(서버 연결 · 시계 사본), `ui/`(컴포넌트) |

스타일은 [vanilla-extract](https://vanilla-extract.style/)로 컴포넌트 옆 `X.css.ts`에 둡니다 (빌드 때 정적 CSS로 뽑혀 런타임 비용 없음).
디자인 토큰 · 레이아웃 변수 · 반응형 구간은 `src/client/styles/theme.css.ts`, 여러 화면이 같이 쓰는 버튼 · 표 등은 `src/client/ui/shared.css.ts`.
상태에 따라 바뀌는 모양은 recipe 변형(`seat({ on, sel })`)으로, 요소마다 다른 색은 `assignInlineVars`로 넘깁니다.
