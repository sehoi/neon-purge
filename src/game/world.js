// 월드: 모든 엔티티를 보유하고 업데이트 순서를 오케스트레이션한다.

import { GRID_CELL, C } from '../config.js';
import { createPool } from '../core/pool.js';
import { createGrid } from '../core/grid.js';
import { dist2, hits } from '../core/vec.js';
import { rnd, chance, range } from '../core/rng.js';
import { sfx as playSfx } from '../core/audio.js';

import { ENEMIES } from '../data/enemies.js';
import { WEAPONS } from '../data/weapons.js';
import { hpScale, dmgScale } from '../data/waves.js';

import { createPlayer, updatePlayer, damagePlayer, gainXp, xpNeeded } from './player.js';
import { recalcStats, giveWeapon } from './upgrade.js';
import { createSpawner, updateSpawner, spawnRingOfEnemies } from './spawner.js';
import { camera, resetCamera, updateCamera, addShake, addHitstop } from './camera.js';
import { burst, flash, zapLine, updateParticles, clearParticles } from './particle.js';

/**
 * 경험치 값 → 픽업 등급. 값이 클수록 크고 밝은 조각이 떨어진다.
 * 플레이어가 "저건 주우러 갈 가치가 있다"를 한눈에 판단할 수 있어야 한다.
 */
export function xpKindFor(value) {
  if (value >= 10) return 'prime';
  if (value >= 3) return 'core';
  return 'shade';
}

function makeEnemy() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, r: 10, hp: 1, maxHp: 1, speed: 0,
    type: '', def: null, alive: false, flash: 0, rot: 0, spin: 0,
    state: 0, timer: 0, timer2: 0, dx: 0, dy: 0,
    kx: 0, ky: 0,                       // 넉백 속도
    _tx: 0, _ty: 0, _tdist: 0,
    lastHit: new Float32Array(8),       // 무기 슬롯별 마지막 피격 시각
  };
}

function makeBolt() {
  return { x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 0, slot: 0,
           color: '#fff', life: 0, pierce: false, hitCd: 0.3, alive: false };
}

function makeRing() {
  return { x: 0, y: 0, r: 0, maxR: 100, dmg: 0, slot: 0,
           color: '#fff', life: 0, maxLife: 0.35, knock: false, alive: false };
}

function makeBeam() {
  return { angle: 0, spin: 0, dmg: 0, slot: 0, life: 0, maxLife: 1,
           color: '#fff', alive: false };
}

function makeShot() {
  return { x: 0, y: 0, vx: 0, vy: 0, r: 6, dmg: 0, life: 0, alive: false };
}

function makePickup() {
  return { x: 0, y: 0, vx: 0, vy: 0, r: 6, kind: 'shade', value: 1,
           age: 0, pulling: false, alive: false };
}

export function createWorld(meta) {
  const world = {
    t: 0,
    meta: meta || {},
    player: createPlayer(),
    enemies:    createPool(makeEnemy, 400),
    bolts:      createPool(makeBolt, 400),
    rings:      createPool(makeRing, 40),
    beams:      createPool(makeBeam, 12),
    enemyShots: createPool(makeShot, 300),
    pickups:    createPool(makePickup, 600),
    grid: createGrid(GRID_CELL),
    spawner: createSpawner(),

    orbGroups: new Map(),
    orbPhase: new Map(),

    kills: 0,
    bonusFragments: 0,
    // 업적 판정용 런 요약. endRun 에서 읽는다.
    runStats: { hitsTaken: 0, revived: false, bossStart: 0, bossTime: 0 },
    hpScale: 1,
    dmgScale: 1,
    eventLock: false,
    eventLockTimer: 0,
    boss: null,
    bossHpMax: 0,
    /**
     * 보스 연출. { kind:'in'|'out', t, dur }
     *
     * 최종 보스가 아무 예고 없이 화면 밖에서 걸어들어오면 "또 하나의 큰 적"으로만
     * 보인다. 등장에 2.6초, 처치에 2.6초를 쓴다 — 그 시간 동안 다른 적은 멈추고
     * 카메라와 소리만 남는다.
     */
    cine: null,
    banner: null,        // { text, life }
    over: false,
    victory: false,
    pendingLevelUps: 0,
  };

  Object.assign(world, API);
  return world;
}

export function startRun(world) {
  const p = world.player;
  p.x = p.y = 0;
  p.weapons.length = 0;
  p.passives = {};
  p.level = 1 + (world.meta.prefetch || 0);
  p.xp = 0;
  // 이걸 빠뜨리면 두 번째 판이 직전 런의 최종 레벨 요구치를 그대로 물려받아
  // 첫 레벨업에 수백 XP 를 요구하게 된다. 성장이 통째로 멈춘다.
  p.xpNext = xpNeeded(p.level);
  p.revives = world.meta.backup || 0;
  p.alive = true;

  p.vx = p.vy = 0;
  p.iframe = 0;
  p.dashCd = 0;
  p.dashTime = 0;
  p.faceX = 1;
  p.faceY = 0;
  p.angle = 0;

  recalcStats(p, world.meta);
  p.hp = p.stats.maxHp;

  const start = world.meta.startWeapon || 'pulse';
  giveWeapon(p, WEAPONS[start] ? start : 'pulse');

  resetCamera(0, 0);
  clearParticles();
  world.enemies.clear();
  world.bolts.clear();
  world.rings.clear();
  world.beams.clear();
  world.enemyShots.clear();
  world.pickups.clear();
  world.orbGroups.clear();
  world.orbPhase.clear();
  world.spawner = createSpawner();
  world.t = 0;
  world.kills = 0;
  world.bonusFragments = 0;
  world.runStats.hitsTaken = 0;
  world.runStats.revived = false;
  world.runStats.bossStart = 0;
  world.runStats.bossTime = 0;
  world.eventLock = false;
  world.boss = null;
  world.cine = null;
  world.over = false;
  world.victory = false;
  world.banner = null;

  // 프리페치로 올려둔 시작 레벨만큼은 시작 시점에 강화를 고르고 들어간다.
  // 레벨만 올라가고 고를 기회가 없으면 산 의미가 없다.
  world.pendingLevelUps = world.meta.prefetch || 0;
}

const API = {
  sfx(name) { playSfx(name); },
  shake(a) { addShake(a); },

  // ── 스폰 ────────────────────────────────────────────────
  spawnEnemy(type, x, y) {
    const def = ENEMIES[type];
    if (!def) return null;
    const e = this.enemies.spawn();
    e.type = type;
    e.def = def;
    e.x = x; e.y = y;
    e.vx = e.vy = 0;
    e.r = def.r;
    e.speed = def.speed;
    e.maxHp = e.hp = def.hp * (def.elite || def.boss ? 1 : this.hpScale);
    e.flash = 0;
    // def 가 회전을 명시하면 그대로 쓴다 (탱크는 고정, 스팸봇은 빠르게)
    e.rot = def.rot0 !== undefined ? def.rot0 : rnd() * Math.PI * 2;
    e.spin = def.spin !== undefined ? def.spin : range(-1.2, 1.2);
    e.state = 0;
    e.timer = 0;
    e.timer2 = 0;
    e.kx = e.ky = 0;
    e.lastHit.fill(-99);
    return e;
  },

  spawnBolt(x, y, vx, vy, dmg, slot, opt = {}) {
    const b = this.bolts.spawn();
    b.x = x; b.y = y; b.vx = vx; b.vy = vy;
    b.dmg = dmg; b.slot = slot;
    b.r = opt.r || 5;
    b.color = opt.color || C.cyan;
    b.life = opt.life || 1.5;
    b.pierce = !!opt.pierce;
    b.hitCd = opt.hitCd || 0.3;
    return b;
  },

  spawnRing(x, y, dmg, maxR, slot, color, knock = false) {
    const r = this.rings.spawn();
    r.x = x; r.y = y; r.r = 8; r.maxR = maxR;
    r.dmg = dmg; r.slot = slot; r.color = color;
    r.maxLife = r.life = 0.35;
    r.knock = knock;
    return r;
  },

  spawnBeam(angle, spin, dmg, life, slot, color, width = 7) {
    const b = this.beams.spawn();
    b.angle = angle; b.spin = spin; b.dmg = dmg;
    b.slot = slot; b.color = color; b.width = width;
    b.maxLife = b.life = life;
    return b;
  },

  spawnEnemyShot(x, y, vx, vy, dmg) {
    const s = this.enemyShots.spawn();
    s.x = x; s.y = y; s.vx = vx; s.vy = vy;
    s.dmg = dmg; s.r = 6; s.life = 6;
    return s;
  },

  spawnPickup(x, y, kind, value) {
    const p = this.pickups.spawn();
    p.x = x; p.y = y;
    const a = rnd() * Math.PI * 2;
    const s = range(20, 70);
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.kind = kind;
    p.value = value;
    p.r = kind === 'shade' ? 5 : kind === 'core' ? 9.5 : kind === 'prime' ? 14 : 11;
    p.age = 0;
    p.pulling = false;
    return p;
  },

  // ── 조회 ────────────────────────────────────────────────
  nearestEnemy(x, y, maxDist, exclude) {
    let best = null, bestD = maxDist * maxDist;
    this.enemies.forEach(e => {
      if (e === exclude) return;
      const d = dist2(x, y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    });
    return best;
  },

  // ── 무기 보조 ────────────────────────────────────────────
  chainZap(dmg, bounces, slot, area = 1, color = '#6bc8ff') {
    const p = this.player;
    let from = p;
    const visited = [];
    let cur = this.nearestEnemy(p.x, p.y, 400 * area);
    for (let i = 0; i <= bounces && cur; i++) {
      zapLine(from.x, from.y, cur.x, cur.y, color);
      this.damageEnemy(cur, dmg, 0, 0);
      visited.push(cur);
      from = cur;
      // 이미 맞은 적을 제외하고 다음 대상 탐색
      let next = null, bestD = (260 * area) * (260 * area);
      this.enemies.forEach(e => {
        if (visited.includes(e)) return;
        const d = dist2(from.x, from.y, e.x, e.y);
        if (d < bestD) { bestD = d; next = e; }
      });
      cur = next;
    }
    if (visited.length) this.sfx('hit');
  },

  syncOrbitals(slot, count, radius, dmg, spin, dt, color, link) {
    const ph = (this.orbPhase.get(slot) || 0) + spin * dt;
    this.orbPhase.set(slot, ph);

    let list = this.orbGroups.get(slot);
    if (!list) { list = []; this.orbGroups.set(slot, list); }
    while (list.length < count) {
      list.push({ x: 0, y: 0, r: 11, dmg: 0, slot, color, link, angle: 0, radius: 0 });
    }
    while (list.length > count) list.pop();

    const p = this.player;
    for (let i = 0; i < count; i++) {
      const a = ph + (i / count) * Math.PI * 2;
      const o = list[i];
      o.x = p.x + Math.cos(a) * radius;
      o.y = p.y + Math.sin(a) * radius;
      o.dmg = dmg;
      o.color = color;
      o.link = link;
      o.angle = a;         // 렌더가 회전 궤적을 그리는 데 쓴다
      o.radius = radius;
    }
  },

  clearOrbitals() {
    this.orbGroups.clear();
    this.orbPhase.clear();
  },

  forEachOrbital(cb) {
    for (const list of this.orbGroups.values()) {
      for (let i = 0; i < list.length; i++) cb(list[i], list, i);
    }
  },

  empBlast(dmg) {
    const p = this.player;
    this.enemies.forEach(e => {
      if (dist2(p.x, p.y, e.x, e.y) < 900 * 900) this.damageEnemy(e, dmg, 0, 0);
    });
    this.enemyShots.forEach(s => { s.alive = false; });
    addShake(14);
    this.sfx('emp');
    flash(p.x, p.y, '#ffffff', 60);
  },

  // ── 데미지 ──────────────────────────────────────────────
  damageEnemy(e, dmg, kx = 0, ky = 0) {
    if (e.invuln) return;
    if (!e.alive) return;
    e.hp -= dmg;
    e.flash = 0.08;
    if (!e.def.noKnockback && (kx || ky)) {
      e.kx += kx;
      e.ky += ky;
    }
    if (e.hp <= 0) this.killEnemy(e);
  },

  killEnemy(e) {
    e.alive = false;
    this.kills++;
    // 후반에는 초당 수십 마리가 죽는다. 파편 수를 적 크기에 맞춰 아낀다.
    burst(e.x, e.y, e.def.color,
      e.def.elite || e.def.boss ? 22 : e.r > 18 ? 7 : 4,
      e.def.elite ? 300 : 180,
      e.def.elite ? 6 : 4);
    this.sfx('kill');

    if (e.def.elite || e.def.boss) {
      addShake(14);
      addHitstop(0.12);
      if (e.def.boss) {
        // 승리 판정은 연출이 끝난 뒤에 낸다. 바로 결과창이 뜨면 이긴 순간을 못 본다
        this.runStats.bossTime = this.runStats.bossStart
          ? this.t - this.runStats.bossStart : 0;
        this.cine = { kind: 'out', t: 0, dur: 2.6, x: e.x, y: e.y, color: e.def.color };
        this.boss = null;
      }
      if (this.boss === e) this.boss = null;
      // 엘리트가 여럿 등장하는 웨이브에서는 전부 처치해야 잠금이 풀린다
      let remaining = 0;
      this.enemies.forEach(o => { if (o !== e && (o.def.elite || o.def.boss)) remaining++; });
      if (remaining === 0) this.eventLock = false;
    }
    /*
     * 잡몹 처치에는 히트스톱을 주지 않는다.
     *
     * 0.012초는 한 프레임보다 짧아 한 마리로는 체감되지도 않는데, 후반에는
     * 초당 수십 마리가 죽으면서 매 프레임 다시 걸린다. 얻는 것 없이 끊김만 남았다.
     * 타격감은 엘리트·보스(0.12초)와 피격(0.05초)에서만 낸다.
     */

    // 드랍. def.xp 는 "그 적이 주는 총 경험치"다.
    // 픽업의 겉모습은 값에서 자동으로 정해진다 — 강한 적이 더 큰 조각을 떨어뜨리는 게
    // 눈으로 바로 보여야 한다. (종류와 def.xp 를 곱하면 엘리트에서 경험치가 폭발한다)
    const totalXp = e.def.xp || 1;
    if (e.def.elite || e.def.boss) {
      const n = 8;
      const per = Math.max(1, Math.round(totalXp / n));
      for (let i = 0; i < n; i++) this.spawnPickup(e.x, e.y, 'prime', per);
    } else {
      const r = rnd();
      const mult = r < 0.01 ? 8 : r < 0.07 ? 3 : 1;   // 드물게 대박이 터진다
      const value = totalXp * mult;
      this.spawnPickup(e.x, e.y, xpKindFor(value), value);
    }
    if (chance(0.008)) this.spawnPickup(e.x, e.y, 'heal', 0);
    if (chance(0.004)) this.spawnPickup(e.x, e.y, 'emp', 0);
    if (chance(0.004)) this.spawnPickup(e.x, e.y, 'magnet', 0);

    if (e.def.onDeath) e.def.onDeath(e, this);
  },

  /** 지속 판정 무기가 매 프레임 데미지를 넣는 것을 막는다. */
  canHit(e, slot, hitCd) {
    if (this.t - e.lastHit[slot] < hitCd) return false;
    e.lastHit[slot] = this.t;
    return true;
  },

  // ── 이벤트 ──────────────────────────────────────────────
  fireEvent(name) {
    this.eventLockTimer = 60;
    if (name === 'elite_demon') {
      this.eventLock = true;
      this.showBanner('경고 — 데몬 프로세스 감지');
      this.sfx('elite');
      spawnRingOfEnemies(this, 'demon', 1, 420);
    } else if (name === 'elite_zombie') {
      this.eventLock = true;
      this.showBanner('경고 — 좀비 스레드 ×2');
      this.sfx('elite');
      spawnRingOfEnemies(this, 'zombie', 2, 460);
    } else if (name === 'boss') {
      this.eventLock = true;
      this.showBanner('커널 바이러스 — 최종 정화');
      this.sfx('elite');
      addShake(18);
      this.enemies.forEach(e => { if (!e.def.elite) e.alive = false; });
      // 화면 밖이 아니라 눈앞에 조립되며 나타난다
      const b = this.spawnEnemy('kernel', this.player.x + 330, this.player.y);
      if (b) { b.frozen = true; b.invuln = true; b.spawnScale = 0; }
      this.boss = b;
      this.bossHpMax = b ? b.maxHp : 0;
      this.cine = { kind: 'in', t: 0, dur: 2.6 };
    }
  },

  /**
   * 몸 주위 상시 피해 장판.
   *
   * 궤도 노드가 "도는 점"이라 사이가 비는 것과 달리 빈틈이 없다. 대신 반경이
   * 짧아 붙는 적만 잡는다 — 파고드는 적을 알아서 녹이는 자리다.
   *
   * tick 간격으로만 판정한다. 매 프레임 때리면 초당 60번이라 수치가 무의미해지고
   * 판정 비용도 그만큼 든다.
   */
  zapField(w, radius, dmg, tick, dt, color) {
    w.fieldTimer = (w.fieldTimer || 0) - dt;
    w.fieldR = radius;
    w.fieldColor = color;
    if (w.fieldTimer > 0) return;
    w.fieldTimer += tick;
    if (w.fieldTimer < 0) w.fieldTimer = tick;

    const p = this.player;
    _fieldWorld = this; _fieldR = radius; _fieldDmg = dmg;
    _fieldSlot = w.slot; _fieldColor = color; _fieldX = p.x; _fieldY = p.y;
    this.grid.query(p.x, p.y, radius + 40, _fieldHitCb);
    this.sfx('hit');
  },

  showBanner(text) {
    this.banner = { text, life: 3.0 };
  },
};

// ── 메인 업데이트 ───────────────────────────────────────────
export function updateWorld(world, dt) {
  const p = world.player;

  world.t += dt;
  world.hpScale = hpScale(world.t);
  world.dmgScale = dmgScale(world.t);

  if (world.banner) {
    world.banner.life -= dt;
    if (world.banner.life <= 0) world.banner = null;
  }

  if (world.cine) dt = stepCine(world, dt);

  // 엘리트를 오래 방치해도 게임이 멈춰 있지 않도록 잠금에 상한을 둔다 (보스는 예외)
  if (world.eventLock && !world.boss) {
    world.eventLockTimer -= dt;
    if (world.eventLockTimer <= 0) world.eventLock = false;
  }

  updatePlayer(p, world, dt);
  updateWeapons(world, dt);
  updateSpawner(world.spawner, world, dt);

  // 브로드페이즈 갱신
  world.grid.clear();
  world.enemies.forEach(e => world.grid.insert(e));

  updateEnemies(world, dt);
  updateBolts(world, dt);
  updateRings(world, dt);
  updateBeams(world, dt);
  updateOrbitals(world, dt);
  updateEnemyShots(world, dt);
  updatePickups(world, dt);
  updateParticles(dt);
  updateCamera(p, dt);

  world.enemies.compact();
  world.bolts.compact();
  world.rings.compact();
  world.beams.compact();
  world.enemyShots.compact();
  world.pickups.compact();

  if (!p.alive) world.over = true;
}

function updateWeapons(world, dt) {
  const p = world.player;
  const st = p.stats;
  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    const L = def.levels[Math.min(w.lv, def.levels.length) - 1];
    const dmg = L.dmg * st.dmgMul;
    const area = st.areaMul;

    if (def.continuous) {
      def.sustain(world, w, L, dmg, dt, area);
      continue;
    }
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer += L.cd * st.cdMul;
      if (w.timer < 0) w.timer = L.cd * st.cdMul;
      def.fire(world, w, L, dmg, area);
    }
  }
}

// 충돌 조회 콜백은 모듈 스코프에 고정한다.
// 인라인 화살표 함수로 두면 적·투사체마다 클로저가 새로 생겨(초당 만 개 단위)
// GC 가 주기적으로 프레임을 갉아먹는다. 컨텍스트는 모듈 변수로 넘긴다.
let _sepSelf = null, _sepX = 0, _sepY = 0, _sepN = 0;

function _separationCb(o) {
  const e = _sepSelf;
  if (o === e || !o.alive) return;
  const dx = e.x - o.x, dy = e.y - o.y;
  const d2 = dx * dx + dy * dy;
  const min = (e.r + o.r) * 0.9;
  if (d2 > 0.01 && d2 < min * min) {
    const d = Math.sqrt(d2);
    _sepX += dx / d; _sepY += dy / d; _sepN++;
  }
}

let _hitWorld = null, _hitBolt = null, _hitDone = false;

function _boltHitCb(e) {
  if (_hitDone || !e.alive) return;
  const b = _hitBolt;
  if (!hits(b.x, b.y, b.r, e.x, e.y, e.r)) return;
  if (b.pierce && !_hitWorld.canHit(e, b.slot, b.hitCd)) return;
  const len = Math.hypot(b.vx, b.vy) || 1;
  _hitWorld.damageEnemy(e, b.dmg, (b.vx / len) * 90, (b.vy / len) * 90);
  flash(b.x, b.y, b.color, 10);
  _hitWorld.sfx('hit');
  if (!b.pierce) { b.alive = false; _hitDone = true; }
}

// 장판 판정. 인라인 클로저를 만들지 않으려고 컨텍스트를 모듈 변수로 넘긴다.
let _fieldWorld = null, _fieldR = 0, _fieldDmg = 0, _fieldSlot = 0;
let _fieldColor = '', _fieldX = 0, _fieldY = 0;

function _fieldHitCb(e) {
  if (!e.alive) return;
  const d2 = dist2(_fieldX, _fieldY, e.x, e.y);
  const reach = _fieldR + e.r;
  if (d2 > reach * reach) return;
  _fieldWorld.damageEnemy(e, _fieldDmg, 0, 0);
  flash(e.x, e.y, _fieldColor, 12);
}

let _ringCur = null;

function _ringHitCb(e) {
  if (!e.alive) return;
  const r = _ringCur;
  const d2 = dist2(r.x, r.y, e.x, e.y);
  const outer = r.r + e.r;
  const inner = Math.max(0, r.r - e.r - 30);
  if (d2 > outer * outer || d2 < inner * inner) return;
  if (!_hitWorld.canHit(e, r.slot, 0.4)) return;
  const d = Math.sqrt(d2) || 1;
  const k = r.knock ? 340 : 60;
  _hitWorld.damageEnemy(e, r.dmg, ((e.x - r.x) / d) * k, ((e.y - r.y) / d) * k);
  flash(e.x, e.y, r.color, 12);
}

let _orbCur = null;

function _orbHitCb(e) {
  if (!e.alive) return;
  const o = _orbCur;
  if (!hits(o.x, o.y, o.r, e.x, e.y, e.r)) return;
  if (!_hitWorld.canHit(e, o.slot, 0.3)) return;
  const dx = e.x - o.x, dy = e.y - o.y;
  const d = Math.hypot(dx, dy) || 1;
  _hitWorld.damageEnemy(e, o.dmg, (dx / d) * 120, (dy / d) * 120);
  flash(o.x, o.y, o.color, 10);
}

/**
 * 보스 연출을 한 프레임 진행하고, 그동안 월드가 쓸 dt 를 돌려준다.
 *
 * 등장에는 dt 를 0 으로 줘서 완전히 멈추고, 처치에는 0.25 배로 늦춘다 —
 * 완전히 멈추면 이긴 게 아니라 게임이 멎은 것처럼 보인다.
 */
function stepCine(world, dt) {
  const c = world.cine;
  c.t += dt;
  const k = Math.min(1, c.t / c.dur);

  if (c.kind === 'in') {
    const b = world.boss;
    if (b) {
      b.spawnScale = k;
      // 사방에서 조각이 모여들며 몸을 이룬다
      if (world.t % 0.02 < dt) {
        const a = rnd() * Math.PI * 2;
        const r = 420 * (1 - k) + 60;
        zapLine(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, b.x, b.y, b.def.color);
      }
    }
    if (k >= 1) {
      if (b) { b.frozen = false; b.invuln = false; b.spawnScale = 1; }
      world.cine = null;
      world.runStats.bossStart = world.t;   // 여기서부터가 진짜 보스전이다
      world.showBanner('정화 개시');
      addShake(20);
      world.sfx('emp');
    }
    return 0;                      // 등장 동안 월드는 멈춘다
  }

  // 처치 — 고리가 퍼지고 파편이 튄다
  if (c.t % 0.18 < dt) {
    burst(c.x, c.y, c.color, 14, 420, 7);
    addShake(10);
  }
  if (k >= 1) {
    world.cine = null;
    world.victory = true;
    world.eventLock = false;
  }
  return dt * 0.25;                // 처치는 늦게 흐른다
}

function updateEnemies(world, dt) {
  const p = world.player;

  world.enemies.forEach(e => {
    e.flash = Math.max(0, e.flash - dt);
    if (e.frozen) return;          // 등장 연출 중인 보스는 움직이지도 때리지도 않는다
    e.rot += e.spin * dt;

    e.def.behavior(e, world, dt);

    // 넉백 감쇠
    if (e.kx || e.ky) {
      e.x += e.kx * dt;
      e.y += e.ky * dt;
      e.kx *= 1 - 8 * dt;
      e.ky *= 1 - 8 * dt;
      if (Math.abs(e.kx) < 1) e.kx = 0;
      if (Math.abs(e.ky) < 1) e.ky = 0;
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;

    // 완전히 겹치지 않도록 약한 분리력만 적용 (정식 충돌 해결이 아님)
    _sepSelf = e; _sepX = 0; _sepY = 0; _sepN = 0;
    world.grid.query(e.x, e.y, e.r * 2, _separationCb);
    if (_sepN > 0) {
      e.x += (_sepX / _sepN) * 30 * dt;
      e.y += (_sepY / _sepN) * 30 * dt;
    }

    // 플레이어 접촉 데미지
    if (p.alive && hits(e.x, e.y, e.r, p.x, p.y, p.r)) {
      damagePlayer(p, world, e.def.dmg * world.dmgScale);
    }

    // 너무 멀어진 적은 회수 (카메라에서 완전히 벗어난 경우)
    if (dist2(e.x, e.y, p.x, p.y) > 1600 * 1600 && !e.def.elite && !e.def.boss) {
      e.alive = false;
    }
  });
}

function updateBolts(world, dt) {
  _hitWorld = world;
  world.bolts.forEach(b => {
    b.life -= dt;
    if (b.life <= 0) { b.alive = false; return; }
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    _hitBolt = b;
    _hitDone = false;
    world.grid.query(b.x, b.y, b.r + 30, _boltHitCb);
  });
}

function updateRings(world, dt) {
  _hitWorld = world;
  world.rings.forEach(r => {
    r.life -= dt;
    if (r.life <= 0) { r.alive = false; return; }
    const t = 1 - r.life / r.maxLife;
    r.r = 8 + (r.maxR - 8) * Math.sqrt(t);

    _ringCur = r;
    world.grid.query(r.x, r.y, r.r + 30, _ringHitCb);
  });
}

function updateBeams(world, dt) {
  const p = world.player;
  world.beams.forEach(b => {
    b.life -= dt;
    if (b.life <= 0) { b.alive = false; return; }
    b.angle += b.spin * dt;

    // 플레이어를 지나는 무한 직선. 점-직선 거리로 판정한다.
    const ca = Math.cos(b.angle), sa = Math.sin(b.angle);
    world.enemies.forEach(e => {
      const dx = e.x - p.x, dy = e.y - p.y;
      const perp = Math.abs(-sa * dx + ca * dy);
      if (perp > e.r + (b.width || 7)) return;
      if (dist2(e.x, e.y, p.x, p.y) > 1000 * 1000) return;
      if (!world.canHit(e, b.slot, 0.25)) return;
      world.damageEnemy(e, b.dmg, 0, 0);
      flash(e.x, e.y, b.color, 14);
    });
  });
}

function updateOrbitals(world, dt) {
  _hitWorld = world;
  world.forEachOrbital(o => {
    _orbCur = o;
    world.grid.query(o.x, o.y, o.r + 30, _orbHitCb);
  });
}

function updateEnemyShots(world, dt) {
  const p = world.player;
  world.enemyShots.forEach(s => {
    s.life -= dt;
    if (s.life <= 0) { s.alive = false; return; }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (p.alive && hits(s.x, s.y, s.r, p.x, p.y, p.r)) {
      damagePlayer(p, world, s.dmg);
      s.alive = false;
    }
  });
}

function updatePickups(world, dt) {
  const p = world.player;
  const magnet = p.stats.magnet;

  world.pickups.forEach(k => {
    k.age += dt;
    if (k.age < 0.35) {
      // 드랍 직후 짧게 튀어나온다
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.vx *= 1 - 6 * dt;
      k.vy *= 1 - 6 * dt;
    }

    const d2 = dist2(k.x, k.y, p.x, p.y);

    // 주우러 갈 수 없는 거리이거나 오래 방치된 픽업은 회수한다.
    // 이게 없으면 후반에 픽업이 풀 상한까지 쌓여 렌더 비용을 통째로 잡아먹는다.
    if (!k.pulling && (d2 > 1100 * 1100 || k.age > 40)) { k.alive = false; return; }

    if (!k.pulling && d2 < magnet * magnet) k.pulling = true;

    if (k.pulling) {
      const d = Math.sqrt(d2) || 1;
      const speed = 240 + (1 - Math.min(d / 300, 1)) * 500;
      k.x += ((p.x - k.x) / d) * speed * dt;
      k.y += ((p.y - k.y) / d) * speed * dt;
    }

    if (d2 < (p.r + k.r + 6) * (p.r + k.r + 6)) {
      k.alive = false;
      collect(world, k);
    }
  });
}

function collect(world, k) {
  const p = world.player;
  if (k.kind === 'heal') {
    p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.3);
    world.sfx('heal');
    flash(p.x, p.y, C.mint, 30);
    return;
  }
  if (k.kind === 'emp') {
    world.empBlast(300);
    return;
  }
  if (k.kind === 'magnet') {
    world.pickups.forEach(o => { o.pulling = true; });
    world.sfx('pickup');
    return;
  }
  world.sfx('pickup');
  world.pendingLevelUps += gainXp(p, k.value * p.stats.xpMul);
}
