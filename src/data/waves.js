// 10분 타임라인.
// spawn 값 = 초당 스폰 마리 수. 스포너가 타입별 누산기를 굴려 >=1 이 될 때 스폰한다.
//
// 설계 의도:
//  - 첫 20초는 의도적으로 한산하다. 시작 무기 하나로 감당할 수 있어야 한다.
//  - 중반부터 스폰율이 플레이어 성장보다 살짝 빠르게 올라간다.
//  - 후반은 "쏟아진다"가 목표다. 이전 곡선은 플레이어 DPS를 못 따라가 화면이 비었다.

export const TIMELINE = [
  { t:   0, spawn: { worm: 0.45 },                                                     cap:  30 },
  { t:  20, spawn: { worm: 0.75 },                                                     cap:  45 },
  { t:  50, spawn: { worm: 0.85, spam: 0.75 },                                         cap:  65 },
  { t: 100, spawn: { worm: 0.95, spam: 1.10, tank: 0.20 },                             cap:  85 },
  { t: 180, event: 'elite_demon' },
  { t: 205, spawn: { worm: 1.05, spam: 1.45, tank: 0.30, splitter: 0.45 },             cap: 115 },
  { t: 260, spawn: { worm: 1.15, spam: 1.75, tank: 0.38, splitter: 0.55, sentry: 0.30 }, cap: 145 },
  { t: 330, spawn: { worm: 1.30, spam: 2.20, tank: 0.50, splitter: 0.70, sentry: 0.38, reaper: 0.28 }, cap: 175 },
  { t: 380, event: 'elite_zombie' },
  { t: 405, spawn: { worm: 1.55, spam: 2.90, tank: 0.68, splitter: 0.95, sentry: 0.50, reaper: 0.45 }, cap: 215 },
  { t: 480, spawn: { worm: 2.40, spam: 4.80, tank: 1.30, splitter: 1.60, sentry: 0.75, reaper: 0.85 }, cap: 260, frenzy: true },
  { t: 580, spawn: {},                                                                 cap: 260 },   // 정리 유예
  { t: 600, event: 'boss' },
];

/** 시각 t(초)에 적용되는 타임라인 엔트리. */
export function entryAt(t) {
  let cur = TIMELINE[0];
  for (const e of TIMELINE) {
    if (e.t <= t && e.spawn) cur = e;
  }
  return cur;
}

/**
 * 경과 시간에 따른 적 능력치 배율 (1분마다 누적).
 * 10분 기준 HP 6.2배 / 데미지 2.0배. 플레이어 성장이 훨씬 가파르므로
 * 이 정도는 되어야 후반 적이 "벽"으로 느껴진다.
 */
export function hpScale(t) {
  return Math.pow(1.20, t / 60);
}

export function dmgScale(t) {
  return Math.pow(1.07, t / 60);
}
