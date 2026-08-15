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
    id: 'first_run', name: '첫 접속', desc: '한 판을 끝까지 플레이한다',
    check: () => true,
  },
  {
    id: 'first_clear', name: '정화 완료', desc: '커널 바이러스를 처치한다',
    check: c => c.victory,
  },
  {
    id: 'swarm', name: '대청소', desc: '한 판에 2,000마리를 처치한다',
    check: c => c.kills >= 2000,
  },
  {
    id: 'deep_dive', name: '심층 침투', desc: '레벨 25에 도달한다',
    check: c => c.level >= 25,
  },
  {
    id: 'evolved', name: '진화의 끝', desc: '진화 무기를 2종 이상 보유한 채 클리어한다',
    check: c => c.victory && c.evolvedCount >= 2,
  },
  {
    id: 'solo_weapon', name: '한 자루로 충분해', desc: '무기 하나만 들고 클리어한다',
    check: c => c.victory && c.weapons.length === 1,
  },
  {
    id: 'pure_pulse', name: '파동만으로', desc: '충격 파동 계열만 들고 클리어한다',
    check: c => c.victory && c.weapons.every(w => w.id === 'pulse' || w.id === 'supernova'),
  },
  {
    id: 'no_passive', name: '맨몸', desc: '강화를 하나도 고르지 않고 클리어한다',
    check: c => c.victory && Object.keys(c.passives).length === 0,
  },
  {
    id: 'untouched', name: '무결점', desc: '한 번도 맞지 않고 5분을 버틴다',
    check: c => c.hitsTaken === 0 && c.time >= 300,
  },
  {
    id: 'speedrun', name: '속전속결', desc: '9분 안에 클리어한다',
    check: c => c.victory && c.time <= 540,
  },
  {
    id: 'phoenix', name: '재기동', desc: '부활한 뒤 그 판을 클리어한다',
    check: c => c.victory && c.revived,
  },
  {
    id: 'arsenal', name: '무기고', desc: '무기 4종을 모두 만렙으로 만든다',
    check: c => c.weapons.length === 4 &&
                c.weapons.every(w => w.lv >= 5 || WEAPONS[w.id].evolved),
  },
];

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

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
