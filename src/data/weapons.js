// 무기 테이블.
// fire()는 "월드에 무엇을 스폰할지"만 정한다. 쿨다운·데미지 배율 적용은 공통 처리.
// continuous 무기는 fire 대신 sustain(dt)로 매 프레임 갱신된다.
//
// fire/sustain 의 마지막 인자 area 는 출력 증폭이 주는 범위 배율이다.
// 반경·사거리·굵기처럼 "닿는 넓이"에만 곱하고, 개수나 속도에는 곱하지 않는다.

import { C } from '../config.js';

/** 조각마다 속도를 조금씩 흔든다. 프레임마다 바뀌면 안 되므로 인덱스 기반. */
function rnd01(i) {
  return ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
}

export const WEAPONS = {
  pulse: {
    id: 'pulse', name: '충격 파동', color: C.cyan, icon: 'ring',
    blurb: '사방으로 퍼지는 파동. 붙은 적을 쓸어낸다',
    evolveWith: 'amp', evolveTo: 'supernova',
    // 시작 무기. Lv1 DPS 가 웜을 2방에 잡을 만큼은 되어야 초반이 성립한다.
    levels: [
      { dmg: 12, radius: 105, cd: 1.15 },
      { dmg: 15, radius: 115, cd: 1.05 },
      { dmg: 18, radius: 128, cd: 0.98 },
      { dmg: 21, radius: 145, cd: 0.92 },
      { dmg: 25, radius: 165, cd: 0.85 },
    ],
    desc: L => `데미지 ${L.dmg} · 반경 ${L.radius}`,
    fire(world, w, L, dmg, area = 1) {
      world.spawnRing(world.player.x, world.player.y, dmg, L.radius * area, w.slot, C.cyan);
      world.sfx('pulse');
    },
  },

  tracer: {
    id: 'tracer', name: '추적탄', color: '#7dff9e', icon: 'bolt',
    blurb: '가장 가까운 적을 자동으로 조준한다',
    evolveWith: 'clock', evolveTo: 'railgun',
    levels: [
      { dmg: 12, count: 1, cd: 0.80, spd: 460 },
      { dmg: 15, count: 2, cd: 0.70, spd: 480 },
      { dmg: 17, count: 2, cd: 0.60, spd: 500 },
      { dmg: 20, count: 3, cd: 0.52, spd: 520 },
      { dmg: 22, count: 4, cd: 0.45, spd: 540 },
    ],
    desc: L => `데미지 ${L.dmg} · ${L.count}발`,
    fire(world, w, L, dmg, area = 1) {
      const p = world.player;
      const target = world.nearestEnemy(p.x, p.y, 900);
      let base;
      if (target) base = Math.atan2(target.y - p.y, target.x - p.x);
      else base = Math.atan2(p.faceY, p.faceX);

      for (let i = 0; i < L.count; i++) {
        // 여러 발은 약간씩 벌려 쏜다
        const off = (i - (L.count - 1) / 2) * 0.13;
        const a = base + off;
        world.spawnBolt(p.x, p.y, Math.cos(a) * L.spd, Math.sin(a) * L.spd,
          dmg, w.slot, { r: 5 * area, color: '#7dff9e', life: 1.6 });
      }
      world.sfx('shoot');
    },
  },

  orbit: {
    id: 'orbit', name: '궤도 노드', color: C.gold, icon: 'orbit',
    blurb: '바깥을 도는 방어선. 다가오는 것을 먼저 친다',
    continuous: true,
    evolveWith: 'over', evolveTo: 'ionbelt',
    /*
     * 반경이 70~95 였다. 충격 파동(105~165) 보다 **안쪽**이라 파동에 이미 죽은
     * 자리를 한 번 더 도는 꼴이었다 — 그래서 약하고 구분도 안 됐다.
     * 파동 바깥으로 빼서 역할을 갈랐다. 파동은 붙은 것을 쓸고,
     * 궤도는 다가오는 것을 미리 친다. 피해량도 같이 올렸다.
     */
    levels: [
      { dmg: 18, count: 2, radius: 175, spin: 3.2 },
      { dmg: 23, count: 3, radius: 190, spin: 3.4 },
      { dmg: 28, count: 4, radius: 205, spin: 3.6 },
      { dmg: 34, count: 5, radius: 218, spin: 3.8 },
      { dmg: 42, count: 6, radius: 232, spin: 4.0 },
    ],
    desc: L => `데미지 ${L.dmg} · ${L.count}개`,
    sustain(world, w, L, dmg, dt, area = 1) {
      // 점만 돌면 사이로 다 새어 들어온다. 노드를 이어 선으로 만든다
      world.syncOrbitals(w.slot, L.count, L.radius * area, dmg, L.spin, dt, C.gold, true);
    },
  },

  chain: {
    id: 'chain', name: '연쇄 방전', color: '#6bc8ff', icon: 'chain',
    blurb: '적에서 적으로 튀는 번개. 뭉칠수록 강하다',
    evolveWith: 'cache', evolveTo: 'thunder',
    levels: [
      { dmg: 14, bounces: 2, cd: 1.60 },
      { dmg: 17, bounces: 3, cd: 1.45 },
      { dmg: 20, bounces: 4, cd: 1.30 },
      { dmg: 23, bounces: 5, cd: 1.15 },
      { dmg: 26, bounces: 6, cd: 1.00 },
    ],
    desc: L => `데미지 ${L.dmg} · ${L.bounces}회 연쇄`,
    fire(world, w, L, dmg, area = 1) {
      world.chainZap(dmg, L.bounces, w.slot, area);
    },
  },

  laser: {
    id: 'laser', name: '관통 빔', color: C.red, icon: 'laser',
    blurb: '화면을 가로지르며 천천히 회전한다',
    evolveWith: 'wall', evolveTo: 'grid',
    levels: [
      { dmg: 20, beams: 1, cd: 3.0, spin: 0.9, life: 1.6 },
      { dmg: 24, beams: 1, cd: 2.7, spin: 1.0, life: 1.8 },
      { dmg: 27, beams: 2, cd: 2.5, spin: 1.1, life: 1.8 },
      { dmg: 31, beams: 2, cd: 2.2, spin: 1.2, life: 2.0 },
      { dmg: 34, beams: 3, cd: 2.0, spin: 1.3, life: 2.0 },
    ],
    desc: L => `데미지 ${L.dmg} · ${L.beams}줄`,
    fire(world, w, L, dmg, area = 1) {
      const base = Math.random() * Math.PI;
      for (let i = 0; i < L.beams; i++) {
        world.spawnBeam(base + (i / L.beams) * Math.PI, L.spin, dmg, L.life, w.slot, C.red, 7 * area);
      }
      world.sfx('shoot');
    },
  },

  /*
   * 파편탄 — 부채꼴로 흩뿌린다.
   * 추적탄이 "한 놈을 정확히"라면 이쪽은 "앞쪽 전부를 대충". 조합의 결이 다르다.
   */
  shard: {
    id: 'shard', name: '파편탄', color: '#ff9ad5', icon: 'shard',
    blurb: '앞쪽으로 부채꼴로 흩뿌린다. 뭉친 무리에 강하다',
    evolveWith: 'clock', evolveTo: 'flechette',
    levels: [
      { dmg: 7,  count: 4, spread: 0.55, cd: 1.05, spd: 420 },
      { dmg: 8,  count: 5, spread: 0.60, cd: 0.95, spd: 440 },
      { dmg: 10, count: 6, spread: 0.68, cd: 0.88, spd: 460 },
      { dmg: 11, count: 8, spread: 0.76, cd: 0.80, spd: 480 },
      { dmg: 13, count: 10, spread: 0.85, cd: 0.72, spd: 500 },
    ],
    desc: L => `데미지 ${L.dmg} · ${L.count}조각`,
    fire(world, w, L, dmg, area = 1) {
      const p = world.player;
      const target = world.nearestEnemy(p.x, p.y, 700);
      const base = target ? Math.atan2(target.y - p.y, target.x - p.x)
                          : Math.atan2(p.faceY, p.faceX);
      for (let i = 0; i < L.count; i++) {
        const t = L.count === 1 ? 0 : (i / (L.count - 1) - 0.5) * 2;
        const a = base + t * L.spread;
        const spd = L.spd * (0.85 + rnd01(i) * 0.3);
        world.spawnBolt(p.x, p.y, Math.cos(a) * spd, Math.sin(a) * spd,
          dmg, w.slot, { r: 4 * area, color: '#ff9ad5', life: 0.85 });
      }
      world.sfx('shoot');
    },
  },

  /*
   * 기뢰 — 지나온 자리에 두고 온다.
   *
   * 감전 장판을 여기 있던 자리에서 들어냈다. 몸 주위 상시 피해라 충격 파동과
   * 역할이 겹치는데 반경은 더 짧아, 초반이든 후반이든 파동의 열화판이었다.
   * 설치형은 결이 완전히 다르다 — 쫓기며 흘리고 지나가면 뒤가 정리된다.
   */
  mine: {
    id: 'mine', name: '기뢰', color: '#ffb347', icon: 'mine',
    blurb: '지나온 자리에 두고 온다. 쫓기며 싸울수록 강하다',
    evolveWith: 'wall', evolveTo: 'minefield',
    levels: [
      { dmg: 30, radius: 78,  cd: 1.30, life: 7 },
      { dmg: 38, radius: 86,  cd: 1.15, life: 8 },
      { dmg: 46, radius: 95,  cd: 1.02, life: 9 },
      { dmg: 56, radius: 104, cd: 0.92, life: 10 },
      { dmg: 68, radius: 115, cd: 0.82, life: 11 },
    ],
    desc: L => `데미지 ${L.dmg} · 폭발 반경 ${L.radius}`,
    fire(world, w, L, dmg, area = 1) {
      const p = world.player;
      // 진행 방향 반대편에 떨군다 — 쫓아오는 쪽에 깔린다
      world.spawnMine(p.x - p.faceX * 26, p.y - p.faceY * 26,
        dmg, L.radius * area, L.life, w.slot, '#ffb347');
    },
  },

  // ── 진화형 ────────────────────────────────────────────────
  supernova: {
    id: 'supernova', name: '초신성', color: '#ffffff', icon: 'ring', evolved: true,
    blurb: '화면을 삼키는 파동. 적을 멀리 밀어낸다',
    levels: [{ dmg: 40, radius: 320, cd: 1.1 }],
    desc: L => `데미지 ${L.dmg} · 반경 ${L.radius} · 넉백`,
    fire(world, w, L, dmg, area = 1) {
      world.spawnRing(world.player.x, world.player.y, dmg, L.radius * area, w.slot, '#ffffff', true);
      world.shake(10);
      world.sfx('emp');
    },
  },

  railgun: {
    id: 'railgun', name: '레일건', color: '#c8ffd8', icon: 'bolt', evolved: true,
    blurb: '한 줄에 선 적을 전부 꿰뚫는다',
    levels: [{ dmg: 66, count: 3, cd: 0.5, spd: 900 }],
    desc: L => `데미지 ${L.dmg} · 관통 · ${L.count}발`,
    fire(world, w, L, dmg, area = 1) {
      const p = world.player;
      const target = world.nearestEnemy(p.x, p.y, 1200);
      const base = target ? Math.atan2(target.y - p.y, target.x - p.x)
                          : Math.atan2(p.faceY, p.faceX);
      for (let i = 0; i < L.count; i++) {
        const a = base + (i - (L.count - 1) / 2) * 0.1;
        world.spawnBolt(p.x, p.y, Math.cos(a) * L.spd, Math.sin(a) * L.spd,
          dmg, w.slot, { r: 7 * area, color: '#c8ffd8', life: 1.4, pierce: true, hitCd: 0.4 });
      }
      world.sfx('shoot');
    },
  },

  ionbelt: {
    id: 'ionbelt', name: '전류 결계', color: '#fff2a8', icon: 'orbit', evolved: true,
    blurb: '노드를 잇는 전류가 몸을 감싼다',
    continuous: true,
    levels: [{ dmg: 82, count: 8, radius: 205, spin: 4.6 }],
    desc: L => `데미지 ${L.dmg} · ${L.count}개 · 연결 전류`,
    sustain(world, w, L, dmg, dt, area = 1) {
      world.syncOrbitals(w.slot, L.count, L.radius * area, dmg, L.spin, dt, '#fff2a8', true);
    },
  },

  /*
   * 연쇄 방전과 관통 빔에는 진화가 없었다 — 5종 중 3종만 있었다.
   * 남은 강화(데이터 흡인·자가 복구)와 짝지어 채운다.
   */
  thunder: {
    id: 'thunder', name: '뇌우', color: '#b8e6ff', icon: 'chain', evolved: true,
    blurb: '한 번에 화면 절반을 훑는 번개',
    levels: [{ dmg: 44, bounces: 16, cd: 0.85 }],
    desc: L => `데미지 ${L.dmg} · ${L.bounces}회 연쇄 · 사거리 2배`,
    fire(world, w, L, dmg, area = 1) {
      // 진화 이름값을 하려면 튀는 거리도 같이 늘어야 한다
      world.chainZap(dmg, L.bounces, w.slot, area * 2, '#b8e6ff');
      world.shake(4);
      world.sfx('emp');
    },
  },

  flechette: {
    id: 'flechette', name: '관통 파편', color: '#ffd2ec', icon: 'shard', evolved: true,
    blurb: '부채꼴 전체가 적을 꿰뚫고 지나간다',
    levels: [{ dmg: 22, count: 14, spread: 1.0, cd: 0.6, spd: 620 }],
    desc: L => `데미지 ${L.dmg} · ${L.count}조각 · 관통`,
    fire(world, w, L, dmg, area = 1) {
      const p = world.player;
      const target = world.nearestEnemy(p.x, p.y, 900);
      const base = target ? Math.atan2(target.y - p.y, target.x - p.x)
                          : Math.atan2(p.faceY, p.faceX);
      for (let i = 0; i < L.count; i++) {
        const t = (i / (L.count - 1) - 0.5) * 2;
        const a = base + t * L.spread;
        world.spawnBolt(p.x, p.y, Math.cos(a) * L.spd, Math.sin(a) * L.spd,
          dmg, w.slot, { r: 5 * area, color: '#ffd2ec', life: 1.0, pierce: true, hitCd: 0.35 });
      }
      world.sfx('shoot');
    },
  },

  minefield: {
    id: 'minefield', name: '연쇄 기뢰', color: '#ffd98a', icon: 'mine', evolved: true,
    blurb: '한 발이 터지면 옆의 것도 같이 터진다',
    levels: [{ dmg: 120, radius: 190, cd: 0.55, life: 14 }],
    desc: L => `데미지 ${L.dmg} · 반경 ${L.radius} · 연쇄 폭발`,
    fire(world, w, L, dmg, area = 1) {
      const p = world.player;
      world.spawnMine(p.x - p.faceX * 26, p.y - p.faceY * 26,
        dmg, L.radius * area, L.life, w.slot, '#ffd98a', true);
    },
  },

  grid: {
    id: 'grid', name: '빔 격자', color: '#ff9a6b', icon: 'laser', evolved: true,
    blurb: '여섯 줄이 격자로 돌며 화면을 썬다',
    levels: [{ dmg: 52, beams: 6, cd: 2.2, spin: 1.8, life: 3.4 }],
    desc: L => `데미지 ${L.dmg} · ${L.beams}줄 · 굵고 오래간다`,
    fire(world, w, L, dmg, area = 1) {
      const base = Math.random() * Math.PI;
      for (let i = 0; i < L.beams; i++) {
        world.spawnBeam(base + (i / L.beams) * Math.PI, L.spin, dmg, L.life, w.slot,
          '#ff9a6b', 14 * area);
      }
      world.shake(5);
      world.sfx('shoot');
    },
  },
};

export const BASE_WEAPON_IDS = ['pulse', 'tracer', 'orbit', 'chain', 'laser', 'shard', 'mine'];
export const MAX_WEAPONS = 4;
