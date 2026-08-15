// 엔트리: 캔버스 셋업, 고정 타임스텝 루프, 상태 머신.

import { W, H, STEP, MAX_FRAME, SETTINGS, RUN_LENGTH } from './config.js';
import { initInput, pollInput, endFrameInput, input, keyPressed } from './core/input.js';
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
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}
fitCanvas();
addEventListener('resize', fitCanvas);

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
      if (keyPressed('Escape') || keyPressed('KeyP')) { state = S.PAUSED; return; }
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
function render() {
  switch (state) {
    case S.TITLE: {
      renderWorld(ctx, world);
      const r = renderTitle(ctx, save);
      if (r.start) { sfx('select'); beginRun(); }
      if (r.upgrade) { sfx('select'); state = S.META; }
      if (r.help) { sfx('select'); state = S.HELP; }
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
      if (picked >= 0 && levelAnim > 0.15) {
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
}

// ── 루프 ────────────────────────────────────────────────────
let acc = 0;
let prev = performance.now();

function frame(now) {
  let dt = Math.min((now - prev) / 1000, MAX_FRAME);
  prev = now;

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
  world, save, input, settings: SETTINGS, particles,
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
};
