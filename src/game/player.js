// 플레이어: 이동·대시·피격·경험치.

import { PLAYER_BASE, C } from '../config.js';
import { input } from '../core/input.js';
import { trail, burst } from './particle.js';
import { addShake, addHitstop } from './camera.js';

export function createPlayer() {
  return {
    x: 0, y: 0, vx: 0, vy: 0,
    r: PLAYER_BASE.radius,
    hp: PLAYER_BASE.maxHp,
    faceX: 1, faceY: 0,
    angle: 0,

    level: 1,
    xp: 0,
    xpNext: xpNeeded(1),

    iframe: 0,
    dashCd: 0,
    dashTime: 0,
    dashVx: 0, dashVy: 0,
    trailTimer: 0,

    /** @type {{id:string, lv:number, slot:number, timer:number}[]} */
    weapons: [],
    /** @type {Record<string, number>} */
    passives: {},

    stats: null,   // upgrade.js 가 채운다
    revives: 0,
    alive: true,
  };
}

export function xpNeeded(level) {
  // 12분 런에서 Lv 28~34 도달이 목표. 초반 레벨업 간격이 짧아야 손에 붙는다.
  return 4 + Math.round(level * 2.5) + Math.floor(level * level * 0.35);
}

export function updatePlayer(p, world, dt) {
  const st = p.stats;

  p.iframe = Math.max(0, p.iframe - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);

  // 대시 입력
  if (input.dash && p.dashCd <= 0 && (input.mx !== 0 || input.my !== 0)) {
    p.dashCd = st.dashCd;
    p.dashTime = PLAYER_BASE.dashTime;
    p.iframe = Math.max(p.iframe, PLAYER_BASE.dashIframe);
    const spd = PLAYER_BASE.dashDist / PLAYER_BASE.dashTime;
    p.dashVx = input.mx * spd;
    p.dashVy = input.my * spd;
    world.sfx('dash');
    addShake(3);
  }

  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.vx = p.dashVx;
    p.vy = p.dashVy;
    trail(p.x, p.y, C.cyan, 10, 0.28);
  } else {
    p.vx = input.mx * st.speed;
    p.vy = input.my * st.speed;
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  if (input.mx !== 0 || input.my !== 0) {
    p.faceX = input.mx;
    p.faceY = input.my;
    p.angle = Math.atan2(input.my, input.mx);

    p.trailTimer -= dt;
    if (p.trailTimer <= 0) {
      p.trailTimer = 0.05;
      trail(p.x - p.faceX * 8, p.y - p.faceY * 8, '#0a8fa0', 5, 0.22);
    }
  }

  // 방화벽 재생
  if (st.regen > 0 && p.hp < st.maxHp) {
    p.hp = Math.min(st.maxHp, p.hp + st.regen * dt);
  }
}

export function damagePlayer(p, world, amount) {
  if (p.iframe > 0 || !p.alive) return;
  p.hp -= amount;
  world.runStats.hitsTaken++;
  p.iframe = PLAYER_BASE.ihit;
  world.sfx('hurt');
  addShake(9);
  addHitstop(0.05);
  burst(p.x, p.y, C.red, 6, 130, 3);

  if (p.hp <= 0) {
    if (p.revives > 0) {
      p.revives--;
      world.runStats.revived = true;
      p.hp = p.stats.maxHp * 0.5;
      p.iframe = 2.0;
      world.sfx('heal');
      world.empBlast(400);
      return;
    }
    p.hp = 0;
    p.alive = false;
    world.sfx('die');
    addShake(20);
    burst(p.x, p.y, C.cyan, 40, 320, 6);
  }
}

/** @returns {number} 이번에 오른 레벨 수 (한 번에 여러 레벨이 오를 수 있다) */
export function gainXp(p, amount) {
  p.xp += amount;
  let levels = 0;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = xpNeeded(p.level);
    levels++;
  }
  return levels;
}
