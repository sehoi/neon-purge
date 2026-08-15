// 인게임 오버레이.

import { W, H, C, RUN_LENGTH, IS_TOUCH, TOUCH_UI } from '../config.js';
import { WEAPONS } from '../data/weapons.js';
import { PASSIVES, MAX_LEVEL } from '../data/passives.js';
import { text, bar, icon, levelDots, formatTime } from './widgets.js';
import { getTouchStick, isDashHeld } from '../core/input.js';
import { circle, disc, line } from '../render/shapes.js';
import { TAU } from '../core/vec.js';

export function renderHud(ctx, world) {
  const p = world.player;

  // 상단 경험치 바 (화면 폭 전체, 얇게)
  bar(ctx, 0, 0, W, 6, p.xp / p.xpNext, C.lime, '#101528');

  // 타이머
  text(ctx, formatTime(world.t), W / 2, 34, {
    size: 30, align: 'center', color: C.text, glow: 10,
  });

  // 좌상단: 레벨 / 처치
  text(ctx, `LV ${p.level}`, 18, 32, { size: 20, color: C.lime, glow: 6 });
  text(ctx, `처치 ${world.kills}`, 18, 54, { size: 15, color: C.dim });

  // 우상단: 남은 시간 안내 (터치에서는 일시정지 버튼 자리를 비켜 왼쪽으로)
  const remain = Math.max(0, RUN_LENGTH - world.t);
  if (!world.boss) {
    text(ctx, `정화까지 ${formatTime(remain)}`, W - (IS_TOUCH ? 84 : 18), 32, {
      size: 15, align: 'right', color: C.dim,
    });
  }

  // 좌하단: 체력
  const hpW = 260;
  bar(ctx, 18, H - 40, hpW, 16, p.hp / p.stats.maxHp, C.cyan, '#141a30');
  text(ctx, `${Math.ceil(p.hp)} / ${Math.round(p.stats.maxHp)}`, 18 + hpW / 2, H - 32, {
    size: 13, align: 'center', baseline: 'middle', color: '#04121a',
  });
  if (p.revives > 0) {
    text(ctx, `백업 ×${p.revives}`, 18, H - 50, { size: 13, color: C.gold });
  }

  // 우하단: 보유 무기 / 패시브
  drawLoadout(ctx, p);

  // 보스 체력 바
  if (world.boss && world.boss.alive) {
    const bw = W * 0.6;
    const bx = (W - bw) / 2;
    text(ctx, world.boss.def.name, W / 2, 60, { size: 16, align: 'center', color: C.orange });
    bar(ctx, bx, 70, bw, 12, world.boss.hp / world.boss.maxHp, C.orange, '#2a1208');
  }

  // 배너
  if (world.banner) {
    const a = Math.min(1, world.banner.life / 0.5);
    text(ctx, world.banner.text, W / 2, H * 0.3, {
      size: 40, align: 'center', color: C.orange, glow: 20, alpha: a,
    });
  }

  if (IS_TOUCH) {
    drawTouchControls(ctx, world);
    drawTouchStick(ctx);
  }
}

function drawLoadout(ctx, p) {
  const size = 34;
  const gap = 6;
  // 터치에서는 우하단이 대시 버튼 자리다. 로드아웃을 위로 올린다.
  let x = W - 18 - size / 2;
  const yW = IS_TOUCH ? H - 208 : H - 76;
  const yP = IS_TOUCH ? H - 164 : H - 32;

  for (let i = p.weapons.length - 1; i >= 0; i--) {
    const w = p.weapons[i];
    const def = WEAPONS[w.id];
    icon(ctx, def.icon, x, yW, size / 2, def.color);
    levelDots(ctx, x, yW + size / 2 + 3, w.lv, def.evolved ? 1 : MAX_LEVEL, def.color);
    x -= size + gap;
  }

  x = W - 18 - size / 2;
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
  // 대시 버튼
  ctx.globalAlpha = isDashHeld() ? 0.5 : ready ? 0.32 : 0.16;
  ctx.fillStyle = C.cyan;
  disc(ctx, TOUCH_UI.dashX, TOUCH_UI.dashY, TOUCH_UI.dashR);
  ctx.globalAlpha = ready ? 0.9 : 0.4;
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 2;
  circle(ctx, TOUCH_UI.dashX, TOUCH_UI.dashY, TOUCH_UI.dashR);

  // 쿨다운 게이지
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

  // 일시정지 버튼 (두 개의 세로 막대)
  ctx.save();
  ctx.globalAlpha = 0.3;
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
