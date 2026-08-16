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
  const m = meta || {};
  const mv = id => m[id] || 0;
  const lv = id => p.passives[id] || 0;

  const dmgMul  = (1 + lv('amp') * PASSIVES.amp.per) * (1 + mv('core') * 0.04);
  /*
   * 출력 증폭은 범위도 같이 넓힌다.
   *
   * 피해량만 올리면 잡몹 구간에서 아무 값도 못 한다 — 어차피 한 방에 죽어서
   * 남는 피해가 전부 버려지기 때문이다(실측: 90초 처치 수 447 → 471, 오차 범위).
   * 범위가 같이 늘면 한 번에 더 많은 적을 닿게 해서, 과잉 처치 구간에서도
   * 값을 한다. 무엇보다 **눈에 보인다** — 체감이 안 되던 진짜 이유가 이것이다.
   */
  const areaMul = 1 + lv('amp') * PASSIVES.amp.area;
  const cdMul   = Math.max(0.35, 1 - lv('clock') * PASSIVES.clock.per);
  const maxHp   = PLAYER_BASE.maxHp + lv('wall') * PASSIVES.wall.per + mv('memory') * 10;
  const regen   = lv('wall') * 0.4;
  const magnet  = PLAYER_BASE.magnet * (1 + lv('cache') * PASSIVES.cache.per) * (1 + mv('magnet') * 0.15);
  const xpMul   = 1 + lv('cache') * 0.05 + mv('gain') * 0.05;
  const speed   = PLAYER_BASE.speed * (1 + lv('over') * PASSIVES.over.per) * (1 + mv('fan') * 0.04);
  const dashCd  = PLAYER_BASE.dashCd * (1 - lv('over') * 0.08);

  // 슬롯 상한은 메타가 늘린다. 카드 추첨과 무기 지급이 이 값을 본다
  p.maxWeapons = MAX_WEAPONS + mv('slot');
  p.maxPassives = MAX_PASSIVES + mv('mind');

  const prevMax = p.stats ? p.stats.maxHp : maxHp;
  p.stats = { dmgMul, areaMul, cdMul, maxHp, regen, magnet, xpMul, speed, dashCd };

  // 최대 체력이 늘어난 만큼 현재 체력도 같이 올려준다 (방화벽을 찍고 손해 보는 느낌 방지)
  if (maxHp > prevMax) p.hp += maxHp - prevMax;
  p.hp = Math.min(p.hp, maxHp);
}

export function giveWeapon(p, id) {
  if (p.weapons.length >= (p.maxWeapons || MAX_WEAPONS)) return;
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
 * 진화를 눈앞에 둔 무기가 요구하는 강화 목록.
 *
 * 강화 슬롯은 4칸인데 종류는 5개다. 다른 넷으로 채워버리면 필요한 강화를
 * 영영 못 뽑고, 그 무기는 진화 자체가 불가능해진다 — 실제로 관통 빔/기뢰가
 * 요구하는 '자가 복구'가 그렇게 막혔다(진화 우선 플레이에서도 500판 중 43판 실패).
 *
 * 만렙 무기가 요구하는 강화는 가중치를 크게 올려 앞에 세운다.
 */
function pendingEvolvePassives(p) {
  const out = [];
  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    if (!def.evolveWith || def.evolved) continue;
    // 만렙 직전부터 띄운다. 만렙이 된 뒤엔 이미 슬롯이 차 있을 수 있다
    if (w.lv < MAX_LEVEL - 1) continue;
    if ((p.passives[def.evolveWith] || 0) >= 1) continue;
    out.push({ id: def.evolveWith, weapon: def.name, to: def.evolveTo });
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
      // 띠가 이미 "진 화"라고 말한다. 여기서는 무엇이 무엇으로 바뀌는지를 쓴다
      line1: `${WEAPONS[ev.from].name} → ${def.name}`,
      line2: def.desc(def.levels[0]),
    });
  }

  for (const id of BASE_WEAPON_IDS) {
    const def = WEAPONS[id];
    const cur = weaponLevel(p, id);
    if (cur === 0) {
      if (p.weapons.length >= (p.maxWeapons || MAX_WEAPONS)) continue;
      pool.push({
        kind: 'weapon_new', id, weight: 10,
        name: def.name, color: def.color, icon: def.icon,
        line1: '신규 무기', line2: def.blurb,
      });
    } else if (cur < MAX_LEVEL) {
      // 만렙 직전이면 진화에 무엇이 필요한지 미리 알려준다.
      // 조건을 모르면 슬롯을 다 채운 뒤에야 막힌 걸 알게 된다.
      const hint = cur === MAX_LEVEL - 1 && def.evolveWith && !def.evolved
        ? `Lv.5 + ${PASSIVES[def.evolveWith].name} → ${WEAPONS[def.evolveTo].name}`
        : def.desc(def.levels[cur]);
      pool.push({
        kind: 'weapon_up', id, weight: 12,
        name: def.name, color: def.color, icon: def.icon,
        line1: `Lv.${cur} → ${cur + 1}`, line2: hint,
      });
    }
  }

  const pending = pendingEvolvePassives(p);
  for (const id of PASSIVE_IDS) {
    const def = PASSIVES[id];
    const cur = p.passives[id] || 0;
    const owned = Object.keys(p.passives).length;
    const need = pending.find(x => x.id === id);
    if (cur === 0) {
      /*
       * 진화에 필요한 강화만 슬롯 상한을 한 칸 넘길 수 있다.
       *
       * 상한은 빌드에 성격을 주려고 있는 것이지, 진화를 영영 막으려고 있는 게
       * 아니다. 슬롯 넷이 다른 강화로 차면 그 무기는 진화 자체가 불가능해지는데,
       * 플레이어는 막힌 줄도 모른 채 만렙만 찍고 기다리게 된다.
       */
      if (owned >= (p.maxPassives || MAX_PASSIVES) && !need) continue;
      const evo = need ? WEAPONS[need.to] : null;
      pool.push({
        kind: 'passive_new', id, weight: need ? 70 : 9,
        name: def.name, color: def.color, icon: def.icon,
        line1: evo ? `${need.weapon} → ${evo.name}` : '신규 강화',
        line2: def.blurb,
        // 이게 붙은 카드는 진화 카드와 같은 대접을 받는다 (screens.js 가 읽는다)
        evoReq: evo ? { name: evo.name, color: evo.color, icon: evo.icon } : null,
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
  if (pool.length === 0) return [consumable(0), consumable(1), consumable(2)];

  /*
   * ── 진화와 그 조건은 추첨에 맡기지 않는다 ──
   *
   * 가중치를 70까지 올려도 매 레벨업 79% 였다. 확률로 두면 플레이어는
   * "안 뜬 것"과 "못 본 것"을 구분할 수 없다 — 실제로 만렙 무기를 들고
   * 열 번 넘게 조건 카드를 지나친 판이 나왔다. 뜰 수 있으면 반드시 띄운다.
   */
  const picked = [];
  const rank = c => (c.kind === 'evolve' ? 2 : c.evoReq ? 1 : 0);
  pool.sort((a, b) => rank(b) - rank(a));
  while (picked.length < count && pool.length > 0 && rank(pool[0]) > 0) {
    picked.push(pool.shift());
  }

  const weights = pool.map(c => c.weight);
  for (let i = picked.length; i < count && pool.length > 0; i++) {
    const idx = weightedIndex(weights);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
    weights.splice(idx, 1);
  }

  // 후보가 3개 미만이면 소모품으로 채운다
  while (picked.length < count) picked.push(consumable(picked.length));

  /*
   * ── 무기를 강제로 받게 하지 않는다 ──
   *
   * 카드는 건너뛸 수 없다. 그래서 3장이 전부 "신규 무기"로 나오면 무기를 하나만
   * 들고 가려던 사람은 선택의 여지 없이 두 자루가 된다.
   *
   * 드물게 일어나는 사고가 아니었다. 파동만 고집하는 판을 3000번 돌려보니
   * **100% 가 평균 레벨 15.7 에서 강제로 무기를 받게 됐다.** 무기와 강화를
   * 다 올리고 나면 뽑을 게 신규 무기밖에 안 남기 때문이다.
   * 즉 '한 자루로 충분해' 업적은 달성 자체가 불가능했다.
   *
   * 이미 무기를 든 사람에게는 신규 무기가 아닌 선택지를 한 장은 보장한다.
   */
  if (p.weapons.length > 0 && picked.every(c => c.kind === 'weapon_new')) {
    picked[picked.length - 1] = consumable(0);
  }
  return picked;
}

/** 뽑을 게 없거나, 강제 선택을 막아야 할 때 끼워 넣는 즉시 발동 카드. */
function consumable(i) {
  const list = [
    { kind: 'heal', name: '긴급 복구', color: C.mint, icon: 'shield',
      line1: '즉시 발동', line2: '체력을 전부 회복한다' },
    { kind: 'frag', name: '코드 조각', color: C.gold, icon: 'amp',
      line1: '즉시 발동', line2: '영구 강화에 쓸 조각 +100' },
    { kind: 'nuke', name: '전역 퍼지', color: C.red, icon: 'ring',
      line1: '즉시 발동', line2: '화면 안의 모든 적에게 큰 피해' },
  ];
  return list[i % list.length];
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
