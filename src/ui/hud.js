// 인게임 오버레이.
//
// 터치 기기에서는 체력바와 로드아웃을 상단에 둔다. 하단은 조이스틱과 대시 버튼을
// 쥔 손에 가려져서, 정작 가장 자주 봐야 할 체력이 안 보인다.

import { W, H, C, RUN_LENGTH, IS_TOUCH, TOUCH_UI } from '../config.js';
import { WEAPONS } from '../data/weapons.js';
import { PASSIVES, MAX_LEVEL } from '../data/passives.js';
import { text, bar, icon, levelDots, formatTime } from './widgets.js';
import { getTouchStick, isDashHeld } from '../core/input.js';
import { circle, disc, line } from '../render/shapes.js';
import { TAU } from '../core/vec.js';

export function renderHud(ctx, world) {
  const p = world.player;

  // 경험치 바.
  // 터치에서는 화면 맨 끝에 6px 로 붙여두면 축소 스케일과 둥근 모서리에 묻혀 보이지 않는다.
  // 두껍게, 가장자리에서 띄워서 그린다.
  if (IS_TOUCH) {
    bar(ctx, 14, 8, W - 28, 10, p.xp / p.xpNext, C.lime, '#101528');
  } else {
    bar(ctx, 0, 0, W, 6, p.xp / p.xpNext, C.lime, '#101528');
  }

  // 타이머
  text(ctx, formatTime(world.t), W / 2, IS_TOUCH ? 42 : 34, {
    size: 30, align: 'center', color: C.text, glow: 10,
  });

  if (IS_TOUCH) renderTouchHud(ctx, world);
  else renderDesktopHud(ctx, world);

  // 보스 체력 바
  if (world.boss && world.boss.alive) {
    const bw = W * 0.5;
    const bx = (W - bw) / 2;
    const by = IS_TOUCH ? 96 : 60;
    text(ctx, world.boss.def.name, W / 2, by, { size: 16, align: 'center', color: C.orange });
    bar(ctx, bx, by + 10, bw, 12, world.boss.hp / world.boss.maxHp, C.orange, '#2a1208');
  }

  // 배너
  if (world.banner) {
    const a = Math.min(1, world.banner.life / 0.5);
    text(ctx, world.banner.text, W / 2, H * 0.32, {
      size: 40, align: 'center', color: C.orange, glow: 20, alpha: a,
    });
  }

  if (IS_TOUCH) {
    drawTouchControls(ctx, world);
    drawTouchStick(ctx);
  }
}

function renderDesktopHud(ctx, world) {
  const p = world.player;

  text(ctx, `LV ${p.level}`, 18, 32, { size: 20, color: C.lime, glow: 6 });
  text(ctx, `처치 ${world.kills}`, 18, 54, { size: 15, color: C.dim });

  const remain = Math.max(0, RUN_LENGTH - world.t);
  if (!world.boss) {
    text(ctx, `정화까지 ${formatTime(remain)}`, W - 18, 32, {
      size: 15, align: 'right', color: C.dim,
    });
  }

  const hpW = 260;
  bar(ctx, 18, H - 40, hpW, 16, p.hp / p.stats.maxHp, C.cyan, '#141a30');
  text(ctx, `${Math.ceil(p.hp)} / ${Math.round(p.stats.maxHp)}`, 18 + hpW / 2, H - 32, {
    size: 13, align: 'center', baseline: 'middle', color: '#04121a',
  });
  if (p.revives > 0) {
    text(ctx, `백업 ×${p.revives}`, 18, H - 50, { size: 13, color: C.gold });
  }

  drawLoadout(ctx, p, W - 18, H - 76, H - 32);
}

function renderTouchHud(ctx, world) {
  const p = world.player;

  // 좌상단: 체력바 + 레벨 + 처치 (경험치 바 아래)
  const hpW = 240;
  bar(ctx, 16, 26, hpW, 18, p.hp / p.stats.maxHp, C.cyan, '#141a30');
  text(ctx, `${Math.ceil(p.hp)} / ${Math.round(p.stats.maxHp)}`, 16 + hpW / 2, 35, {
    size: 13, align: 'center', baseline: 'middle', color: '#04121a',
  });
  text(ctx, `LV ${p.level}`, 16, 64, { size: 17, color: C.lime, glow: 6 });
  text(ctx, `처치 ${world.kills}`, 90, 64, { size: 14, color: C.dim });
  if (p.revives > 0) {
    text(ctx, `백업 ×${p.revives}`, 170, 64, { size: 13, color: C.gold });
  }

  // 우상단: 로드아웃 2줄
  drawLoadout(ctx, p, W - 16, 42, 86);

  // 남은 시간은 타이머 아래에 작게
  const remain = Math.max(0, RUN_LENGTH - world.t);
  if (!world.boss) {
    text(ctx, `정화까지 ${formatTime(remain)}`, W / 2, 64, {
      size: 13, align: 'center', color: C.dim,
    });
  }
}

/** 무기 줄(yW)과 강화 줄(yP)을 오른쪽 끝(rightX)부터 왼쪽으로 채운다. */
function drawLoadout(ctx, p, rightX, yW, yP) {
  const size = 34;
  const gap = 6;

  let x = rightX - size / 2;
  for (let i = p.weapons.length - 1; i >= 0; i--) {
    const w = p.weapons[i];
    const def = WEAPONS[w.id];
    icon(ctx, def.icon, x, yW, size / 2, def.color);
    levelDots(ctx, x, yW + size / 2 + 3, w.lv, def.evolved ? 1 : MAX_LEVEL, def.color);
    x -= size + gap;
  }

  x = rightX - size / 2;
  for (const id in p.passives) {
    const def = PASSIVES[id];
    icon(ctx, def.icon, x, yP, size / 2 - 3, def.color);
    levelDots(ctx, x, yP + size / 2, p.passives[id], MAX_LEVEL, def.color);
    x -= size + gap;
  }
}

/** 모바일 전용: 대시 버튼 + 일시정지 버튼. 키보드가 없으니 화면에 있어야 한다. */
function drawTouchControls(ctx, world) {
  const p = world.player;
  const ready = p.dashCd <= 0;

  ctx.save();
  ctx.globalAlpha = isDashHeld() ? 0.5 : ready ? 0.32 : 0.16;
  ctx.fillStyle = C.cyan;
  disc(ctx, TOUCH_UI.dashX, TOUCH_UI.dashY, TOUCH_UI.dashR);
  ctx.globalAlpha = ready ? 0.9 : 0.4;
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 2;
  circle(ctx, TOUCH_UI.dashX, TOUCH_UI.dashY, TOUCH_UI.dashR);

  if (!ready) {
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(TOUCH_UI.dashX, TOUCH_UI.dashY, TOUCH_UI.dashR - 4,
      -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.dashCd / p.stats.dashCd));
    ctx.stroke();
  }
  ctx.restore();

  text(ctx, '대시', TOUCH_UI.dashX, TOUCH_UI.dashY, {
    size: 19, align: 'center', baseline: 'middle',
    color: ready ? C.text : C.dim,
  });

  // 일시정지 (두 개의 세로 막대)
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = C.text;
  disc(ctx, TOUCH_UI.pauseX, TOUCH_UI.pauseY, TOUCH_UI.pauseR);
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = C.text;
  ctx.lineWidth = 4;
  line(ctx, TOUCH_UI.pauseX - 6, TOUCH_UI.pauseY - 9, TOUCH_UI.pauseX - 6, TOUCH_UI.pauseY + 9);
  line(ctx, TOUCH_UI.pauseX + 6, TOUCH_UI.pauseY - 9, TOUCH_UI.pauseX + 6, TOUCH_UI.pauseY + 9);
  ctx.restore();
}

function drawTouchStick(ctx) {
  const s = getTouchStick();
  if (!s) return;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 2;
  circle(ctx, s.ox, s.oy, 60);
  const dx = s.x - s.ox, dy = s.y - s.oy;
  const len = Math.hypot(dx, dy) || 1;
  const k = Math.min(len, 60) / len;
  circle(ctx, s.ox + dx * k, s.oy + dy * k, 22);
  ctx.restore();
}
