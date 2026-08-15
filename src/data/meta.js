// 영구 업그레이드 테이블. 코드 조각으로 구매한다.

export const META = {
  core: {
    id: 'core', name: '강화 코어', max: 5,
    costs: [100, 200, 400, 800, 1600],
    desc: lv => `전체 데미지 +${lv * 4}%`,
  },
  memory: {
    id: 'memory', name: '확장 메모리', max: 5,
    costs: [80, 160, 320, 640, 1280],
    desc: lv => `최대 체력 +${lv * 10}`,
  },
  fan: {
    id: 'fan', name: '냉각 팬', max: 3,
    costs: [150, 400, 900],
    desc: lv => `이동 속도 +${lv * 4}%`,
  },
  prefetch: {
    id: 'prefetch', name: '프리페치', max: 3,
    costs: [120, 300, 700],
    desc: lv => `시작 레벨 +${lv}`,
  },
  backup: {
    id: 'backup', name: '백업 스냅샷', max: 1,
    costs: [2000],
    desc: lv => `런당 ${lv}회 부활 (체력 50%)`,
  },
};

export const META_IDS = ['core', 'memory', 'fan', 'prefetch', 'backup'];

/** 런 결과로 얻는 코드 조각 */
export function fragmentsEarned(kills, seconds, cleared, bonus) {
  return Math.floor(kills * 1 + seconds * 0.5 + (cleared ? 500 : 0) + bonus);
}
