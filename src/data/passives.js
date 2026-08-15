// 패시브 테이블. 효과는 game/upgrade.js 의 스탯 재계산 파이프라인이 읽는다.

import { C } from '../config.js';

export const PASSIVES = {
  amp: {
    id: 'amp', name: '앰프', color: C.red, icon: 'amp',
    blurb: '전체 데미지 증가',
    per: 0.08,
    desc: lv => `데미지 +${lv * 8}%`,
  },
  clock: {
    id: 'clock', name: '클럭 부스트', color: C.cyan, icon: 'clock',
    blurb: '공격 주기 단축',
    per: 0.06,
    desc: lv => `공격 속도 +${Math.round((1 / (1 - lv * 0.06) - 1) * 100)}%`,
  },
  wall: {
    id: 'wall', name: '방화벽', color: C.mint, icon: 'shield',
    blurb: '최대 체력 + 재생',
    per: 15,
    desc: lv => `최대 체력 +${lv * 15} · 재생 ${(lv * 0.4).toFixed(1)}/s`,
  },
  cache: {
    id: 'cache', name: '캐시', color: C.lime, icon: 'magnet',
    blurb: '픽업 범위 + 경험치',
    per: 0.25,
    desc: lv => `자석 범위 +${lv * 25}% · 경험치 +${lv * 5}%`,
  },
  over: {
    id: 'over', name: '오버드라이브', color: C.violet, icon: 'boot',
    blurb: '이동 속도 + 대시 쿨감',
    per: 0.06,
    desc: lv => `이동 속도 +${lv * 6}% · 대시 쿨다운 -${lv * 8}%`,
  },
};

export const PASSIVE_IDS = ['amp', 'clock', 'wall', 'cache', 'over'];
export const MAX_PASSIVES = 4;
export const MAX_LEVEL = 5;
