// 영구 업그레이드 테이블. 코드 조각으로 구매한다.
//
// 이름 규칙은 무기·강화와 같다 — 이름만 보고 무엇이 좋아지는지 알 수 있어야 한다.
// 초기 이름(냉각 팬, 프리페치, 백업 스냅샷)은 전산 용어 은유가 너무 멀어서
// 무엇을 사는 건지 알 수 없었다.

export const META = {
  core: {
    id: 'core', name: '코어 출력', max: 5,
    costs: [100, 200, 400, 800, 1600],
    desc: lv => `모든 무기 피해량 +${lv * 4}%`,
  },
  memory: {
    id: 'memory', name: '내구 강화', max: 5,
    costs: [80, 160, 320, 640, 1280],
    desc: lv => `시작 최대 체력 +${lv * 10}`,
  },
  fan: {
    id: 'fan', name: '추진 강화', max: 3,
    costs: [150, 400, 900],
    desc: lv => `이동 속도 +${lv * 4}%`,
  },
  prefetch: {
    id: 'prefetch', name: '선행 강화', max: 3,
    costs: [120, 300, 700],
    desc: lv => `시작 레벨 +${lv} · 시작 시 강화를 ${lv}개 고른다`,
  },
  backup: {
    id: 'backup', name: '긴급 재부팅', max: 1,
    costs: [2000],
    desc: lv => `쓰러져도 ${lv}회 부활 (체력 50%)`,
  },
};

export const META_IDS = ['core', 'memory', 'fan', 'prefetch', 'backup'];

/** 런 결과로 얻는 코드 조각 */
export function fragmentsEarned(kills, seconds, cleared, bonus) {
  return Math.floor(kills * 1 + seconds * 0.5 + (cleared ? 500 : 0) + bonus);
}
