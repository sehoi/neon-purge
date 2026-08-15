// 인게임 오버레이.

import { W, H, C, RUN_LENGTH } from '../config.js';
import { WEAPONS } from '../data/weapons.js';
import { PASSIVES, MAX_LEVEL } from '../data/passives.js';
import { text, bar, icon, levelDots, formatTime } from './widgets.js';
import { getTouchStick } from '../core/input.js';
import { circle } from '../render/shapes.js';

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

  // 우상단: 남은 시간 안내
  const remain = Math.max(0, RUN_LENGTH - world.t);
  if (!world.boss) {
    text(ctx, `정화까지 ${formatTime(remain)}`, W - 18, 32, {
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

  drawTouchStick(ctx);
}

function drawLoadout(ctx, p) {
  const size = 34;
  const gap = 6;
  let x = W - 18 - size / 2;
  const yW = H - 76;
  const yP = H - 32;

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
