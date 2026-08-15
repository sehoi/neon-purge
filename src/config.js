// 전역 상수. 다른 어떤 모듈도 참조하지 않는다.

export const W = 1280;
export const H = 720;
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

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

/** 터치 조작 UI 배치 (논리 좌표계 1280×720 기준) */
export const TOUCH_UI = {
  dashX: W - 96,
  dashY: H - 96,
  dashR: 58,
  pauseX: W - 44,
  pauseY: 44,
  pauseR: 26,
};

// 모바일 GPU 는 데스크톱보다 한참 느리다. 동시 적 수를 줄이고 픽셀도 덜 그린다.
export const MOBILE_CAP_SCALE = 0.6;
export const MAX_DPR = IS_TOUCH ? 1.5 : 2;
