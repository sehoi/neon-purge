// 엔트리: 캔버스 셋업, 고정 타임스텝 루프, 상태 머신.

import * as cfg from './config.js';
import { STEP, MAX_FRAME, SETTINGS, RUN_LENGTH, IS_TOUCH, MAX_DPR, C, setViewport } from './config.js';
import { initInput, pollInput, endFrameInput, input, keyPressed, clearTouchState } from './core/input.js';
import { initAudio, resumeAudio, setMuted, sfx, startMusic, stopMusic, updateMusic, setMusicIntensity } from './core/audio.js';
import { loadSave, persist, resetSave } from './core/save.js';
import { seed } from './core/rng.js';

import { createWorld, startRun, updateWorld } from './game/world.js';
import { buildChoices, applyChoice, recalcStats } from './game/upgrade.js';
import { camera } from './game/camera.js';
import { particles } from './game/particle.js';
import { renderWorld } from './render/renderer.js';
import { renderHud } from './ui/hud.js';
import {
  renderTitle, renderHelp, renderMeta, renderLevelUp, renderPause, renderResult,
} from './ui/screens.js';
import { META, fragmentsEarned } from './data/meta.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

function fitCanvas() {
  // 화면 비율에 맞춰 논리 폭을 조정한다 (높이는 720 고정).
  // 16:9 로 고정하면 20:9 폰에서 좌우에 검은 띠가 생겨 화면이 20% 가까이 낭비된다.
  setViewport(window.innerWidth, window.innerHeight);

  // 모바일 GPU 는 픽셀 수에 민감하다. DPR 을 1.5 로 묶어 렌더 면적을 줄인다.
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  canvas.width = cfg.W * dpr;
  canvas.height = cfg.H * dpr;
  canvas.style.aspectRatio = `${cfg.W} / ${cfg.H}`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}
fitCanvas();
addEventListener('resize', fitCanvas);
addEventListener('orientationchange', () => setTimeout(fitCanvas, 120));

/** 세로로 들면 16:9 화면이 손톱만해진다. 가로를 요구한다. */
function isPortrait() {
  return IS_TOUCH && window.innerHeight > window.innerWidth;
}

function renderRotateNotice() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, cfg.W, cfg.H);
  ctx.save();
  ctx.translate(cfg.W / 2, cfg.H / 2);
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 4;
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 20;
  // 눕힌 단말기 모양
  ctx.strokeRect(-90, -55, 180, 110);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 130, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();
  ctx.font = '26px ui-monospace, monospace';
  ctx.fillStyle = C.text;
  ctx.textAlign = 'center';
  ctx.fillText('기기를 가로로 돌려주세요', cfg.W / 2, cfg.H / 2 + 190);
}

const save = loadSave();
setMuted(SETTINGS.muted);
seed(Date.now() & 0x7fffffff);

const world = createWorld(save.upgrades);

const S = {
  TITLE: 'title', HELP: 'help', META: 'meta',
  PLAYING: 'playing', PAUSED: 'paused', LEVELUP: 'levelup', RESULT: 'result',
};
let state = S.TITLE;
let choices = null;
let levelAnim = 0;
let resultGained = 0;
let resultVictory = false;
let titleTime = 0;

initInput(canvas, () => {
  if (state === S.PLAYING) state = S.PAUSED;
});

// 첫 입력에서 오디오를 깨운다 (브라우저 자동재생 정책)
function wakeAudio() {
  initAudio();
  resumeAudio();
}
addEventListener('pointerdown', wakeAudio, { once: true });
addEventListener('keydown', wakeAudio, { once: true });

function beginRun() {
  world.meta = save.upgrades;
  startRun(world);
  state = S.PLAYING;
  startMusic();
  wakeAudio();
  requestFullscreenIfMobile();
}

/**
 * 모바일에서 판을 시작할 때 전체화면으로 들어간다.
 * 주소창과 하단 바가 세로 공간을 크게 갉아먹어, 없애는 것만으로 화면이 눈에 띄게 커진다.
 * 전체화면 요청은 사용자 제스처 안에서만 허용되므로 버튼 처리 흐름에서 호출한다.
 * 실패해도(iPhone Safari 등) 게임은 그대로 진행된다.
 */
function requestFullscreenIfMobile() {
  if (!IS_TOUCH || document.fullscreenElement) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  try {
    const r = req.call(el, { navigationUI: 'hide' });
    if (r && r.catch) r.catch(() => {});
  } catch { /* 사용자 제스처 밖이거나 미지원 — 무시 */ }
  // 화면 회전 잠금까지 되면 더 좋지만, 되는 기기에서만 조용히 시도한다
  if (screen.orientation && screen.orientation.lock) {
    const p = screen.orientation.lock('landscape');
    if (p && p.catch) p.catch(() => {});
  }
}

function endRun(victory) {
  resultVictory = victory;
  resultGained = fragmentsEarned(world.kills, world.t, victory, world.bonusFragments);
  save.fragments += resultGained;
  if (world.t > save.best.time) save.best.time = world.t;
  if (world.kills > save.best.kills) save.best.kills = world.kills;
  if (victory && (!save.best.cleared || world.t < save.best.clearTime)) {
    save.best.cleared = true;
    save.best.clearTime = world.t;
  }
  persist();
  stopMusic();
  state = S.RESULT;
}

// ── 업데이트 ────────────────────────────────────────────────
function update(dt) {
  // 전역 토글
  if (keyPressed('KeyM')) { SETTINGS.muted = !SETTINGS.muted; setMuted(SETTINGS.muted); persist(); }
  if (keyPressed('KeyG')) { SETTINGS.glow = !SETTINGS.glow; persist(); }

  switch (state) {
    case S.TITLE:
    case S.HELP:
    case S.META:
      titleTime += dt;
      break;

    case S.PLAYING: {
      if (keyPressed('Escape') || keyPressed('KeyP') || input.pauseTapped) {
        state = S.PAUSED;
        clearTouchState();
        return;
      }
      updateWorld(world, dt);
      setMusicIntensity(world.t / RUN_LENGTH);
      updateMusic(dt);

      if (world.victory) { endRun(true); return; }
      if (world.over) { endRun(false); return; }
      if (world.pendingLevelUps > 0) {
        world.pendingLevelUps--;
        choices = buildChoices(world.player);
        levelAnim = 0;
        state = S.LEVELUP;
        clearTouchState();   // 스틱을 잡은 채 레벨업하면 손가락이 카드로 안 넘어간다
        sfx('levelup');
      }
      break;
    }

    case S.LEVELUP:
      levelAnim += dt;
      break;

    case S.PAUSED:
      if (keyPressed('Escape') || keyPressed('KeyP')) state = S.PLAYING;
      break;

    case S.RESULT:
      if (keyPressed('KeyR')) beginRun();
      break;
  }
}

// ── 렌더 ────────────────────────────────────────────────────
// ?debug 를 붙이면 입력 진단을 화면에 띄운다. 실기기에서만 나는 문제를 볼 수단이다.
const DEBUG_INPUT = location.search.includes('debug');

function renderInputDebug() {
  const r = canvas.getBoundingClientRect();
  const lines = [
    `touch=${IS_TOUCH} portrait=${isPortrait()} state=${state}`,
    `win=${innerWidth}x${innerHeight} dpr=${(window.devicePixelRatio || 1).toFixed(2)}`,
    `rect=${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
    `ptr=${Math.round(input.pointer.x)},${Math.round(input.pointer.y)} taps=${input.taps.length}`,
    `last=${input.lastEvent || '(없음)'}`,
  ];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(8, cfg.H - 8 - lines.length * 20 - 8, 560, lines.length * 20 + 12);
  ctx.font = '15px ui-monospace, monospace';
  ctx.fillStyle = '#8cff3d';
  ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, 16, cfg.H - 16 - (lines.length - 1 - i) * 20));
  // 최근 탭 위치에 표식
  for (const t of input.taps) {
    ctx.strokeStyle = t.used ? '#8cff3d' : '#ff3b3b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function render() {
  if (isPortrait()) { renderRotateNotice(); return; }

  switch (state) {
    case S.TITLE: {
      renderWorld(ctx, world);
      const r = renderTitle(ctx, save);
      if (r.start) { sfx('select'); beginRun(); }
      if (r.upgrade) { sfx('select'); state = S.META; }
      if (r.help) { sfx('select'); state = S.HELP; }
      if (r.fullscreen) {
        sfx('select');
        // 전체화면 요청은 사용자 제스처 안에서만 허용된다. 실패해도 게임은 계속 돈다.
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen().catch(() => {});
      }
      break;
    }

    case S.HELP: {
      renderWorld(ctx, world);
      const r = renderHelp(ctx);
      if (r.back) { sfx('select'); state = S.TITLE; }
      break;
    }

    case S.META: {
      renderWorld(ctx, world);
      const r = renderMeta(ctx, save);
      if (r.buy) {
        const def = META[r.buy];
        const lv = save.upgrades[r.buy] || 0;
        const cost = def.costs[lv];
        if (lv < def.max && save.fragments >= cost) {
          save.fragments -= cost;
          save.upgrades[r.buy] = lv + 1;
          persist();
          sfx('levelup');
        }
      }
      if (r.reset) {
        const fresh = resetSave();
        save.fragments = fresh.fragments;
        Object.assign(save.upgrades, fresh.upgrades);
        Object.assign(save.best, fresh.best);
        sfx('hurt');
      }
      if (r.back) { sfx('select'); state = S.TITLE; }
      break;
    }

    case S.PLAYING:
      renderWorld(ctx, world);
      renderHud(ctx, world);
      break;

    case S.LEVELUP: {
      renderWorld(ctx, world);
      renderHud(ctx, world);
      // 정상 흐름에서는 update 가 먼저 채우지만, 비어 있으면 즉석에서 뽑는다
      if (!choices) choices = buildChoices(world.player);
      const picked = renderLevelUp(ctx, world, choices, levelAnim);
      if (picked >= 0) {
        applyChoice(world.player, world, choices[picked]);
        sfx('select');
        choices = null;
        state = S.PLAYING;
      }
      break;
    }

    case S.PAUSED: {
      renderWorld(ctx, world);
      renderHud(ctx, world);
      const r = renderPause(ctx, world);
      if (r.resume) { sfx('select'); state = S.PLAYING; }
      if (r.quit)   { sfx('select'); endRun(false); }
      if (r.glow)   { SETTINGS.glow = !SETTINGS.glow; persist(); }
      if (r.mute)   { SETTINGS.muted = !SETTINGS.muted; setMuted(SETTINGS.muted); persist(); }
      break;
    }

    case S.RESULT: {
      renderWorld(ctx, world);
      const r = renderResult(ctx, world, resultGained, resultVictory);
      if (r.retry) { sfx('select'); beginRun(); }
      if (r.title) { sfx('select'); state = S.TITLE; }
      break;
    }
  }

  if (DEBUG_INPUT) renderInputDebug();
}

// ── 루프 ────────────────────────────────────────────────────
let acc = 0;
let prev = performance.now();

function frame(now) {
  let dt = Math.min((now - prev) / 1000, MAX_FRAME);
  prev = now;

  // 세로로 들고 있으면 게임을 진행하지 않는다 (render 가 안내 화면을 그린다)
  if (isPortrait()) {
    if (state === S.PLAYING) { state = S.PAUSED; clearTouchState(); }
    render();
    endFrameInput();
    requestAnimationFrame(frame);
    return;
  }

  input.gameplay = state === S.PLAYING;
  pollInput();

  // 히트스톱: 시간만 멈추고 렌더는 계속 (타격감의 핵심)
  if (camera.hitstop > 0) {
    camera.hitstop -= dt;
    dt = 0;
  }

  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    update(STEP);
    acc -= STEP;
    steps++;
  }
  if (steps === 0 && dt === 0) update(0);   // 히트스톱 중에도 입력은 처리

  render();
  endFrameInput();
  requestAnimationFrame(frame);
}

// 타이틀 배경에 데모 월드를 띄워 둔다
world.meta = save.upgrades;
startRun(world);
recalcStats(world.player, save.upgrades);
requestAnimationFrame(frame);

// 디버그 훅 — 콘솔에서 밸런싱을 확인할 때 쓴다
window.NP = {
  world, save, input, settings: SETTINGS, particles, cfg,
  get viewport() { return { W: cfg.W, H: cfg.H, touchUI: { ...cfg.TOUCH_UI } }; },
  get state() { return state; },
  start: beginRun,
  skipTo(sec) { world.t = sec; },
  /** rAF 없이 N초분을 즉시 시뮬레이션한다 (백그라운드 탭 테스트용) */
  step(seconds) {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) update(STEP);
    return { t: world.t, enemies: world.enemies.count, kills: world.kills };
  },
  draw() { render(); },
  pickCard(i = 0) {
    if (state !== S.LEVELUP || !choices) return null;
    const c = choices[Math.min(i, choices.length - 1)];
    applyChoice(world.player, world, c);
    choices = null;
    state = S.PLAYING;
    return c.name;
  },
  levelUp(n = 1) { world.pendingLevelUps += n; },
  godMode() { world.player.stats.maxHp = 1e9; world.player.hp = 1e9; },
  setState(s) { state = s; },
  poll: pollInput,
  endFrame: endFrameInput,
};
