// 10분 타임라인.
// spawn 값 = 초당 스폰 마리 수. 스포너가 타입별 누산기를 굴려 >=1 이 될 때 스폰한다.
//
// 설계 의도:
//  - 첫 15초만 한산하다. 그 뒤로는 바로 붙는다.
//    예전 곡선은 2분간 화면 안 적이 평균 6마리라 찾아다녀야 했다.
//    초반 스폰율을 2배로 올려 평균 14마리로 맞췄다.
//    (2.7배도 재봤지만 20마리는 시작 무기 하나로 감당하기엔 과했다)
//  - 중반부터 스폰율이 플레이어 성장보다 살짝 빠르게 올라간다.
//  - 후반은 "쏟아진다"가 목표다. 이전 곡선은 플레이어 DPS를 못 따라가 화면이 비었다.

export const TIMELINE = [
  { t:   0, spawn: { worm: 0.90 },                                                     cap:  45 },
  { t:  15, spawn: { worm: 1.45 },                                                     cap:  60 },
  { t:  40, spawn: { worm: 1.65, spam: 1.10 },                                         cap:  80 },
  { t:  75, spawn: { worm: 1.90, spam: 1.55, tank: 0.26 },                             cap: 100 },
  { t: 130, spawn: { worm: 2.10, spam: 1.95, tank: 0.34 },                             cap: 115 },
  { t: 180, event: 'elite_demon' },
  { t: 205, spawn: { worm: 2.40, spam: 2.90, tank: 0.42, splitter: 0.60 },             cap: 130 },
  { t: 260, spawn: { worm: 2.50, spam: 3.20, tank: 0.50, splitter: 0.70, sentry: 0.34 }, cap: 155 },
  { t: 330, spawn: { worm: 2.60, spam: 3.60, tank: 0.62, splitter: 0.85, sentry: 0.42, reaper: 0.32 }, cap: 185 },
  { t: 380, event: 'elite_zombie' },
  { t: 405, spawn: { worm: 2.80, spam: 4.20, tank: 0.80, splitter: 1.10, sentry: 0.56, reaper: 0.50 }, cap: 225 },
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
