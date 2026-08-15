// 키보드 + 터치를 하나의 정규화된 입력으로 합친다.

import { W, H } from '../config.js';

const keys = new Set();

export const input = {
  mx: 0, my: 0,          // 이동 벡터 (정규화됨)
  dash: false,           // 이번 프레임 엣지 트리거
  pointer: { x: 0, y: 0, down: false, justPressed: false },
  anyKey: false,
  pressed: new Set(),    // 이번 프레임에 새로 눌린 키 코드
};

let touchStick = null;   // { id, ox, oy, x, y }
let dashQueued = false;
let canvas = null;
let onBlur = null;

const LEFT  = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP    = ['KeyW', 'ArrowUp'];
const DOWN  = ['KeyS', 'ArrowDown'];

export function initInput(cv, blurHandler) {
  canvas = cv;
  onBlur = blurHandler;

  addEventListener('keydown', e => {
    // 게임이 쓰는 키만 기본 동작을 막는다 (F5, DevTools 등은 살려둔다)
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    keys.add(e.code);
    input.pressed.add(e.code);
    input.anyKey = true;
    if (e.code === 'Space') dashQueued = true;
  });

  addEventListener('keyup', e => keys.delete(e.code));

  // 포커스를 잃으면 키가 눌린 채로 남는다 → 전부 해제하고 일시정지
  addEventListener('blur', () => {
    keys.clear();
    touchStick = null;
    if (onBlur) onBlur();
  });

  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    const p = toCanvas(e);
    input.pointer.x = p.x;
    input.pointer.y = p.y;
    input.pointer.down = true;
    input.pointer.justPressed = true;

    if (e.pointerType === 'touch') {
      if (p.x < W * 0.5) {
        touchStick = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
      } else {
        dashQueued = true;
      }
    }
  });

  cv.addEventListener('pointermove', e => {
    const p = toCanvas(e);
    input.pointer.x = p.x;
    input.pointer.y = p.y;
    if (touchStick && touchStick.id === e.pointerId) {
      touchStick.x = p.x;
      touchStick.y = p.y;
    }
  });

  const release = e => {
    input.pointer.down = false;
    if (touchStick && touchStick.id === e.pointerId) touchStick = null;
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('contextmenu', e => e.preventDefault());
}

function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (W / r.width),
    y: (e.clientY - r.top) * (H / r.height),
  };
}

function held(list) {
  for (const k of list) if (keys.has(k)) return true;
  return false;
}

/** 매 프레임 update 앞에서 호출. */
export function pollInput() {
  let x = 0, y = 0;

  if (touchStick) {
    const dx = touchStick.x - touchStick.ox;
    const dy = touchStick.y - touchStick.oy;
    const len = Math.hypot(dx, dy);
    if (len > 8) {
      const s = Math.min(len, 60) / 60 / len;
      x = dx * s;
      y = dy * s;
    }
  } else {
    if (held(LEFT))  x -= 1;
    if (held(RIGHT)) x += 1;
    if (held(UP))    y -= 1;
    if (held(DOWN))  y += 1;
    // 대각선이 1.41배 빨라지는 것을 막는다
    const len = Math.hypot(x, y);
    if (len > 0) { x /= len; y /= len; }
  }

  input.mx = x;
  input.my = y;
  input.dash = dashQueued;
  dashQueued = false;
}

/** 매 프레임 update 뒤에서 호출. 엣지 트리거들을 소비한다. */
export function endFrameInput() {
  input.pointer.justPressed = false;
  input.pressed.clear();
  input.anyKey = false;
}

export function keyPressed(code) {
  return input.pressed.has(code);
}

export function getTouchStick() {
  return touchStick;
}
