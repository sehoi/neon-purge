// 월드 렌더링. 드로우 순서와 글로우 비용을 여기서 통제한다.

import { W, H, C, SETTINGS, IS_TOUCH } from '../config.js';
import { camera, camOffsetX, camOffsetY } from '../game/camera.js';
import { particles } from '../game/particle.js';
import { polygon, fillPolygon, star, circle, disc, line, ship, zap } from './shapes.js';
import { TAU } from '../core/vec.js';

const MARGIN = 80;

/**
 * 네온 글로우 — shadowBlur 를 쓰지 않는다.
 *
 * ctx.shadowBlur 는 "설정 전환"이 아니라 "그리는 도형 하나하나"에 블러 래스터화를
 * 물리므로, 도형 수와 블러 영역 크기에 비례해 비용이 폭증한다. 실측에서 길이 2800px
 * 짜리 레이저 빔 2개가 27ms, 픽업 1500개가 54ms를 먹었다 (프레임 예산은 16.6ms).
 *
 * 대신 굵은 반투명 외곽선 + 얇은 밝은 코어선을 겹쳐 그린다. stroke 두 번이라
 * 경로를 두 번 만들지만, 블러 없는 stroke 는 비교가 안 되게 싸다.
 */
function neon(ctx, color, width, drawPath) {
  ctx.strokeStyle = color;
  if (SETTINGS.glow && !_lowDetail) {
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = width * 3.4;
    drawPath();
    ctx.globalAlpha = 1;
  }
  ctx.lineWidth = width;
  drawPath();
}

/**
 * 적응형 품질.
 * 화면이 붐빌 때만 외곽 번짐(neon 2-pass)과 헤일로를 끈다. 이때는 어차피 도형이
 * 서로 겹쳐 번짐이 보이지 않고, 프레임 스파이크만 남는다.
 * 플레이어·보스·빔처럼 수가 적고 중요한 요소는 이 축소에서 제외한다.
 */
let _lowDetail = false;

// 모바일 GPU 는 훨씬 일찍 무릎을 꿇으므로 임계값을 낮게 잡는다.
const DETAIL_THRESHOLD = IS_TOUCH ? 120 : 260;

function updateDetailLevel(world) {
  _lowDetail = world.enemies.count + particles.count > DETAIL_THRESHOLD;
}

/** 축소 대상에서 제외되는 요소용 — 플레이어, 보스, 빔처럼 수가 적고 중요한 것들. */
function neonFull(ctx, color, width, drawPath) {
  const prev = _lowDetail;
  _lowDetail = false;
  neon(ctx, color, width, drawPath);
  _lowDetail = prev;
}

// 프레임당 힙 할당을 만들지 않도록 그룹 버퍼를 재사용한다
const _enemyGroups = new Map();
const _boltGroups = new Map();
const _orbs = [];

function groupBuffer(map, key) {
  let list = map.get(key);
  if (!list) { list = []; map.set(key, list); }
  return list;
}

function clearGroups(map) {
  for (const list of map.values()) list.length = 0;
}

export function renderWorld(ctx, world) {
  updateDetailLevel(world);
  const ox = camOffsetX();
  const oy = camOffsetY();

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx, ox, oy);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const left = camera.x - W / 2 - MARGIN;
  const right = camera.x + W / 2 + MARGIN;
  const top = camera.y - H / 2 - MARGIN;
  const bottom = camera.y + H / 2 + MARGIN;
  const visible = o => o.x > left && o.x < right && o.y > top && o.y < bottom;

  drawPickups(ctx, world, visible);
  drawEnemies(ctx, world, visible);
  drawEnemyShots(ctx, world, visible);
  drawPlayerAttacks(ctx, world, visible);
  drawMines(ctx, world, visible);
  drawPlayer(ctx, world);
  drawParticles(ctx, visible);
  drawCine(ctx, world);

  ctx.globalAlpha = 1;
  ctx.restore();

  drawVignette(ctx, world);
}

// 터치에서는 격자를 성기게 — 화면이 가로로 넓어 세로선이 그만큼 늘어나고,
// 그 선들이 수평 이동 중 계속 다시 그려진다.
const GRID_SIZE = IS_TOUCH ? 116 : 80;

/**
 * 배경 그리드.
 *
 * 반복 패턴(createPattern + fillRect)으로 바꿔봤다가 되돌렸다 — DPR 변환이 걸린
 * 상태에서는 타일을 리샘플링하느라 오히려 3배 이상 느렸다(9.5ms → 31.9ms).
 * 선을 직접 긋는 쪽이 훨씬 싸다. 화면 밖으로 나가는 선은 그리지 않는다.
 */
function drawGrid(ctx, ox, oy) {
  // 패럴랙스 0.4 — 배경이 플레이어보다 천천히 흐른다
  const px = (ox * 0.4) % GRID_SIZE;
  const py = (oy * 0.4) % GRID_SIZE;
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  for (let x = px - GRID_SIZE; x < W + GRID_SIZE; x += GRID_SIZE) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, H);
  }
  for (let y = py - GRID_SIZE; y < H + GRID_SIZE; y += GRID_SIZE) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(W, Math.round(y) + 0.5);
  }
  ctx.stroke();
}

// 픽업은 전부 "속이 꽉 찬 밝은 도형". 적은 전부 "속이 빈 외곽선".
// 색이 아니라 실루엣으로 갈리기 때문에 난전 중에도 헷갈리지 않는다.
const PICKUP_STYLE = {
  shade:  { color: '#8cff3d', inner: '#f0ffdc', sides: 4, spin: 1.6 },
  core:   { color: '#ffd23d', inner: '#fff8d0', sides: 6, spin: 2.2, ring: true },
  prime:  { color: '#ffffff', inner: '#ffffff', sides: 8, spin: 3.2, ring: true, halo: true },
  heal:   { color: C.mint,   inner: '#e0fff2', sides: 12, spin: 0,   halo: true, cross: true },
  emp:    { color: C.cyan,   inner: '#dcfaff', sides: 3,  spin: 4.0, halo: true, ring: true },
  magnet: { color: C.violet, inner: '#f0e0ff', sides: 5,  spin: 3.0, halo: true, ring: true },
};

const _pickupGroups = { shade: [], core: [], prime: [], heal: [], emp: [], magnet: [] };

function drawPickups(ctx, world, visible) {
  for (const k in _pickupGroups) _pickupGroups[k].length = 0;
  world.pickups.forEach(k => { if (visible(k)) _pickupGroups[k.kind].push(k); });

  for (const kind in _pickupGroups) {
    const list = _pickupGroups[kind];
    if (!list.length) continue;
    const s = PICKUP_STYLE[kind];

    // 헤일로는 희귀 픽업에만. 흔한 셰이드까지 겹치면 화면이 뿌예지고 비용도 커진다.
    if (s.halo) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = s.color;
      for (const k of list) disc(ctx, k.x, k.y, k.r * 1.9);
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = s.color;
    for (const k of list) {
      // 흡인 중인 조각은 더 크게 — "지금 오고 있다"가 보여야 한다
      const r = k.r * (1 + Math.sin(k.age * 6) * 0.09) * (k.pulling ? 1.25 : 1);
      fillPolygon(ctx, k.x, k.y, r, s.sides, k.age * s.spin);
    }

    // 중심의 밝은 코어 — 작은 조각도 눈에 걸린다
    ctx.fillStyle = s.inner;
    for (const k of list) {
      const r = k.r * (1 + Math.sin(k.age * 6) * 0.09) * (k.pulling ? 1.25 : 1);
      fillPolygon(ctx, k.x, k.y, r * 0.42, s.sides, k.age * s.spin);
    }

    if (s.ring) {
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = s.inner;
      ctx.lineWidth = 1.5;
      for (const k of list) circle(ctx, k.x, k.y, k.r * 1.5);
      ctx.globalAlpha = 1;
    }
    if (s.cross) {
      ctx.strokeStyle = '#04241a';
      ctx.lineWidth = 3;
      for (const k of list) {
        line(ctx, k.x - k.r * 0.5, k.y, k.x + k.r * 0.5, k.y);
        line(ctx, k.x, k.y - k.r * 0.5, k.x, k.y + k.r * 0.5);
      }
    }
  }
}

/**
 * 보스 연출. 등장에는 조여드는 고리를, 처치에는 퍼지는 섬광을 그린다.
 * 월드가 멈춰 있는 동안 화면에 아무 일도 안 일어나면 멎은 것처럼 보인다.
 */
/**
 * 기뢰. 무장 전에는 흐리게, 무장 뒤에는 맥동한다.
 * 언제부터 터지는지 보이지 않으면 "깔아두고 도망친다"를 계획할 수 없다.
 */
function drawMines(ctx, world, visible) {
  world.mines.forEach(m => {
    if (!visible(m)) return;
    const armed = m.armed <= 0;
    const pulse = armed ? 0.75 + 0.25 * Math.sin(world.t * 9) : 0.35;
    ctx.globalAlpha = pulse;
    neon(ctx, m.color, armed ? 2.5 : 1.5, () => {
      circle(ctx, m.x, m.y, m.r);
      if (armed) circle(ctx, m.x, m.y, m.r + 5);
    });
    // 수명이 얼마 안 남으면 폭발 반경을 미리 보여준다
    if (m.life < 1.2) {
      ctx.globalAlpha = 0.18 * (m.life / 1.2);
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

function drawCine(ctx, world) {
  const c = world.cine;
  if (!c) return;
  const k = Math.min(1, c.t / c.dur);

  if (c.kind === 'in') {
    const b = world.boss;
    if (!b) return;
    ctx.save();
    ctx.globalAlpha = 0.9 * (1 - k);
    ctx.strokeStyle = b.def.color;
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const t = Math.min(1, k + i * 0.14);
      circle(ctx, b.x, b.y, 520 * (1 - t) + b.r);
    }
    ctx.restore();
    return;
  }

  // 처치 — 고리가 세 겹으로 퍼진다
  ctx.save();
  ctx.strokeStyle = c.color;
  for (let i = 0; i < 3; i++) {
    const t = Math.min(1, Math.max(0, k - i * 0.16) / 0.84);
    if (t <= 0) continue;
    ctx.globalAlpha = 0.75 * (1 - t);
    ctx.lineWidth = 6 * (1 - t) + 1;
    circle(ctx, c.x, c.y, 40 + t * 780);
  }
  ctx.restore();
}

function drawEnemies(ctx, world, visible) {
  clearGroups(_enemyGroups);
  world.enemies.forEach(e => {
    if (!visible(e) && !e.def.boss) return;
    groupBuffer(_enemyGroups, e.flash > 0 ? '#ffffff' : e.def.color).push(e);
  });

  for (const [col, list] of _enemyGroups) {
    if (!list.length) continue;
    const big = list[0].def.elite || list[0].def.boss;
    (big ? neonFull : neon)(ctx, col, big ? 3 : 2, () => {
      for (const e of list) {
        // 등장 연출 중이면 커지면서 나타난다 (spawnScale 0 → 1)
        const s = e.spawnScale != null && e.spawnScale < 1 ? e.spawnScale : 1;
        const rr = e.r * (0.3 + s * 0.7);
        if (e.def.shape === 'star') star(ctx, e.x, e.y, rr, e.def.sides, e.rot);
        else polygon(ctx, e.x, e.y, rr, e.def.sides, e.rot);
      }
    });
  }

  // 조준선과 체력 링은 해당하는 개체만 (대부분의 프레임에서 0~2개)
  ctx.globalAlpha = 1;
  world.enemies.forEach(e => {
    if (!visible(e) && !e.def.boss) return;

    // 리퍼/좀비가 어디로 돌진할지 미리 보여준다
    if (e.state === 1) {
      ctx.save();
      ctx.strokeStyle = C.red;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      line(ctx, e.x, e.y, e.x + e._tx * 320, e.y + e._ty * 320);
      ctx.restore();
    }
    if ((e.def.elite || e.def.boss) && !(e.spawnScale != null && e.spawnScale < 1)) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = e.def.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * (e.hp / e.maxHp));
      ctx.stroke();
      ctx.restore();
    }
  });
}

function drawEnemyShots(ctx, world, visible) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ff7a4d';
  world.enemyShots.forEach(s => {
    if (!visible(s)) return;
    disc(ctx, s.x, s.y, s.r);
  });
  // 밝은 코어 한 겹만 더. 탄이 수백 개일 수 있으므로 두 번을 넘기지 않는다.
  ctx.fillStyle = '#ffd9c8';
  world.enemyShots.forEach(s => {
    if (!visible(s)) return;
    disc(ctx, s.x, s.y, s.r * 0.45);
  });
}

function drawPlayerAttacks(ctx, world, visible) {
  const p = world.player;

  // 링
  world.rings.forEach(r => {
    const a = r.life / r.maxLife;
    ctx.globalAlpha = a;
    neon(ctx, r.color, 3 + a * 3, () => circle(ctx, r.x, r.y, r.r));
    ctx.globalAlpha = 1;
  });

  // 빔 — 화면을 가로지르는 긴 선이라 글로우 비용에 가장 민감하다
  world.beams.forEach(b => {
    const a = Math.min(1, b.life / 0.3);
    const ca = Math.cos(b.angle) * 1400, sa = Math.sin(b.angle) * 1400;
    ctx.globalAlpha = a * 0.9;
    neonFull(ctx, b.color, 5, () => line(ctx, p.x - ca, p.y - sa, p.x + ca, p.y + sa));
    ctx.globalAlpha = 1;
  });

  // 탄
  clearGroups(_boltGroups);
  world.bolts.forEach(b => { if (visible(b)) groupBuffer(_boltGroups, b.color).push(b); });
  for (const [col, list] of _boltGroups) {
    if (!list.length) continue;
    if (SETTINGS.glow) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = col;
      for (const b of list) disc(ctx, b.x, b.y, b.r * 2.2);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = col;
    for (const b of list) disc(ctx, b.x, b.y, b.r);
  }

  // 궤도 오브 (+ 이온 벨트의 연결 전류)
  _orbs.length = 0;
  world.forEachOrbital(o => _orbs.push(o));
  if (_orbs.length) {
    const col = _orbs[0].color;

    // 회전 궤적. 이게 없으면 이동 중에는 그냥 붙어다니는 점으로 보인다.
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    for (const o of _orbs) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, o.radius, o.angle - 0.85, o.angle);
      ctx.stroke();
    }
    ctx.restore();
    if (SETTINGS.glow) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = col;
      for (const o of _orbs) disc(ctx, o.x, o.y, o.r * 2);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = col;
    for (const o of _orbs) disc(ctx, o.x, o.y, o.r);
    if (_orbs[0].link) {
      neon(ctx, col, 2, () => {
        for (let i = 0; i < _orbs.length; i++) {
          const a = _orbs[i], b = _orbs[(i + 1) % _orbs.length];
          line(ctx, a.x, a.y, b.x, b.y);
        }
      });
    }
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  if (!p.alive) return;
  // 피격 무적 중 깜빡임
  const blink = p.iframe > 0 && Math.floor(p.iframe * 20) % 2 === 0;
  ctx.globalAlpha = blink ? 0.35 : 1;
  neonFull(ctx, C.cyan, 2.5, () => ship(ctx, p.x, p.y, p.r, p.angle));

  // 대시 쿨다운 링
  if (p.dashCd > 0) {
    const frac = 1 - p.dashCd / p.stats.dashCd;
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = C.dim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawParticles(ctx, visible) {
  // 파티클은 개수가 가장 많으므로 개별 글로우를 걸지 않는다.
  // 밝은 색 + 페이드만으로 충분히 네온으로 읽힌다.
  particles.forEach(p => {
    const a = p.life / p.maxLife;
    if (p.kind === 'zap') {
      // zap 은 끝점을 vx/vy 에 담고 있어 화면 컬링 대상이 아니다
      ctx.globalAlpha = a;
      neon(ctx, p.color, 3, () => zap(ctx, p.x, p.y, p.vx, p.vy, p.rot));
      return;
    }
    if (!visible(p)) return;
    ctx.globalAlpha = a;
    if (p.kind === 'shard') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      polygon(ctx, p.x, p.y, p.r, 3, p.rot);
    } else if (p.kind === 'flash') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 * a;
      circle(ctx, p.x, p.y, p.r);
    } else {
      ctx.fillStyle = p.color;
      disc(ctx, p.x, p.y, p.r * a);
    }
  });
  ctx.globalAlpha = 1;
}

function drawVignette(ctx, world) {
  const p = world.player;
  const hpRatio = p.stats ? p.hp / p.stats.maxHp : 1;
  if (hpRatio > 0.35) return;
  // 체력이 낮을수록 붉은 비네트가 맥동한다
  const intensity = (1 - hpRatio / 0.35) * (0.25 + Math.sin(performance.now() / 220) * 0.08);
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, 'rgba(255,59,59,0)');
  g.addColorStop(1, `rgba(255,59,59,${Math.max(0, intensity)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
