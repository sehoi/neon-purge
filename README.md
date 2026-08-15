# NEON PURGE

브라우저에서 바로 돌아가는 탑다운 생존 액션(뱀서라이크). 빌드 도구·외부 라이브러리·에셋 파일이 **하나도 없다** — 그래픽은 전부 Canvas 벡터 도형, 사운드는 전부 WebAudio 절차 생성.

### ▶ [지금 플레이하기](https://sehoi.github.io/neon-purge/)

## 로컬에서 실행

```bash
node serve.mjs
```

그 다음 브라우저에서 http://localhost:5173 을 연다.

> ES 모듈은 `file://` 에서 CORS 로 막히므로 `index.html` 을 더블클릭하면 동작하지 않는다. 위 서버(의존성 없는 Node 내장 http)를 쓰거나 VS Code Live Server 를 쓴다.

## 조작

| 입력 | 동작 |
|---|---|
| `WASD` / 방향키 | 이동 |
| `Space` | 대시 (짧은 무적, 쿨다운 2초) |
| `1` `2` `3` / 클릭 | 강화 카드 선택 |
| `Esc` / `P` | 일시정지 |
| `M` | 음소거 |
| `G` | 글로우 on/off (프레임이 낮을 때) |
| 터치 | 좌측 가상 스틱 이동, 우측 탭으로 대시 |

공격은 전부 자동이다. 할 일은 움직이는 것뿐.

## 목표

10분을 버티면 커널 바이러스(보스)가 등장한다. 처치하면 클리어.
런이 끝나면 코드 조각을 얻고, 타이틀의 `업그레이드` 에서 영구 강화에 쓴다.

## 구조

```
index.html · style.css · serve.mjs
src/
  main.js        게임 루프 + 상태 머신
  config.js      전역 상수·팔레트
  core/          input · audio · rng · pool · grid · vec · save
  game/          world · player · enemy · weapon · pickup · upgrade · spawner · particle · camera
  data/          weapons · passives · enemies · waves · meta   (전부 순수 데이터 테이블)
  render/        renderer · shapes
  ui/            hud · screens · widgets
docs/
  GAME_DESIGN.md   기획서
  ARCHITECTURE.md  기술 설계
```

새 무기/적/강화를 추가하려면 `src/data/` 의 테이블에 객체 하나를 더하면 된다.

## 디버그 훅

개발 중 콘솔에서 쓸 수 있다.

```js
NP.start()          // 즉시 런 시작
NP.step(60)         // rAF 없이 60초분 시뮬레이션
NP.skipTo(840)      // 14분 지점으로 점프
NP.levelUp(5)       // 레벨업 5회 예약
NP.pickCard(0)      // 레벨업 카드 선택
NP.godMode()        // 무적
NP.world            // 월드 상태 전체
```

## 현재 상태

기획서의 M0~M7 구현 완료 — 코어 루프, 무기 5종 + 진화 3종, 패시브 5종, 적 6종, 엘리트 2종, 보스 3페이즈, 10분 타임라인, 영구 업그레이드, 저장, 성능 최적화.

성능은 최악 조건(적 213마리 + 파티클 364개 + 만렙 4무기)에서 프레임 중앙값 8.3ms / p99 12.9ms — 60fps 예산 안. 자세한 내용은 [ARCHITECTURE.md](docs/ARCHITECTURE.md)의 성능 절 참조.

남은 것:
- 사람 손으로 하는 밸런싱 (지금 수치는 시뮬레이션 봇으로만 검증했다)
- 시작 무기 선택 해금(`부트 옵션`) UI
