# 티키타카 TICKET — 티켓팅 시뮬레이터

`code_artifact.md`(대규모 선착순 예매 시스템 가이드)의 아키텍처를 **브라우저 안의 가상 서버**로 재현한 티켓팅 연습 게임입니다.
빌드 · 설치 없이 `index.html`을 더블클릭하면 실행됩니다. (폰트만 CDN에서 불러오며, 오프라인이면 시스템 폰트로 대체)

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
| Redis ZSET / String EX·NX / EVAL | `js/server/miniRedis.js` |
| 대기열 등록 · 순위 · ZPOPMIN (군중은 도착 분포 곡선으로 모델링) | `js/server/queueService.js` |
| 원자적 좌석 선점 + 재고 차감 (Lua) | `js/server/bookingEngine.js` |
| MQ + Worker → RDB | `js/server/mq.js` |
| 응답 지연 · Rate limit | `js/server/api.js` |
| 게임 시계 (TTL · 폴링 · 압축 시간선) | `js/core/clock.js` |
| 입장 스케줄러 · Adaptive Polling + Jitter | `js/modes/modeOpen.js` |
| 취소표 이벤트 · 핫타임 배속 | `js/modes/modeCancel.js` |

## 개발용 로컬 서버 (선택)
```bash
python -m http.server 5173
```
