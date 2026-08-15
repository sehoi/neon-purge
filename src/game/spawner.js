// 타임라인 기반 스폰. 화면 밖 링 위에 적을 배치한다.

import { entryAt, TIMELINE } from '../data/waves.js';
import { rnd, range } from '../core/rng.js';
import { IS_TOUCH, MOBILE_CAP_SCALE } from '../config.js';

/** 모바일에서는 동시 적 수를 줄인다. 곡선의 모양은 그대로 두고 높이만 낮춘다. */
function capFor(entry) {
  return IS_TOUCH ? Math.round(entry.cap * MOBILE_CAP_SCALE) : entry.cap;
}

const SPAWN_MIN = 700;
const SPAWN_MAX = 820;

export function createSpawner() {
  return {
    acc: {},              // 적 타입별 스폰 누산기
    firedEvents: new Set(),
  };
}

/** 화면 밖 랜덤 지점. 플레이어 진행 방향 쪽에 가중치를 준다 (도망만 치면 안 되게). */
function ringPoint(p) {
  let a;
  if ((p.faceX || p.faceY) && rnd() < 0.6) {
    const face = Math.atan2(p.faceY, p.faceX);
    a = face + range(-1.0, 1.0);
  } else {
    a = rnd() * Math.PI * 2;
  }
  const d = range(SPAWN_MIN, SPAWN_MAX);
  return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, a, d };
}

export function updateSpawner(sp, world, dt) {
  // 이벤트(엘리트/보스)는 시각을 넘기는 순간 1회만 발화
  for (const e of TIMELINE) {
    if (e.event && world.t >= e.t && !sp.firedEvents.has(e.event)) {
      sp.firedEvents.add(e.event);
      world.fireEvent(e.event);
    }
  }

  if (world.eventLock) return;      // 엘리트 등장 중에는 일반 스폰 정지

  const entry = entryAt(world.t);
  if (!entry.spawn) return;
  const cap = capFor(entry);
  if (world.enemies.count >= cap) return;

  for (const type in entry.spawn) {
    const rate = entry.spawn[type];
    sp.acc[type] = (sp.acc[type] || 0) + rate * dt;
    while (sp.acc[type] >= 1) {
      sp.acc[type] -= 1;
      if (world.enemies.count >= cap) break;

      if (entry.frenzy && rnd() < 0.25) {
        // 광란 페이즈: 사방에서 동시에 밀려온다
        const base = rnd() * Math.PI * 2;
        for (let i = 0; i < 4; i++) {
          const a = base + (i / 4) * Math.PI * 2;
          const d = range(SPAWN_MIN, SPAWN_MAX);
          world.spawnEnemy(type, world.player.x + Math.cos(a) * d, world.player.y + Math.sin(a) * d);
        }
      } else {
        const pt = ringPoint(world.player);
        world.spawnEnemy(type, pt.x, pt.y);
      }
    }
  }
}

export function spawnRingOfEnemies(world, type, count, dist = 760) {
  const base = rnd() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const a = base + (i / count) * Math.PI * 2;
    world.spawnEnemy(type, world.player.x + Math.cos(a) * dist, world.player.y + Math.sin(a) * dist);
  }
}
