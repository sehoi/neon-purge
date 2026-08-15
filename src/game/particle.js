// 파편·플래시 파티클. 처치의 "시원함"은 대부분 여기서 나온다.

import { createPool } from '../core/pool.js';
import { range, rnd } from '../core/rng.js';

export function makeParticle() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, r: 3, life: 0, maxLife: 1,
    color: '#fff', kind: 'shard', rot: 0, spin: 0, alive: false,
  };
}

export const particles = createPool(makeParticle, 700);

// 후반에는 한 프레임에 수십 마리가 죽고 수백 번의 히트가 발생한다.
// 풀이 붐빌수록 새 파티클을 스스로 줄여 렌더 비용의 상한을 만든다.
// (연출은 어차피 겹쳐서 안 보인다 — 프레임을 지키는 쪽이 이득이다)
function congestion() {
  return particles.count / particles.capacity;
}

/** 처치 시 도형 파편이 튄다. */
export function burst(x, y, color, count = 8, speed = 160, size = 4) {
  const c = congestion();
  if (c > 0.55) count = Math.max(1, Math.round(count * (c > 0.8 ? 0.25 : 0.5)));
  for (let i = 0; i < count; i++) {
    const p = particles.spawn();
    const a = rnd() * Math.PI * 2;
    const s = range(speed * 0.4, speed);
    p.x = x; p.y = y;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.r = range(size * 0.5, size);
    p.maxLife = p.life = range(0.25, 0.6);
    p.color = color;
    p.kind = 'shard';
    p.rot = rnd() * Math.PI;
    p.spin = range(-8, 8);
  }
}

/**
 * 히트 지점의 짧은 링 플래시.
 * 광역 무기 하나가 200마리를 때리면 한 프레임에 200개가 생긴다. 붐비면 건너뛴다.
 */
export function flash(x, y, color, r = 18) {
  if (congestion() > 0.45 && rnd() > 0.25) return;
  const p = particles.spawn();
  p.x = x; p.y = y;
  p.vx = p.vy = 0;
  p.r = r;
  p.maxLife = p.life = 0.16;
  p.color = color;
  p.kind = 'flash';
}

/** 대시·이동 잔상. */
export function trail(x, y, color, r = 8, life = 0.3) {
  const p = particles.spawn();
  p.x = x; p.y = y;
  p.vx = p.vy = 0;
  p.r = r;
  p.maxLife = p.life = life;
  p.color = color;
  p.kind = 'trail';
}

/** 체인 아크 등의 번개 선분. */
export function zapLine(x0, y0, x1, y1, color) {
  const p = particles.spawn();
  p.x = x0; p.y = y0;
  p.vx = x1; p.vy = y1;      // 끝점을 vx/vy 에 재사용
  p.r = 0;
  p.maxLife = p.life = 0.18;
  p.color = color;
  p.kind = 'zap';
  p.rot = rnd() * 100;       // zap 모양 시드
}

export function updateParticles(dt) {
  particles.forEach(p => {
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; return; }
    if (p.kind === 'shard') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
      p.rot += p.spin * dt;
    } else if (p.kind === 'flash') {
      p.r += 120 * dt;
    }
  });
  particles.compact();
}

export function clearParticles() {
  particles.clear();
}
