// 업적 테이블.
//
// check(ctx) 는 런이 끝날 때 한 번 호출된다. ctx 는 그 판의 요약이며,
// game/world.js 의 runStats 와 최종 빌드로 구성한다.
//
// 설계 원칙:
//  - 조건을 이름과 설명만 보고 알 수 있어야 한다. "운이 좋으면 열리는" 업적은 넣지 않는다.
//  - 절반은 그냥 플레이하다 열리고, 절반은 일부러 노려야 열린다.

import { WEAPONS } from './weapons.js';

/** @typedef {{
 *   victory: boolean, time: number, kills: number, level: number,
 *   weapons: {id:string, lv:number}[], passives: Record<string, number>,
 *   hitsTaken: number, revived: boolean, evolvedCount: number
 * }} RunContext */

export const ACHIEVEMENTS = [
  {
    id: 'first_run', name: '첫 접속', desc: '한 판을 끝까지 플레이한다', reward: 150,
    check: () => true,
  },
  {
    id: 'first_clear', name: '정화 완료', desc: '커널 바이러스를 처치한다', reward: 600,
    check: c => c.victory,
  },
  {
    id: 'swarm', name: '대청소', desc: '한 판에 2,000마리를 처치한다', reward: 400,
    check: c => c.kills >= 2000,
  },
  {
    id: 'deep_dive', name: '심층 침투', desc: '레벨 25에 도달한다', reward: 300,
    check: c => c.level >= 25,
  },
  {
    id: 'evolved', name: '진화의 끝', desc: '진화 무기를 2종 이상 보유한 채 클리어한다', reward: 700,
    check: c => c.victory && c.evolvedCount >= 2,
  },
  {
    id: 'solo_weapon', name: '한 자루로 충분해', desc: '무기 하나만 들고 클리어한다', reward: 1200,
    check: c => c.victory && c.weapons.length === 1,
  },
  {
    id: 'pure_pulse', name: '파동만으로', desc: '충격 파동 계열만 들고 클리어한다', reward: 1500,
    check: c => c.victory && c.weapons.every(w => w.id === 'pulse' || w.id === 'supernova'),
  },
  {
    id: 'no_passive', name: '맨몸', desc: '강화를 하나도 고르지 않고 클리어한다', reward: 1500,
    check: c => c.victory && Object.keys(c.passives).length === 0,
  },
  {
    id: 'untouched', name: '무결점', desc: '한 번도 맞지 않고 5분을 버틴다', reward: 800,
    check: c => c.hitsTaken === 0 && c.time >= 300,
  },
  {
    /*
     * '9분 안에 클리어'는 달성 자체가 불가능했다.
     * 보스는 10분(600초)에 등장하므로 승리 시각이 600초보다 이를 수가 없다.
     * 조건을 "보스전 자체를 얼마나 빨리 끝냈는가"로 바꾼다 —
     * 원래 의도했던 '속전속결'에 오히려 더 맞는다.
     */
    id: 'speedrun', name: '속전속결', desc: '보스를 30초 안에 처치한다', reward: 1000,
    check: c => c.victory && c.bossTime > 0 && c.bossTime <= 30,
  },
  {
    id: 'phoenix', name: '재기동', desc: '부활한 뒤 그 판을 클리어한다', reward: 600,
    check: c => c.victory && c.revived,
  },
  {
    id: 'arsenal', name: '무기고', desc: '무기 4종을 모두 만렙으로 만든다', reward: 900,
    // 무기 슬롯 메타를 사면 최대치가 5가 된다. 개수를 못박지 않고 "꽉 채웠는가"로 본다
    check: c => c.weapons.length >= 4 &&
                c.weapons.length >= (c.maxWeapons || 4) &&
                c.weapons.every(w => w.lv >= 5 || WEAPONS[w.id].evolved),
  },
];

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

/**
 * 업적 보상 합계 — 전부 달성하면 이만큼.
 * 영구 업그레이드 총액(약 70,000)의 14% 남짓이다. 초반을 밀어주되
 * 업적만으로 다 사지는 못하게 하는 선.
 */
export function totalAchievementReward() {
  return ACHIEVEMENTS.reduce((s, a) => s + (a.reward || 0), 0);
}

/** 방금 달성한 업적들이 주는 조각 합계. */
export function rewardFor(ids) {
  return ids.reduce((s, id) => {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    return s + (a && a.reward ? a.reward : 0);
  }, 0);
}

/**
 * 이번 판에서 새로 달성한 업적 id 목록.
 * @param {RunContext} ctx
 * @param {string[]} already 이미 달성한 id 목록
 */
export function evaluateAchievements(ctx, already) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (already.includes(a.id)) continue;
    let ok = false;
    try { ok = a.check(ctx); } catch { ok = false; }
    if (ok) out.push(a.id);
  }
  return out;
}
