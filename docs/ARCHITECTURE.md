# NEON PURGE — 기술 설계

> [GAME_DESIGN.md](GAME_DESIGN.md)의 기획을 코드 구조로 옮긴 문서. 구현 순서와 인터페이스 계약을 정의한다.

---

## 1. 기술 선택과 근거

| 결정 | 선택 | 근거 |
|---|---|---|
| 렌더링 | **Canvas 2D** | WebGL은 수백 개 도형 정도엔 과잉. 2D의 `shadowBlur` 글로우가 이 아트 스타일과 정확히 맞는다. |
| 빌드 도구 | **없음** (네이티브 ES 모듈) | `index.html`을 열면 곧바로 실행. 빌드 대기·설정 파일·의존성 이슈가 0. |
| 언어 | **JS + JSDoc 타입 주석** | TS 컴파일 단계를 없애되 에디터 자동완성은 유지. |
| 외부 라이브러리 | **없음** | 필요한 건 벡터 연산·풀·해시 그리드뿐. 전부 합쳐 200줄 미만. |
| 로컬 서버 | `npx serve` 또는 VS Code Live Server | ES 모듈은 `file://`에서 CORS로 막힌다. |

---

## 2. 파일 구조

```
neon-purge/
├── index.html               캔버스 1개 + 부트스트랩 <script type="module">
├── style.css                레터박스 레이아웃, 모바일 세이프에어리어
├── docs/
│   ├── GAME_DESIGN.md
│   └── ARCHITECTURE.md
└── src/
    ├── main.js              엔트리: 캔버스 셋업, 게임 루프, 상태 머신
    ├── config.js            전역 상수 (해상도, 물리 스텝, 색상 팔레트)
    │
    ├── core/
    │   ├── input.js         키보드 + 터치 → 정규화된 입력 벡터
    │   ├── audio.js         WebAudio 절차 SFX/BGM
    │   ├── rng.js           시드 가능한 PRNG (mulberry32)
    │   ├── pool.js          제네릭 오브젝트 풀
    │   ├── grid.js          공간 해시 그리드 (충돌 브로드페이즈)
    │   ├── vec.js           2D 벡터 헬퍼 (할당 없는 in-place 연산)
    │   └── save.js          localStorage 래퍼 (메타 진행/기록)
    │
    ├── game/
    │   ├── world.js         모든 엔티티 배열 보유, update/render 오케스트레이션
    │   ├── player.js        이동·대시·피격·XP·레벨
    │   ├── enemy.js         적 인스턴스 + AI 행동 함수 테이블
    │   ├── spawner.js       타임라인 기반 스폰 + 난이도 스케일링
    │   ├── weapon.js        무기 인스턴스, 쿨다운 틱, 발사 로직
    │   ├── projectile.js    탄환/빔/궤도 오브
    │   ├── pickup.js        XP·아이템 + 자석 흡인
    │   ├── upgrade.js       카드 추첨, 효과 적용, 스탯 재계산
    │   ├── particle.js      파편·플래시 파티클
    │   └── camera.js        추적 + 화면 흔들림 + 히트스톱
    │
    ├── data/
    │   ├── weapons.js       무기 5종 × 5레벨 테이블 + 진화
    │   ├── passives.js      패시브 5종 테이블
    │   ├── enemies.js       적 6종 + 엘리트 2종 + 보스 (행동은 behavior 함수로 동봉)
    │   ├── waves.js         15분 타임라인
    │   ├── upgrades.js      카드 정의 (무기/패시브/진화/소모품)
    │   └── meta.js          영구 업그레이드 테이블
    │
    ├── render/
    │   ├── renderer.js      드로우 순서, 글로우 배치, 배경 그리드
    │   └── shapes.js        폴리곤/링/빔 프리미티브
    │
    └── ui/
        ├── hud.js           인게임 오버레이
        ├── screens.js       타이틀/레벨업/일시정지/결과
        └── widgets.js       버튼·바·카드 공용 그리기 + 히트테스트
```

**의존 방향** (단방향, 순환 금지):
```
data  →  (아무것도 참조 안 함, 순수 상수)
core  →  config
game  →  core, data, config
render/ui → core, config, (game 상태를 읽기 전용으로)
main  →  전부
```

---

## 3. 게임 루프

**고정 타임스텝 + 누산기**. 프레임률에 관계없이 물리·밸런싱이 동일하게 재현되어야 한다.

```js
const STEP = 1 / 60;          // 물리 스텝 (초)
const MAX_FRAME = 0.25;       // 탭 전환 후 스파이럴 방지 클램프

let acc = 0, prev = performance.now();

function frame(now) {
  let dt = Math.min((now - prev) / 1000, MAX_FRAME);
  prev = now;

  if (hitstop > 0) { hitstop -= dt; dt = 0; }   // 히트스톱: 시간만 멈추고 렌더는 계속

  acc += dt;
  while (acc >= STEP) { update(STEP); acc -= STEP; }

  render(acc / STEP);          // 보간 알파 (위치 잔상 제거)
  requestAnimationFrame(frame);
}
```

### 상태 머신

```
BOOT → TITLE ⇄ META_UPGRADE
         ↓
       PLAYING ⇄ PAUSED
         ↓  ↑
      LEVELUP  (시간 정지, 입력만 처리)
         ↓
    GAMEOVER / VICTORY → TITLE
```

각 상태는 `{ enter(), update(dt), render(ctx), onInput(e) }` 를 구현한다. `PLAYING` 외 상태에서는 `world.update`를 호출하지 않고, 렌더만 프리즈 프레임으로 계속한다(배경이 정지하면 화면이 죽어 보인다).

---

## 4. 엔티티 모델

**ECS를 쓰지 않는다.** 이 규모에서는 오버엔지니어링이다. 대신 **타입별 배열 + 오브젝트 풀 + `alive` 플래그**를 쓴다.

```js
// world.js
const world = {
  player,
  enemies:     pool(Enemy,      512),
  projectiles: pool(Projectile, 1024),
  enemyShots:  pool(Projectile, 512),
  pickups:     pool(Pickup,     2048),
  particles:   pool(Particle,   1024),
  orbitals:    [],   // 최대 6개, 풀 불필요
};
```

### 오브젝트 풀 계약 (`core/pool.js`)

```js
pool.spawn()            // 비활성 슬롯 반환 + alive=true. 여유 없으면 가장 오래된 것 재사용
pool.forEach(fn)        // alive 인 것만 순회
pool.compact()          // 프레임 끝에서 죽은 것 제거 (swap-remove, O(n))
```

순회 도중 배열을 변형하지 않는다. 삭제는 `alive = false` 로 표시만 하고, `compact()`가 프레임 끝에 한 번 정리한다. (스플리터가 죽으면서 새 적을 스폰하는 케이스 때문에 필수.)

### 엔티티 공통 필드
```js
{ x, y, vx, vy, r, hp, maxHp, alive, type, flash, tint }
```

---

## 5. 충돌 처리

적 220마리 × 투사체 300개를 전수 비교하면 66,000회/프레임 → 공간 해시 그리드로 브로드페이즈를 건다.

```js
// core/grid.js — 셀 크기 = 최대 히트박스 지름의 약 2배
const CELL = 64;
grid.clear();
world.enemies.forEach(e => grid.insert(e));
grid.query(x, y, radius, callback);   // 주변 3×3 셀만 순회
```

**충돌 쌍**
| A | B | 판정 | 결과 |
|---|---|---|---|
| 플레이어 투사체 | 적 | 원-원 | 데미지, 관통 아니면 소멸 |
| 적 | 플레이어 | 원-원 | 접촉 데미지 (무적 아닐 때) |
| 적 탄 | 플레이어 | 원-원 | 데미지 |
| 궤도 오브 | 적 | 원-원 | 데미지 + 0.3s 개체별 재타격 쿨다운 |
| 픽업 | 플레이어 자석범위 | 거리 | 흡인 → 접촉 시 획득 |

**재타격 쿨다운**: 지속 판정 무기(펄스 링, 궤도, 레이저)는 적별로 `lastHitBy[weaponId]` 타임스탬프를 두어 매 프레임 데미지가 들어가는 것을 막는다. 이게 없으면 밸런싱이 통째로 무너진다.

**적끼리 충돌은 처리하지 않되**, 완전 겹침 방지를 위해 반경 내 적으로부터 약한 분리 벡터(separation, 최대 30px/s)만 적용한다. 정식 충돌 해결이 아니라 시각적 뭉침 완화용.

---

## 6. 데이터 테이블 형식

### 무기 (`data/weapons.js`)
```js
export const WEAPONS = {
  pulse: {
    id: 'pulse', name: '펄스 링', icon: 'ring', color: C.cyan,
    desc: lv => `주위에 충격파. 데미지 ${lv.dmg}, 반경 ${lv.radius}`,
    evolveWith: 'amp', evolveTo: 'supernova',
    levels: [
      { dmg:  8, radius:  90, cd: 1.40 },
      { dmg: 11, radius: 105, cd: 1.25 },
      { dmg: 13, radius: 120, cd: 1.10 },
      { dmg: 16, radius: 140, cd: 1.00 },
      { dmg: 18, radius: 160, cd: 0.90 },
    ],
    fire(world, self, stats) { /* 발사 구현 */ },
  },
  // ...
};
```

`fire()`는 **월드에 투사체를 스폰하는 것만** 담당한다. 쿨다운 관리·데미지 배율 적용은 `weapon.js`가 공통 처리한다. 새 무기 추가 = 이 객체 하나 추가.

### 스탯 파이프라인
플레이어 최종 스탯은 매 프레임 재계산하지 않고, **변경 시에만** 재계산한다(레벨업/픽업 획득 시).

```
base (config)
  → meta 영구 업그레이드 (곱연산)
  → 패시브 레벨 합산 (곱연산)
  = player.stats  { dmgMul, cdMul, moveSpd, maxHp, magnet, xpMul, dashCd }
```

무기 데미지 = `levels[lv].dmg × stats.dmgMul`, 쿨다운 = `levels[lv].cd × stats.cdMul`.

### 웨이브 (`data/waves.js`)
```js
export const TIMELINE = [
  { t:   0, spawn: { worm: 0.5 },                    cap:  40 },
  { t:  90, spawn: { worm: 0.6, spam: 0.8 },         cap:  60 },
  { t: 180, spawn: { worm: 0.6, spam: 0.9, tank: 0.15 }, cap: 80 },
  { t: 300, event: 'elite_demon' },
  // ... spawn 값 = 초당 스폰 마리 수
];
```
스포너는 현재 시각 이하의 마지막 엔트리를 적용하고, 각 적 타입별로 누산기를 굴려 `>= 1` 이 될 때 스폰한다.

---

## 7. 렌더링

**드로우 순서** (뒤 → 앞):
```
1. 배경 그리드 (패럴랙스 0.4)
2. 지면 데칼 (폭발 잔흔, 페이드)
3. 픽업
4. 적  → 엘리트/보스
5. 플레이어 + 트레일
6. 투사체 · 궤도 · 빔
7. 파티클
8. 화면 효과 (피격 비네트, 플래시)
9. HUD
10. 오버레이 화면 (레벨업/일시정지/결과)
```

### 글로우 성능 — `shadowBlur`를 쓰지 않는다

처음에는 "같은 색끼리 묶어 상태 전환을 줄이면 된다"고 가정했다. **틀렸다.** `ctx.shadowBlur`는 상태 전환 비용이 아니라 **그리는 도형 하나하나에 붙는 블러 래스터화 비용**이다. 묶어봐야 총량이 줄지 않는다.

실측(적 220마리 구간, `getImageData`로 파이프라인 flush 후 측정):

| 부하 | 프레임 |
|---|---|
| 전체 | 89.2 ms |
| − 픽업 1,500개 | 35.0 ms → **픽업이 54 ms** |
| − 레이저 빔 2줄 | 7.5 ms → **빔 2개가 27 ms** |
| − 적 35마리 | 2.8 ms |

길이 2,800px짜리 빔 하나가 13ms를 먹었다. 블러 영역 넓이에 비례하기 때문이다.

**대체 전략**: 굵은 반투명 외곽선 + 얇은 밝은 코어선을 겹쳐 그린다. 경로를 두 번 만들지만 블러 없는 stroke는 비교가 안 되게 싸다.

```js
function neon(ctx, color, width, drawPath) {
  ctx.strokeStyle = color;
  if (SETTINGS.glow) {
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = width * 3.4;
    drawPath();               // 외곽 번짐
    ctx.globalAlpha = 1;
  }
  ctx.lineWidth = width;
  drawPath();                 // 밝은 코어
}
```

채워진 도형(픽업·탄·궤도)은 반투명 큰 원(halo)을 한 겹 깔아 같은 효과를 낸다. 파티클은 개수가 가장 많으므로 글로우를 아예 걸지 않는다 — 밝은 색과 페이드만으로 충분히 네온으로 읽힌다.

결과: 적 249마리 + 탄 150개 + 빔 3줄에서 **185.9 ms → 8.8 ms** (약 21배).

`shadowBlur`는 UI(텍스트·패널·바)에만 남겼다. 프레임당 수십 개뿐이라 영향이 없다.

### 정지 화면 측정에 속지 말 것

위 수치는 `NP.draw()`만 반복해 잰 값이라 **실제보다 낙관적이었다.** 전투가 도는 상태(매 프레임 update + draw)로 다시 재니 중앙값 24.8ms, p99 68.5ms가 나왔다. 차이는 **파티클**이다. 정지 화면에서는 파티클이 생성되지 않지만, 실전에서는 광역 무기 하나가 200마리를 때릴 때마다 히트 플래시가 한꺼번에 쏟아진다.

성능은 반드시 **update 와 draw 를 함께 돌리며, 분포(p90/p99)로** 재야 한다. 중앙값만 보면 "가끔 버벅인다"는 체감을 놓친다.

### 적응형 품질 + 파티클 자기 억제

두 층에서 상한을 만든다.

1. **생성 측** (`particle.js`) — 풀 점유율이 45%를 넘으면 히트 플래시를 75% 건너뛰고, 55%를 넘으면 처치 파편 수를 절반(80% 초과 시 1/4)으로 줄인다. 붐빌 때는 어차피 겹쳐서 안 보인다.
2. **렌더 측** (`renderer.js`) — `적 수 + 파티클 수 > 260`이면 `neon()`의 외곽 번짐 패스를 생략한다. 단 플레이어·보스·빔은 `neonFull()`로 제외한다. 수가 적고 눈이 가는 요소라 여기서 아끼면 손해다.

### 충돌 콜백의 클로저

`grid.query(x, y, r, e => {...})`처럼 콜백을 인라인으로 두면 **적·투사체마다 클로저가 새로 생긴다.** 적 220마리 + 탄 수백 개 × 60fps면 초당 만 개 단위다. 이게 주기적 GC를 유발해 p99를 끌어올린다.

콜백을 모듈 스코프 함수로 올리고 컨텍스트는 모듈 변수(`_sepSelf`, `_hitBolt`, `_ringCur`, `_orbCur`)로 넘긴다. 재진입이 없는 단일 스레드 루프라 안전하다.

**최종 실측** (적 213마리, 파티클 364개, 만렙 4무기 + 4패시브, update + draw 전체):

| | 이전 | 현재 |
|---|---|---|
| 중앙값 | 24.8 ms | **8.3 ms** |
| p90 | 29.3 ms | **10.6 ms** |
| p99 | 68.5 ms | **12.9 ms** |
| 최대 | 91.2 ms | **25.0 ms** |

### 오디오 스로틀
히트·처치 효과음은 초당 수백 번 호출된다. WebAudio 노드 생성이 메인 스레드를 잡는 데다 소리도 뭉개지므로, 자주 나는 효과음은 개별 최소 간격을 45~60ms로 둔다(`audio.js`의 `GAP`).

### 픽업 누적
렌더 비용 1위가 픽업이었던 진짜 원인은 **픽업이 풀 상한까지 쌓이는 것**이었다. 주울 수 없는 거리의 XP가 영원히 남았다. 회수 규칙을 넣었다 — 플레이어에서 1,100px을 넘거나 40초가 지난 픽업은(흡인 중이 아니라면) 소멸한다. 풀도 1,500 → 600으로 줄였다.

저사양 대비 **글로우 off 옵션**(`G` 키 / 일시정지 메뉴)도 유지한다.

### 좌표계
- 월드 좌표는 무한 평면. 카메라가 플레이어를 추적(약한 lerp 0.12 + 데드존 40px).
- 논리 해상도 **1280×720** 고정, 캔버스는 CSS로 letterbox 스케일. DPR은 최대 2로 클램프.

---

## 8. 입력 (`core/input.js`)

```js
input.move    // {x, y} 정규화된 벡터 (키보드 8방향 또는 조이스틱 아날로그)
input.dash    // 이번 프레임에 눌렸는가 (edge trigger)
input.pointer // {x, y, down, justPressed} — UI 히트테스트용
```

- 키 상태는 `keydown`/`keyup`으로 Set 관리. `keypress` 금지(반복 지연 문제).
- 창 포커스 상실(`blur`) 시 모든 키 해제 + 자동 일시정지.
- 대각선 이동 시 정규화 필수 (안 하면 대각선이 1.41배 빠르다).

---

## 9. 오디오 (`core/audio.js`)

```js
audio.init()                  // 첫 사용자 입력 시 AudioContext 생성 (자동재생 정책)
audio.play(name, {vol, rate}) // 절차 합성 SFX
audio.music(phase)            // BGM 페이즈 전환
audio.setMuted(bool)
```

- SFX는 매번 `OscillatorNode`/`BufferSource`를 새로 만들고 재생 후 폐기 (GC 부담은 무시 가능).
- 노이즈 버퍼는 부팅 시 1개 만들어 재사용.
- 동일 SFX 동시 재생 4개 제한 + 8ms 이내 중복 호출 무시(수십 마리 동시 처치 시 클리핑 방지).
- 마스터 게인 노드 하나에 전부 연결 → 음소거/볼륨을 한 곳에서 제어.

---

## 10. 저장 (`core/save.js`)

```js
{
  v: 1,                        // 스키마 버전
  fragments: 1240,             // 미사용 코드 조각
  upgrades: { core: 2, memory: 3, fan: 0, prefetch: 1, backup: 0, boot: ['tracer'] },
  best: { time: 812, kills: 1943, cleared: true, clearTime: 901 },
  settings: { glow: true, muted: false, shake: 1.0 }
}
```
- 키: `neonpurge.save`
- 로드 시 `v` 불일치 또는 파싱 실패 → 기본값으로 폴백 (절대 throw 하지 않는다)
- 저장 시점: 런 종료, 업그레이드 구매, 설정 변경

---

## 11. 구현 순서 (마일스톤)

각 단계가 끝날 때마다 **반드시 실제로 플레이해본다.** 재미없으면 다음 단계로 가지 않는다.

| # | 마일스톤 | 산출물 | 검증 질문 |
|---|---|---|---|
| **M0** | 부트 | 캔버스, 루프, 배경 그리드, 시안 삼각형 이동 | 움직임이 기분 좋은가? |
| **M1** | **최소 재미 루프** | 웜 스폰 + 펄스 링 자동 공격 + 처치 + XP + 레벨업 3택 | **여기서 재미없으면 설계를 고친다** |
| **M2** | 전투 감각 | 파티클·화면흔들림·히트스톱·SFX, 대시, 체력/사망 | 처치가 "시원한가"? |
| **M3** | 콘텐츠 | 무기 5종 · 패시브 5종 · 적 6종 · 카드 추첨 완성 | 빌드가 다르게 느껴지는가? |
| **M4** | 진행 | 15분 타임라인, 난이도 스케일링, 엘리트 2종 | 난이도 곡선이 매끄러운가? |
| **M5** | 보스 | 커널 바이러스 3페이즈 + 클리어 연출 | 마지막 3분이 긴장되는가? |
| **M6** | 메타 | 영구 업그레이드, 저장, 타이틀/결과 화면 | 다시 하고 싶은가? |
| **M7** | 폴리시 | 진화 무기, 모바일 터치, 설정, 성능 최적화, 밸런싱 | 남에게 보여줄 수 있는가? |

> **M1이 전체 프로젝트의 분기점이다.** 도형 두 개가 굴러다니는 상태에서 이미 재밌어야 한다. 그래픽·사운드·콘텐츠는 재미를 만들지 못하고 증폭만 한다.

---

## 12. 성능 예산 (16.6ms / 프레임)

| 항목 | 예산 | 실측 (적 213 + 파티클 364, 중앙값) | 대책 |
|---|---|---|---|
| 업데이트 + 충돌 | 7 ms | 합계 **8.3 ms** | 공간 그리드, 제곱거리 비교(`sqrt` 금지), 콜백 클로저 제거 |
| 렌더 | 7 ms | (p99 12.9 ms) | `shadowBlur` 제거, 적응형 품질, 화면 밖 컬링, 그룹 버퍼 재사용 |
| 여유 | 2.6 ms | 3.7 ms (p99 기준) | |

**금지 사항**
- 업데이트 루프 내 `{x, y}` 리터럴 생성 (GC 스파이크 → 프레임 드롭)
- `Array.prototype.filter`/`map`으로 매 프레임 새 배열 만들기
- 화면 밖 엔티티 렌더 (컬링 필수)
- 문자열 조합을 매 프레임 (HUD 텍스트는 값 변경 시에만 갱신)

---

## 13. 예상 코드 규모

| 영역 | 대략 |
|---|---|
| core | 500 줄 |
| game | 1,600 줄 |
| data | 600 줄 |
| render + ui | 900 줄 |
| main + config | 200 줄 |
| **합계** | **약 3,800 줄** |
