// 전역 상수. 다른 어떤 모듈도 참조하지 않는다.

/**
 * 논리 해상도. 높이는 720 으로 고정하고 폭만 화면 비율에 맞춘다.
 *
 * 16:9 로 못박아두면 20:9 인 요즘 폰에서 좌우에 검은 띠가 생겨 화면의 20% 가까이가
 * 낭비된다. 폭을 늘리면 그만큼 더 넓게 보이고 띠가 사라진다.
 *
 * `let` + live binding 이라 import 한 쪽도 갱신된 값을 본다. 다만 모듈 로드 시점에
 * 값을 복사해 두는 코드(상수 계산)는 setViewport 뒤에 다시 계산해야 한다.
 */
export let W = 1280;
export let H = 720;
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

const MIN_W = 1280;   // 16:9
const MAX_W = 1900;   // 그 이상 넓히면 적이 화면 밖에서 너무 오래 접근한다

/** @returns {boolean} 폭이 실제로 바뀌었는가 */
export function setViewport(cssW, cssH) {
  if (!cssW || !cssH) return false;
  const w = Math.round(Math.min(MAX_W, Math.max(MIN_W, H * (cssW / cssH))));
  if (w === W) return false;
  W = w;
  refreshTouchUI();
  return true;
}

export const C = {
  bg:      '#070711',
  grid:    '#151a35',
  cyan:    '#00f0ff',
  magenta: '#ff2e88',
  orange:  '#ff6a00',
  lime:    '#8cff3d',
  mint:    '#3dff9e',
  red:     '#ff3b3b',
  gold:    '#ffd23d',
  violet:  '#b06bff',
  text:    '#e6f2ff',
  dim:     '#7b88a8',
};

export const PLAYER_BASE = {
  maxHp:     100,
  speed:     245,   // 속도감 우선. 적 속도도 함께 올려 추격감은 유지한다
  radius:    10,
  ihit:      0.7,   // 피격 무적 시간
  magnet:    105,   // 캐시 패시브 없이도 줍는 맛이 나야 한다
  dashDist:  155,
  dashCd:    1.8,
  dashTime:  0.14,  // 대시 지속
  dashIframe: 0.25,
};

export const RUN_LENGTH = 10 * 60;  // 10분

// 적별 최대 히트박스의 약 2배
export const GRID_CELL = 64;

export const SETTINGS = {
  glow: true,
  shake: 1.0,
  muted: false,
};

/**
 * 손가락으로 조작하는 기기인가.
 * 마우스가 달린 터치스크린 노트북까지 모바일 UI 로 바꾸면 오히려 불편하므로,
 * "정밀한 포인터가 없는" 기기만 잡는다.
 */
export const IS_TOUCH =
  typeof matchMedia === 'function' &&
  matchMedia('(pointer: coarse)').matches &&
  (navigator.maxTouchPoints || 0) > 0;

/** 터치 조작 UI 배치. W 가 바뀌면 refreshTouchUI 로 다시 계산한다. */
export const TOUCH_UI = {
  dashX: 0, dashY: 0, dashR: 58,
  pauseX: 0, pauseY: 0, pauseR: 26,
};

export function refreshTouchUI() {
  TOUCH_UI.dashX = W - 100;
  TOUCH_UI.dashY = H - 100;
  // 일시정지는 상단 중앙(타이머 옆). 손은 화면 아래쪽에 있으므로 여기가 안 가려진다.
  TOUCH_UI.pauseX = W / 2 + 108;
  TOUCH_UI.pauseY = 40;
}
refreshTouchUI();

// 모바일 GPU 는 데스크톱보다 한참 느리다. 동시 적 수를 줄이고 픽셀도 덜 그린다.
export const MOBILE_CAP_SCALE = 0.6;
export const MAX_DPR = IS_TOUCH ? 1.5 : 2;
