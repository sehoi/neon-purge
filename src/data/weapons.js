// 무기 테이블.
// fire()는 "월드에 무엇을 스폰할지"만 정한다. 쿨다운·데미지 배율 적용은 game/weapon.js 공통 처리.
// continuous 무기는 fire 대신 sustain(dt)로 매 프레임 갱신된다.

import { C } from '../config.js';

export const WEAPONS = {
  pulse: {
    id: 'pulse', name: '펄스 링', color: C.cyan, icon: 'ring',
    blurb: '주위로 퍼지는 충격파',
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
    fire(world, w, L, dmg) {
      world.spawnRing(world.player.x, world.player.y, dmg, L.radius, w.slot, C.cyan);
      world.sfx('pulse');
    },
  },

  tracer: {
    id: 'tracer', name: '트레이서', color: '#7dff9e', icon: 'bolt',
    blurb: '가장 가까운 적을 자동 조준',
    evolveWith: 'clock', evolveTo: 'railgun',
    levels: [
      { dmg: 12, count: 1, cd: 0.80, spd: 460 },
      { dmg: 15, count: 2, cd: 0.70, spd: 480 },
      { dmg: 17, count: 2, cd: 0.60, spd: 500 },
      { dmg: 20, count: 3, cd: 0.52, spd: 520 },
      { dmg: 22, count: 4, cd: 0.45, spd: 540 },
    ],
    desc: L => `데미지 ${L.dmg} · ${L.count}발`,
    fire(world, w, L, dmg) {
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
          dmg, w.slot, { r: 5, color: '#7dff9e', life: 1.6 });
      }
      world.sfx('shoot');
    },
  },

  orbit: {
    id: 'orbit', name: '오빗 노드', color: C.gold, icon: 'orbit',
    blurb: '주위를 도는 궤도 오브',
    continuous: true,
    evolveWith: 'over', evolveTo: 'ionbelt',
    levels: [
      { dmg: 10, count: 1, radius: 70, spin: 2.4 },
      { dmg: 13, count: 2, radius: 76, spin: 2.6 },
      { dmg: 15, count: 3, radius: 84, spin: 2.8 },
      { dmg: 18, count: 3, radius: 90, spin: 3.1 },
      { dmg: 20, count: 4, radius: 95, spin: 3.4 },
    ],
    desc: L => `데미지 ${L.dmg} · ${L.count}개`,
    sustain(world, w, L, dmg, dt) {
      world.syncOrbitals(w.slot, L.count, L.radius, dmg, L.spin, dt, C.gold, false);
    },
  },

  chain: {
    id: 'chain', name: '체인 아크', color: '#6bc8ff', icon: 'chain',
    blurb: '적 사이를 튀는 번개',
    levels: [
      { dmg: 14, bounces: 2, cd: 1.60 },
      { dmg: 17, bounces: 3, cd: 1.45 },
      { dmg: 20, bounces: 4, cd: 1.30 },
      { dmg: 23, bounces: 5, cd: 1.15 },
      { dmg: 26, bounces: 6, cd: 1.00 },
    ],
    desc: L => `데미지 ${L.dmg} · ${L.bounces}회 연쇄`,
    fire(world, w, L, dmg) {
      world.chainZap(dmg, L.bounces, w.slot);
    },
  },

  laser: {
    id: 'laser', name: '레이저 스윕', color: C.red, icon: 'laser',
    blurb: '화면을 가로지르는 회전 빔',
    levels: [
      { dmg: 20, beams: 1, cd: 3.0, spin: 0.9, life: 1.6 },
      { dmg: 24, beams: 1, cd: 2.7, spin: 1.0, life: 1.8 },
      { dmg: 27, beams: 2, cd: 2.5, spin: 1.1, life: 1.8 },
      { dmg: 31, beams: 2, cd: 2.2, spin: 1.2, life: 2.0 },
      { dmg: 34, beams: 3, cd: 2.0, spin: 1.3, life: 2.0 },
    ],
    desc: L => `데미지 ${L.dmg} · ${L.beams}줄`,
    fire(world, w, L, dmg) {
      const base = Math.random() * Math.PI;
      for (let i = 0; i < L.beams; i++) {
        world.spawnBeam(base + (i / L.beams) * Math.PI, L.spin, dmg, L.life, w.slot, C.red);
      }
      world.sfx('shoot');
    },
  },

  // ── 진화형 ────────────────────────────────────────────────
  supernova: {
    id: 'supernova', name: '슈퍼노바', color: '#ffffff', icon: 'ring', evolved: true,
    blurb: '거대 충격파 + 넉백',
    levels: [{ dmg: 40, radius: 320, cd: 1.1 }],
    desc: L => `데미지 ${L.dmg} · 반경 ${L.radius} · 넉백`,
    fire(world, w, L, dmg) {
      world.spawnRing(world.player.x, world.player.y, dmg, L.radius, w.slot, '#ffffff', true);
      world.shake(10);
      world.sfx('emp');
    },
  },

  railgun: {
    id: 'railgun', name: '레일건', color: '#c8ffd8', icon: 'bolt', evolved: true,
    blurb: '관통하는 초고속 탄',
    levels: [{ dmg: 66, count: 3, cd: 0.5, spd: 900 }],
    desc: L => `데미지 ${L.dmg} · 관통 · ${L.count}발`,
    fire(world, w, L, dmg) {
      const p = world.player;
      const target = world.nearestEnemy(p.x, p.y, 1200);
      const base = target ? Math.atan2(target.y - p.y, target.x - p.x)
                          : Math.atan2(p.faceY, p.faceX);
      for (let i = 0; i < L.count; i++) {
        const a = base + (i - (L.count - 1) / 2) * 0.1;
        world.spawnBolt(p.x, p.y, Math.cos(a) * L.spd, Math.sin(a) * L.spd,
          dmg, w.slot, { r: 7, color: '#c8ffd8', life: 1.4, pierce: true, hitCd: 0.4 });
      }
      world.sfx('shoot');
    },
  },

  ionbelt: {
    id: 'ionbelt', name: '이온 벨트', color: '#fff2a8', icon: 'orbit', evolved: true,
    blurb: '오브 사이를 전류가 연결',
    continuous: true,
    levels: [{ dmg: 34, count: 5, radius: 110, spin: 4.2 }],
    desc: L => `데미지 ${L.dmg} · ${L.count}개 · 연결 전류`,
    sustain(world, w, L, dmg, dt) {
      world.syncOrbitals(w.slot, L.count, L.radius, dmg, L.spin, dt, '#fff2a8', true);
    },
  },
};

export const BASE_WEAPON_IDS = ['pulse', 'tracer', 'orbit', 'chain', 'laser'];
export const MAX_WEAPONS = 4;
