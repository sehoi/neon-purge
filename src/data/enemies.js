// 적 스탯 테이블.
// behavior(e, world, dt) 는 e.vx / e.vy 를 설정하는 것까지만 책임진다.
// 실제 이동·충돌은 game/enemy.js 가 공통 처리한다.

import { C } from '../config.js';

/** 플레이어를 향한 단위 벡터를 e._tx / e._ty 에 넣는다. */
function toPlayer(e, world) {
  const dx = world.player.x - e.x;
  const dy = world.player.y - e.y;
  const len = Math.hypot(dx, dy) || 1;
  e._tx = dx / len;
  e._ty = dy / len;
  e._tdist = len;
}

function chase(e, world) {
  toPlayer(e, world);
  e.vx = e._tx * e.speed;
  e.vy = e._ty * e.speed;
}

export const ENEMIES = {
  worm: {
    id: 'worm', name: '웜',
    hp: 15, speed: 80, dmg: 7, r: 14, xp: 1,
    shape: 'poly', sides: 3, color: C.magenta,
    behavior: chase,
  },

  spam: {
    id: 'spam', name: '스팸봇',
    // 빠르게 도는 작은 마름모. 정지한 정사각형(탱크)과 실루엣이 갈린다.
    hp: 9, speed: 150, dmg: 5, r: 9, xp: 1,
    shape: 'poly', sides: 4, color: '#ff6bb0', spin: 5.0,
    behavior: chase,
  },

  tank: {
    id: 'tank', name: '파이어월 샤드',
    // 회전하지 않는 축 정렬 정사각형 — 묵직해 보여야 한다.
    hp: 110, speed: 46, dmg: 14, r: 24, xp: 3,
    shape: 'poly', sides: 4, color: '#ff3b6e', noKnockback: true,
    spin: 0, rot0: Math.PI / 4,
    behavior: chase,
  },

  splitter: {
    id: 'splitter', name: '스플리터',
    hp: 45, speed: 75, dmg: 10, r: 16, xp: 2,
    shape: 'poly', sides: 6, color: '#ff4de0',
    behavior: chase,
    onDeath(e, world) {
      // 사망 시 스팸봇 2마리로 분열
      for (let i = 0; i < 2; i++) {
        const a = (i / 2) * Math.PI * 2 + Math.random();
        world.spawnEnemy('spam', e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 18);
      }
    },
  },

  sentry: {
    id: 'sentry', name: '센트리',
    hp: 60, speed: 30, dmg: 10, r: 15, xp: 3,
    shape: 'poly', sides: 5, color: '#ff5c2e',
    range: 330, fireCd: 2.0, shotSpeed: 190, shotDmg: 10,
    behavior(e, world, dt) {
      toPlayer(e, world);
      // 사거리 안이면 멈춰서 사격, 밖이면 접근
      if (e._tdist > e.def.range) {
        e.vx = e._tx * e.speed;
        e.vy = e._ty * e.speed;
      } else {
        e.vx = e.vy = 0;
        e.timer -= dt;
        if (e.timer <= 0) {
          e.timer = e.def.fireCd;
          world.spawnEnemyShot(e.x, e.y, e._tx * e.def.shotSpeed, e._ty * e.def.shotSpeed,
            e.def.shotDmg * world.dmgScale);
        }
      }
    },
  },

  reaper: {
    id: 'reaper', name: '리퍼',
    hp: 90, speed: 70, dmg: 14, r: 17, xp: 4,
    shape: 'star', sides: 5, color: '#ff2020',
    windup: 1.4, dashSpeed: 390, dashTime: 0.55, recover: 1.1,
    behavior(e, world, dt) {
      toPlayer(e, world);
      // state: 0 추격 / 1 조준 / 2 돌진 / 3 경직
      if (e.state === 0) {
        e.vx = e._tx * e.speed;
        e.vy = e._ty * e.speed;
        if (e._tdist < 260) { e.state = 1; e.timer = e.def.windup; }
      } else if (e.state === 1) {
        e.vx = e.vy = 0;
        e.timer -= dt;
        if (e.timer <= 0) {
          e.state = 2;
          e.timer = e.def.dashTime;
          e.dx = e._tx * e.def.dashSpeed;   // 조준 시점 방향으로 고정
          e.dy = e._ty * e.def.dashSpeed;
        }
      } else if (e.state === 2) {
        e.vx = e.dx; e.vy = e.dy;
        e.timer -= dt;
        if (e.timer <= 0) { e.state = 3; e.timer = e.def.recover; }
      } else {
        e.vx = e.vy = 0;
        e.timer -= dt;
        if (e.timer <= 0) e.state = 0;
      }
    },
  },

  // ── 엘리트 ────────────────────────────────────────────────
  demon: {
    id: 'demon', name: '데몬 프로세스', elite: true,
    hp: 900, speed: 65, dmg: 20, r: 40, xp: 60,
    shape: 'poly', sides: 8, color: C.orange, noKnockback: true,
    fireCd: 2.4, summonCd: 3.5,
    behavior(e, world, dt) {
      toPlayer(e, world);
      e.vx = e._tx * e.speed;
      e.vy = e._ty * e.speed;

      e.timer -= dt;
      if (e.timer <= 0) {
        e.timer = e.def.fireCd;
        // 8방향 확산 탄막
        const base = Math.random() * Math.PI * 2;
        for (let i = 0; i < 8; i++) {
          const a = base + (i / 8) * Math.PI * 2;
          world.spawnEnemyShot(e.x, e.y, Math.cos(a) * 170, Math.sin(a) * 170, 12 * world.dmgScale);
        }
      }

      e.timer2 -= dt;
      if (e.timer2 <= 0) {
        e.timer2 = e.def.summonCd;
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          world.spawnEnemy('worm', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60);
        }
      }
    },
  },

  zombie: {
    id: 'zombie', name: '좀비 스레드', elite: true,
    hp: 1100, speed: 82, dmg: 22, r: 34, xp: 45,
    shape: 'star', sides: 6, color: '#ff2e88', noKnockback: true,
    windup: 1.0, dashSpeed: 470, dashTime: 0.7, recover: 0.9,
    behavior(e, world, dt) {
      ENEMIES.reaper.behavior(e, world, dt);
    },
    onDeath(e, world) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        world.spawnEnemy('splitter', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40);
      }
    },
  },

  // ── 보스 ──────────────────────────────────────────────────
  kernel: {
    id: 'kernel', name: '커널 바이러스', boss: true,
    /*
     * 4400 이었는데 10분을 쌓아올린 빌드가 7초 만에 지웠다.
     * 페이즈가 셋이나 있는데 각 페이즈가 2초라 볼 틈이 없었다.
     *
     * 16000 으로 올렸다가 아직 싱겁다는 지적을 받고 20000 으로 다시 올렸다.
     * 페이즈마다 8초 안팎이 돌아간다. 32000 은 대부분 죽는다.
     * 보스 체력은 시간에 따라 오르지 않는다(고정) — 늦게 온다고 세지면 안 된다.
     */
    hp: 20000, speed: 52, dmg: 28, r: 64, xp: 0,
    shape: 'poly', sides: 6, color: '#ff2e88', noKnockback: true,
    behavior(e, world, dt) {
      toPlayer(e, world);

      const ratio = e.hp / e.maxHp;
      const phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
      if (phase !== e.state) {
        e.state = phase;
        e.timer = 0.6;
        e.timer2 = 1.0;
        world.showBanner(`페이즈 ${phase}`);
        world.shake(12);
      }

      const spd = e.def.speed * (phase === 3 ? 1.8 : phase === 2 ? 1.3 : 1);
      e.vx = e._tx * spd;
      e.vy = e._ty * spd;

      // 나선 탄막 — 페이즈가 오를수록 촘촘해진다
      e.timer -= dt;
      if (e.timer <= 0) {
        e.timer = phase === 3 ? 0.55 : phase === 2 ? 0.75 : 1.0;
        e.spiral = (e.spiral || 0) + 0.42;
        const arms = phase === 3 ? 16 : 12;
        for (let i = 0; i < arms; i++) {
          const a = e.spiral + (i / arms) * Math.PI * 2;
          world.spawnEnemyShot(e.x, e.y, Math.cos(a) * 165, Math.sin(a) * 165, 14 * world.dmgScale);
        }
      }

      // 페이즈 2 이상: 회전하는 십자 탄막 + 잡몹 소환
      if (phase >= 2) {
        e.timer2 -= dt;
        if (e.timer2 <= 0) {
          e.timer2 = phase === 3 ? 1.6 : 2.4;
          e.cross = (e.cross || 0) + 0.3;
          for (let k = 0; k < 4; k++) {
            const a = e.cross + (k / 4) * Math.PI * 2;
            for (let j = 1; j <= 6; j++) {
              world.spawnEnemyShot(e.x, e.y, Math.cos(a) * 90 * j, Math.sin(a) * 90 * j,
                12 * world.dmgScale);
            }
          }
          const count = phase === 3 ? 5 : 3;
          for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            world.spawnEnemy(i % 2 ? 'spam' : 'worm', e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90);
          }
        }
      }
    },
  },
};
