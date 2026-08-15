// 스탯 재계산 파이프라인 + 레벨업 카드 추첨.

import { PLAYER_BASE, C } from '../config.js';
import { WEAPONS, BASE_WEAPON_IDS, MAX_WEAPONS } from '../data/weapons.js';
import { PASSIVES, PASSIVE_IDS, MAX_PASSIVES, MAX_LEVEL } from '../data/passives.js';
import { weightedIndex } from '../core/rng.js';

/**
 * base → 메타 영구 업그레이드 → 패시브 순으로 곱해 최종 스탯을 만든다.
 * 매 프레임이 아니라 변경 시에만 호출한다.
 */
export function recalcStats(p, meta) {
  const m = meta || { core: 0, memory: 0, fan: 0 };
  const lv = id => p.passives[id] || 0;

  const dmgMul  = (1 + lv('amp') * PASSIVES.amp.per) * (1 + m.core * 0.04);
  const cdMul   = Math.max(0.35, 1 - lv('clock') * PASSIVES.clock.per);
  const maxHp   = PLAYER_BASE.maxHp + lv('wall') * PASSIVES.wall.per + m.memory * 10;
  const regen   = lv('wall') * 0.4;
  const magnet  = PLAYER_BASE.magnet * (1 + lv('cache') * PASSIVES.cache.per);
  const xpMul   = 1 + lv('cache') * 0.05;
  const speed   = PLAYER_BASE.speed * (1 + lv('over') * PASSIVES.over.per) * (1 + m.fan * 0.04);
  const dashCd  = PLAYER_BASE.dashCd * (1 - lv('over') * 0.08);

  const prevMax = p.stats ? p.stats.maxHp : maxHp;
  p.stats = { dmgMul, cdMul, maxHp, regen, magnet, xpMul, speed, dashCd };

  // 최대 체력이 늘어난 만큼 현재 체력도 같이 올려준다 (방화벽을 찍고 손해 보는 느낌 방지)
  if (maxHp > prevMax) p.hp += maxHp - prevMax;
  p.hp = Math.min(p.hp, maxHp);
}

export function giveWeapon(p, id) {
  if (p.weapons.length >= MAX_WEAPONS) return;
  p.weapons.push({ id, lv: 1, slot: p.weapons.length, timer: 0 });
}

function weaponLevel(p, id) {
  const w = p.weapons.find(w => w.id === id);
  return w ? w.lv : 0;
}

function hasWeapon(p, id) {
  return p.weapons.some(w => w.id === id);
}

/** 진화 가능한 무기를 찾는다. (무기 Lv5 + 대응 패시브 보유) */
function evolvables(p) {
  const out = [];
  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    if (!def.evolveWith || def.evolved) continue;
    if (w.lv >= MAX_LEVEL && (p.passives[def.evolveWith] || 0) >= 1) {
      out.push({ from: w.id, to: def.evolveTo });
    }
  }
  return out;
}

/**
 * 카드 3장을 뽑는다. 중복 없음.
 * 진화 카드는 가중치 ×10 으로 거의 확정 등장시킨다.
 */
export function buildChoices(p, count = 3) {
  const pool = [];

  for (const ev of evolvables(p)) {
    const def = WEAPONS[ev.to];
    pool.push({
      kind: 'evolve', id: ev.to, from: ev.from, weight: 100,
      name: def.name, color: def.color, icon: def.icon,
      line1: '진화', line2: def.desc(def.levels[0]),
    });
  }

  for (const id of BASE_WEAPON_IDS) {
    const def = WEAPONS[id];
    const cur = weaponLevel(p, id);
    if (cur === 0) {
      if (p.weapons.length >= MAX_WEAPONS) continue;
      pool.push({
        kind: 'weapon_new', id, weight: 10,
        name: def.name, color: def.color, icon: def.icon,
        line1: '신규 무기', line2: def.blurb,
      });
    } else if (cur < MAX_LEVEL) {
      pool.push({
        kind: 'weapon_up', id, weight: 12,
        name: def.name, color: def.color, icon: def.icon,
        line1: `Lv.${cur} → ${cur + 1}`, line2: def.desc(def.levels[cur]),
      });
    }
  }

  for (const id of PASSIVE_IDS) {
    const def = PASSIVES[id];
    const cur = p.passives[id] || 0;
    const owned = Object.keys(p.passives).length;
    if (cur === 0) {
      if (owned >= MAX_PASSIVES) continue;
      pool.push({
        kind: 'passive_new', id, weight: 9,
        name: def.name, color: def.color, icon: def.icon,
        line1: '신규 강화', line2: def.blurb,
      });
    } else if (cur < MAX_LEVEL) {
      pool.push({
        kind: 'passive_up', id, weight: 11,
        name: def.name, color: def.color, icon: def.icon,
        line1: `Lv.${cur} → ${cur + 1}`, line2: def.desc(cur + 1),
      });
    }
  }

  // 뽑을 게 남지 않았을 때의 보험
  if (pool.length === 0) {
    return [
      { kind: 'heal', weight: 1, name: '긴급 복구', color: C.mint, icon: 'shield',
        line1: '즉시 발동', line2: '체력을 전부 회복한다' },
      { kind: 'frag', weight: 1, name: '코드 조각', color: C.gold, icon: 'amp',
        line1: '즉시 발동', line2: '영구 강화에 쓸 조각 +100' },
      { kind: 'nuke', weight: 1, name: '전역 퍼지', color: C.red, icon: 'ring',
        line1: '즉시 발동', line2: '화면 안의 모든 적에게 큰 피해' },
    ];
  }

  const picked = [];
  const weights = pool.map(c => c.weight);
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = weightedIndex(weights);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
    weights.splice(idx, 1);
  }

  // 후보가 3개 미만이면 소모품으로 채운다
  while (picked.length < count) {
    picked.push({ kind: 'heal', name: '긴급 복구', color: C.mint, icon: 'shield',
      line1: '즉시 발동', line2: '체력을 전부 회복한다' });
  }
  return picked;
}

export function applyChoice(p, world, c) {
  switch (c.kind) {
    case 'weapon_new':
      giveWeapon(p, c.id);
      break;
    case 'weapon_up': {
      const w = p.weapons.find(w => w.id === c.id);
      if (w) w.lv = Math.min(MAX_LEVEL, w.lv + 1);
      break;
    }
    case 'passive_new':
    case 'passive_up':
      p.passives[c.id] = Math.min(MAX_LEVEL, (p.passives[c.id] || 0) + 1);
      break;
    case 'evolve': {
      const w = p.weapons.find(w => w.id === c.from);
      if (w) { w.id = c.id; w.lv = 1; w.timer = 0; }
      world.clearOrbitals();     // 궤도 무기가 바뀌면 기존 오브를 버린다
      break;
    }
    case 'heal':
      p.hp = p.stats.maxHp;
      break;
    case 'frag':
      world.bonusFragments += 100;
      break;
    case 'nuke':
      world.empBlast(500);
      break;
  }
  recalcStats(p, world.meta);
}
