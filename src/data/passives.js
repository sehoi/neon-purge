// 패시브 테이블. 효과는 game/upgrade.js 의 스탯 재계산 파이프라인이 읽는다.
//
// 이름 규칙: 카드에 뜬 이름만 보고 "무엇이 좋아지는가"를 알 수 있어야 한다.
// 세계관(전산) 은 그 다음이다 — 분위기를 위해 기능을 흐리지 않는다.

import { C } from '../config.js';

export const PASSIVES = {
  amp: {
    id: 'amp', name: '출력 증폭', color: C.red, icon: 'amp',
    blurb: '모든 무기의 피해량이 오른다',
    /*
     * 0.08 이었는데 "체감이 안 된다"는 지적을 받고 재봤다.
     *
     * 평상시에는 킬 수가 전혀 늘지 않았다(강화 없음 447 / Lv5 471, 오차 범위).
     * 잡몹은 어차피 한 방에 죽어서 남는 피해가 전부 버려지기 때문이다.
     * 피해량이 실제로 병목인 보스전에서만 값을 했는데, 그마저 Lv5 에서
     * 처치 시간 37% 단축으로 클럭 가속(49%)보다 낮았다.
     *
     * 0.11 로 올렸다. Lv5 기준 +55%, 보스 처치 61% 단축.
     * 더 올려도(0.12~0.13) 67% 에서 멎는다 — 한 방에 죽는 구간이 겹쳐서다.
     * 잡몹에 아무 값도 못 하는 대신 단단한 적에게 확실한 값을 하는 자리로 뒀다.
     */
    per: 0.11,
    desc: lv => `피해량 +${Math.round(lv * 11)}%`,
  },
  clock: {
    id: 'clock', name: '클럭 가속', color: C.cyan, icon: 'clock',
    blurb: '모든 무기가 더 자주 발동한다',
    per: 0.06,
    desc: lv => `공격 속도 +${Math.round((1 / (1 - lv * 0.06) - 1) * 100)}%`,
  },
  wall: {
    id: 'wall', name: '자가 복구', color: C.mint, icon: 'shield',
    blurb: '최대 체력이 늘고 계속 회복한다',
    per: 15,
    desc: lv => `최대 체력 +${lv * 15} · 재생 ${(lv * 0.4).toFixed(1)}/s`,
  },
  cache: {
    id: 'cache', name: '데이터 흡인', color: C.lime, icon: 'magnet',
    blurb: '경험치를 더 멀리서 더 많이 끌어온다',
    per: 0.25,
    desc: lv => `흡인 범위 +${lv * 25}% · 경험치 +${lv * 5}%`,
  },
  over: {
    id: 'over', name: '기동 강화', color: C.violet, icon: 'boot',
    blurb: '더 빨리 움직이고 더 자주 대시한다',
    per: 0.06,
    desc: lv => `이동 속도 +${lv * 6}% · 대시 쿨다운 -${lv * 8}%`,
  },
};

export const PASSIVE_IDS = ['amp', 'clock', 'wall', 'cache', 'over'];
export const MAX_PASSIVES = 4;
export const MAX_LEVEL = 5;
