// 영구 업그레이드 테이블. 코드 조각으로 구매한다.
//
// 이름 규칙은 무기·강화와 같다 — 이름만 보고 무엇이 좋아지는지 알 수 있어야 한다.
// 초기 이름(냉각 팬, 프리페치, 백업 스냅샷)은 전산 용어 은유가 너무 멀어서
// 무엇을 사는 건지 알 수 없었다.
//
// ── 경제 ──
// 처음엔 다섯 항목 합계가 10,150 조각이었는데 클리어 한 판에 2,800 을 벌었다.
// **3.6판이면 전부 사고 그 뒤로는 조각이 그냥 쌓였다.**
// 기존 항목의 상한을 올리고 항목을 넷 더 붙여 장기 목표를 만들었다.
// 후반 단계는 값이 가파르게 오른다 — 마지막 한 칸이 몇 판치가 되도록.

export const META = {
  core: {
    id: 'core', name: '코어 출력', max: 8,
    costs: [100, 200, 400, 800, 1600, 3000, 5200, 8600],
    desc: lv => `모든 무기 피해량 +${lv * 4}%`,
  },
  memory: {
    id: 'memory', name: '내구 강화', max: 8,
    costs: [80, 160, 320, 640, 1280, 2400, 4200, 7000],
    desc: lv => `시작 최대 체력 +${lv * 10}`,
  },
  fan: {
    id: 'fan', name: '추진 강화', max: 5,
    costs: [150, 400, 900, 1900, 3800],
    desc: lv => `이동 속도 +${lv * 4}%`,
  },
  prefetch: {
    id: 'prefetch', name: '선행 강화', max: 4,
    costs: [120, 300, 700, 1600],
    desc: lv => `시작 레벨 +${lv} · 시작 시 강화를 ${lv}개 고른다`,
  },
  magnet: {
    id: 'magnet', name: '흡인 강화', max: 4,
    costs: [150, 380, 900, 2000],
    desc: lv => `시작 흡인 범위 +${lv * 15}%`,
  },
  gain: {
    id: 'gain', name: '학습 가속', max: 4,
    costs: [220, 550, 1300, 2800],
    desc: lv => `경험치 획득 +${lv * 5}%`,
  },
  slot: {
    id: 'slot', name: '무기 슬롯', max: 1,
    costs: [4200],
    desc: () => '무기를 하나 더 들 수 있다 (4 → 5)',
  },
  mind: {
    id: 'mind', name: '강화 슬롯', max: 1,
    costs: [3600],
    desc: () => '강화를 하나 더 들 수 있다 (4 → 5)',
  },
  backup: {
    id: 'backup', name: '긴급 재부팅', max: 2,
    costs: [2000, 6000],
    desc: lv => `쓰러져도 ${lv}회 부활 (체력 50%)`,
  },
};

export const META_IDS = [
  'core', 'memory', 'fan', 'prefetch', 'magnet', 'gain', 'slot', 'mind', 'backup',
];

/** 전부 사는 데 드는 조각 — 경제를 볼 때 쓴다. */
export function totalMetaCost() {
  return META_IDS.reduce((s, id) => s + META[id].costs.reduce((a, b) => a + b, 0), 0);
}

/** 런 결과로 얻는 코드 조각 */
export function fragmentsEarned(kills, seconds, cleared, bonus) {
  return Math.floor(kills * 1 + seconds * 0.5 + (cleared ? 500 : 0) + bonus);
}
