// 타이틀 / 레벨업 / 일시정지 / 결과 / 영구 업그레이드 화면.

import { W, H, C, SETTINGS, IS_TOUCH } from '../config.js';
import { text, panel, button, icon, formatTime, levelDots } from './widgets.js';
import { input, keyPressed, consumeTap } from '../core/input.js';
import { META, META_IDS } from '../data/meta.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { WEAPONS } from '../data/weapons.js';
import { PASSIVES, MAX_LEVEL } from '../data/passives.js';

function dim(ctx, alpha = 0.72) {
  ctx.save();
  ctx.fillStyle = `rgba(4,5,14,${alpha})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ── 타이틀 ────────────────────────────────────────────────
export function renderTitle(ctx, save) {
  dim(ctx, 0.55);

  text(ctx, 'NEON PURGE', W / 2, 190, {
    size: 82, align: 'center', color: C.cyan, glow: 30, weight: 'bold',
  });
  text(ctx, '감염된 메인프레임을 15분 안에 정화하라', W / 2, 234, {
    size: 17, align: 'center', color: C.dim,
  });

  const bw = 300, bh = 50, bx = (W - bw) / 2;
  const done = save.achievements.length;
  const r = {
    start:   button(ctx, bx, 286, bw, bh, '실행  ▶'),
    upgrade: button(ctx, bx, 344, bw, bh, `업그레이드  (${save.fragments})`, { color: C.gold, size: 18 }),
    achievements: button(ctx, bx, 402, bw, bh, `업적  ${done}/${ACHIEVEMENTS.length}`, { color: C.violet, size: 18 }),
    help:    button(ctx, bx, 460, bw, bh, '조작법', { color: C.dim, size: 18 }),
  };
  // 모바일은 주소창이 화면을 갉아먹는다. 전체화면으로 들어갈 수단을 준다.
  if (IS_TOUCH && document.fullscreenEnabled) {
    r.fullscreen = button(ctx, bx, 518, bw, 40,
      document.fullscreenElement ? '전체화면 해제' : '전체화면', { color: C.dim, size: 16 });
  }

  if (save.best.kills > 0) {
    const b = save.best;
    const line = b.cleared
      ? `최고 기록: 정화 완료 · ${formatTime(b.clearTime)} · ${b.kills} 처치`
      : `최고 기록: ${formatTime(b.time)} 생존 · ${b.kills} 처치`;
    text(ctx, line, W / 2, H - 56, { size: 14, align: 'center', color: C.dim });
  }
  text(ctx, IS_TOUCH ? '왼쪽 드래그로 이동 · 오른쪽 아래 대시 · 공격은 자동'
                     : 'WASD 이동 · Space 대시 · 공격은 자동', W / 2, H - 30, {
    size: 13, align: 'center', color: '#4a5578',
  });

  return r;
}

// ── 조작법 ────────────────────────────────────────────────
export function renderHelp(ctx) {
  dim(ctx, 0.85);
  const pw = 640, ph = 400;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  panel(ctx, px, py, pw, ph);

  text(ctx, '조작법', px + pw / 2, py + 46, { size: 30, align: 'center', color: C.cyan, glow: 12 });

  const lines = IS_TOUCH ? [
    ['화면 왼쪽', '누른 자리가 조이스틱 중심이 된다'],
    ['오른쪽 아래 원', '대시 — 짧은 무적. 쿨다운 1.8초'],
    ['카드 탭', '강화 선택'],
    ['오른쪽 위 ▮▮', '일시정지'],
    ['가로 모드', '세로로 들면 화면이 너무 좁다'],
  ] : [
    ['WASD / 방향키', '이동'],
    ['Space', '대시 — 짧은 무적. 쿨다운 1.8초'],
    ['1 2 3 / 클릭', '강화 카드 선택'],
    ['Esc / P', '일시정지'],
    ['M', '음소거'],
    ['G', '글로우 on/off (프레임이 낮을 때)'],
  ];
  let y = py + 100;
  for (const [k, v] of lines) {
    text(ctx, k, px + 48, y, { size: 17, color: C.gold });
    text(ctx, v, px + 240, y, { size: 16, color: C.text });
    y += 34;
  }

  text(ctx, '공격은 전부 자동이다. 당신이 할 일은 움직이는 것뿐.',
    px + pw / 2, py + ph - 76, { size: 15, align: 'center', color: C.dim });

  return { back: button(ctx, px + pw / 2 - 90, py + ph - 58, 180, 40, '돌아가기', { size: 17 }) };
}

// ── 영구 업그레이드 ────────────────────────────────────────
export function renderMeta(ctx, save) {
  dim(ctx, 0.85);
  // 항목이 9개다. 판을 키우고 줄을 좁혀 한 화면에 담는다
  const pw = 780, ph = 660;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  panel(ctx, px, py, pw, ph, C.gold);

  text(ctx, '영구 업그레이드', px + pw / 2, py + 44, {
    size: 28, align: 'center', color: C.gold, glow: 12,
  });
  text(ctx, `보유 코드 조각  ${save.fragments}`, px + pw / 2, py + 72, {
    size: 16, align: 'center', color: C.text,
  });

  const result = { buy: null, back: false, reset: false };
  let y = py + 96;

  for (const id of META_IDS) {
    const def = META[id];
    const lv = save.upgrades[id] || 0;
    const maxed = lv >= def.max;
    const cost = maxed ? 0 : def.costs[lv];
    const afford = !maxed && save.fragments >= cost;

    text(ctx, def.name, px + 30, y + 19, { size: 17, color: C.text });
    text(ctx, def.desc(lv || 1), px + 30, y + 37, { size: 12, color: C.dim });
    levelDots(ctx, px + 330, y + 26, lv, def.max, C.gold);

    const label = maxed ? 'MAX' : `${cost}`;
    const color = maxed ? C.dim : afford ? C.gold : '#5a4a20';
    if (button(ctx, px + pw - 160, y + 3, 124, 36, label, { color, size: 16 }) && afford) {
      result.buy = id;
    }
    y += 52;
  }

  result.back = button(ctx, px + 34, py + ph - 54, 160, 40, '돌아가기', { size: 17 });
  result.reset = button(ctx, px + pw - 194, py + ph - 54, 160, 40, '전체 초기화', { color: C.red, size: 16 });
  result.fps = button(ctx, px + pw / 2 - 90, py + ph - 54, 180, 40,
    `FPS 표시: ${SETTINGS.showFps ? 'ON' : 'OFF'}`, { color: C.dim, size: 14 });
  return result;
}

// ── 초기화 확인 ────────────────────────────────────────────
export function renderResetConfirm(ctx, save) {
  dim(ctx, 0.9);
  const pw = 620, ph = 300;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  panel(ctx, px, py, pw, ph, C.red);

  text(ctx, '정말 초기화할까요?', W / 2, py + 58, {
    size: 28, align: 'center', color: C.red, glow: 14,
  });

  const owned = Object.values(save.upgrades).reduce((a, b) => a + b, 0);
  const lines = [
    `보유한 코드 조각 ${save.fragments}개가 사라집니다.`,
    `구매한 영구 강화 ${owned}단계도 함께 사라집니다.`,
    '최고 기록과 달성한 업적도 모두 지워집니다.',
  ];
  lines.forEach((l, i) => {
    text(ctx, l, W / 2, py + 108 + i * 28, { size: 16, align: 'center', color: C.text });
  });
  text(ctx, '되돌릴 수 없습니다. 조각은 환불되지 않습니다.', W / 2, py + 206, {
    size: 15, align: 'center', color: C.gold,
  });

  return {
    cancel: button(ctx, px + 60, py + ph - 66, 200, 46, '취소', { size: 18 }),
    confirm: button(ctx, px + pw - 260, py + ph - 66, 200, 46, '초기화', { color: C.red, size: 18 }),
  };
}

// ── 업적 ──────────────────────────────────────────────────
export function renderAchievements(ctx, save) {
  dim(ctx, 0.88);
  const pw = 820, ph = 500;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  panel(ctx, px, py, pw, ph, C.gold);

  const done = ACHIEVEMENTS.filter(a => save.achievements.includes(a.id)).length;
  text(ctx, '업적', px + pw / 2, py + 42, { size: 28, align: 'center', color: C.gold, glow: 12 });
  text(ctx, `${done} / ${ACHIEVEMENTS.length}`, px + pw / 2, py + 68, {
    size: 15, align: 'center', color: C.dim,
  });

  // 2열 배치
  const colW = (pw - 76) / 2;
  const rowH = 52;
  ACHIEVEMENTS.forEach((a, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = px + 38 + col * (colW + 4);
    const y = py + 96 + row * rowH;
    const got = save.achievements.includes(a.id);

    ctx.save();
    ctx.globalAlpha = got ? 1 : 0.4;
    icon(ctx, got ? 'boot' : 'shield', x + 16, y + 14, 12, got ? C.gold : C.dim);
    text(ctx, a.name, x + 38, y + 10, { size: 16, color: got ? C.text : C.dim });
    if (a.reward) {
      text(ctx, got ? '받음' : `+${a.reward}`, x + colW - 12, y + 10,
        { size: 13, align: 'right', color: got ? C.dim : C.gold });
    }
    text(ctx, a.desc, x + 38, y + 30, { size: 12, color: got ? C.dim : '#4a5578' });
    ctx.restore();
  });

  return { back: button(ctx, px + pw / 2 - 90, py + ph - 56, 180, 42, '돌아가기', { size: 17 }) };
}

// ── 레벨업 카드 ────────────────────────────────────────────
export function renderLevelUp(ctx, world, choices, anim) {
  dim(ctx, 0.72);

  const ease = 1 - Math.pow(1 - Math.min(1, anim / 0.25), 3);
  text(ctx, 'LEVEL UP', W / 2, 132, {
    size: 46, align: 'center', color: C.lime, glow: 24, alpha: ease,
  });
  text(ctx, `Lv.${world.player.level}`, W / 2, 166, {
    size: 18, align: 'center', color: C.dim, alpha: ease,
  });

  const cw = 260, ch = 300, gap = 34;
  const total = choices.length * cw + (choices.length - 1) * gap;
  let x = (W - total) / 2;
  const y = 210;
  let picked = -1;
  // 카드가 뜨자마자 눌리는 오폭을 막는다. 여기서 막아야 탭이 소비되지 않고 큐에 남는다.
  const ready = anim > 0.15;

  for (let i = 0; i < choices.length; i++) {
    const c = choices[i];
    const p = input.pointer;
    const hover = p.x >= x && p.x <= x + cw && p.y >= y && p.y <= y + ch;
    const isEvo = c.kind === 'evolve';
    const border = isEvo ? C.gold : c.color;

    ctx.save();
    ctx.globalAlpha = ease;
    ctx.fillStyle = hover ? 'rgba(14,20,40,0.98)' : 'rgba(8,10,22,0.95)';
    ctx.fillRect(x, y, cw, ch);
    ctx.strokeStyle = border;
    ctx.lineWidth = hover || isEvo ? 3 : 2;
    ctx.shadowColor = border;
    ctx.shadowBlur = hover ? 22 : isEvo ? 18 : 8;
    ctx.strokeRect(x, y, cw, ch);
    ctx.restore();

    icon(ctx, c.icon, x + cw / 2, y + 78, 30, c.color);
    text(ctx, c.name, x + cw / 2, y + 152, { size: 22, align: 'center', color: C.text });
    text(ctx, c.line1, x + cw / 2, y + 180, { size: 14, align: 'center', color: border });

    wrapText(ctx, c.line2, x + cw / 2, y + 214, cw - 40, 20, { size: 14, align: 'center', color: C.dim });

    text(ctx, `[${i + 1}]`, x + cw / 2, y + ch - 22, { size: 15, align: 'center', color: '#4a5578' });

    if (ready && (consumeTap(x, y, cw, ch) || keyPressed(`Digit${i + 1}`))) picked = i;
    x += cw + gap;
  }
  return picked;
}

function wrapText(ctx, str, x, y, maxW, lh, opts) {
  ctx.save();
  ctx.font = `${opts.size}px ui-monospace, monospace`;
  const words = String(str).split(' ');
  let line = '';
  const lines = [];
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  ctx.restore();
  lines.forEach((l, i) => text(ctx, l, x, y + i * lh, opts));
}

// ── 일시정지 ──────────────────────────────────────────────
export function renderPause(ctx, world) {
  dim(ctx, 0.8);
  // 무기 4 + 강화 4 를 한 열에 세로로 쌓으면 패널 밖으로 넘친다. 2열로 나눈다.
  const pw = 700, ph = 470;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  panel(ctx, px, py, pw, ph);

  text(ctx, '일시정지', px + pw / 2, py + 48, { size: 32, align: 'center', color: C.cyan, glow: 12 });

  const p = world.player;
  text(ctx, `${formatTime(world.t)} · Lv.${p.level} · ${world.kills} 처치`,
    px + pw / 2, py + 80, { size: 15, align: 'center', color: C.dim });

  const colW = (pw - 80) / 2;
  const headY = py + 124;
  const rowY = headY + 30;
  const rowH = 34;

  // 좌열 — 무기
  text(ctx, '무기', px + 40, headY, { size: 14, color: C.gold });
  p.weapons.forEach((w, i) => {
    const def = WEAPONS[w.id];
    const y = rowY + i * rowH;
    icon(ctx, def.icon, px + 56, y, 12, def.color);
    text(ctx, def.name, px + 80, y - 2, { size: 15, color: C.text });
    text(ctx, def.evolved ? '진화' : `Lv.${w.lv}`, px + 40 + colW - 12, y - 2,
      { size: 14, align: 'right', color: def.evolved ? C.gold : C.dim });
  });
  if (!p.weapons.length) text(ctx, '없음', px + 56, rowY, { size: 14, color: C.dim });

  // 우열 — 강화
  const rx = px + 40 + colW + 12;
  text(ctx, '강화', rx, headY, { size: 14, color: C.gold });
  let i = 0;
  for (const id in p.passives) {
    const def = PASSIVES[id];
    const y = rowY + i * rowH;
    icon(ctx, def.icon, rx + 16, y, 12, def.color);
    text(ctx, def.name, rx + 40, y - 2, { size: 15, color: C.text });
    text(ctx, `Lv.${p.passives[id]}`, px + pw - 40, y - 2,
      { size: 14, align: 'right', color: C.dim });
    i++;
  }
  if (i === 0) text(ctx, '없음', rx + 16, rowY, { size: 14, color: C.dim });

  // 설정은 목록 아래 가로로 — 이전에는 우상단에 있어 목록과 겹쳤다
  const setY = rowY + 4 * rowH + 14;
  const r = {
    glow: button(ctx, px + 40, setY, colW - 12, 36, `글로우: ${SETTINGS.glow ? 'ON' : 'OFF'}`, { color: C.dim, size: 15 }),
    mute: button(ctx, rx, setY, colW - 12, 36, `사운드: ${SETTINGS.muted ? 'OFF' : 'ON'}`, { color: C.dim, size: 15 }),
  };

  r.quit   = button(ctx, px + 40, py + ph - 66, 190, 46, '포기', { color: C.red, size: 18 });
  r.resume = button(ctx, px + pw - 230, py + ph - 66, 190, 46, '계속', { size: 18 });
  return r;
}

// ── 결과 ──────────────────────────────────────────────────
export function renderResult(ctx, world, gained, isVictory, newAchievements = [], achReward = 0) {
  dim(ctx, 0.85);
  const pw = 620, ph = newAchievements.length ? 490 : 420;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  panel(ctx, px, py, pw, ph, isVictory ? C.lime : C.red);

  text(ctx, isVictory ? '정화 완료' : '시스템 다운', px + pw / 2, py + 62, {
    size: 40, align: 'center', color: isVictory ? C.lime : C.red, glow: 20,
  });

  const rows = [
    ['생존 시간', formatTime(world.t)],
    ['처치', `${world.kills}`],
    ['도달 레벨', `Lv.${world.player.level}`],
    ['획득 코드 조각', `${gained}`],
  ];
  let y = py + 128;
  for (const [k, v] of rows) {
    text(ctx, k, px + 70, y, { size: 17, color: C.dim });
    text(ctx, v, px + pw - 70, y, { size: 19, align: 'right', color: C.text });
    y += 36;
  }

  // 최종 빌드
  y += 12;
  let x = px + 70;
  for (const w of world.player.weapons) {
    const def = WEAPONS[w.id];
    icon(ctx, def.icon, x, y, 15, def.color);
    levelDots(ctx, x, y + 22, w.lv, def.evolved ? 1 : MAX_LEVEL, def.color);
    x += 44;
  }
  x += 16;
  for (const id in world.player.passives) {
    const def = PASSIVES[id];
    icon(ctx, def.icon, x, y, 13, def.color);
    levelDots(ctx, x, y + 22, world.player.passives[id], MAX_LEVEL, def.color);
    x += 40;
  }

  // 이번 판에 새로 달성한 업적
  if (newAchievements.length) {
    const ay = y + 46;
    text(ctx, achReward > 0 ? `업적 달성  +${achReward} 조각` : '업적 달성',
      px + 70, ay, { size: 14, color: C.gold });
    newAchievements.slice(0, 3).forEach((a, i) => {
      const ry = ay + 22 + i * 20;
      text(ctx, `· ${a.name}`, px + 70, ry, { size: 15, color: C.text });
      if (a.reward) {
        text(ctx, `+${a.reward}`, px + pw - 70, ry, { size: 14, align: 'right', color: C.gold });
      }
    });
    if (newAchievements.length > 3) {
      text(ctx, `외 ${newAchievements.length - 3}개`, px + pw - 70, ay + 22 + 3 * 20,
        { size: 13, align: 'right', color: C.dim });
    }
  }

  return {
    retry: button(ctx, px + pw / 2 - 200, py + ph - 68, 190, 46, '다시 실행  [R]', { size: 18 }),
    title: button(ctx, px + pw / 2 + 10, py + ph - 68, 190, 46, '타이틀', { color: C.dim, size: 18 }),
  };
}
