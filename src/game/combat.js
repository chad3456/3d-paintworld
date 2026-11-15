// Things in flight: arrows, the Brahmastra, Sita's lotus of light, a rakshasa king's fire. Each is a point that
// travels, leaves strokes of light behind it (src/game/fx.js) and ends on the first thing it meets.
import * as THREE from 'three';

const KINDS = {
  arrow: { trail: [1.0, 0.82, 0.4], core: [0.98, 0.9, 0.6], size: [0.04, 1.0], glow: 0.5, gravity: 1.5 },
  astra: { trail: [0.75, 0.85, 1.0], core: [1.0, 0.97, 0.85], size: [0.12, 1.8], glow: 1.2, gravity: 0, sparks: [1.0, 0.8, 0.35], splash: 5.5 },
  lotus: { trail: [1.0, 0.5, 0.62], core: [1.0, 0.86, 0.9], size: [0.22, 0.3], glow: 0.8, gravity: 4, petals: true, splash: 2.6, stun: 1.6 },
  fire: { trail: [1.0, 0.38, 0.08], core: [1.0, 0.75, 0.3], size: [0.34, 0.5], glow: 1.1, gravity: 0, sparks: [1.0, 0.45, 0.1], hostile: true, splash: 1.6 },
};

export function createCombat({ fx, foes, castRay, heightAt }) {
  const shots = [];
  const step = new THREE.Vector3(), dir = new THREE.Vector3(), p = new THREE.Vector3(), v = new THREE.Vector3();

  function shoot({ kind, pos, dir: d, speed, damage, life = 3.5 }) {
    shots.push({ kind, k: KINDS[kind], pos: pos.clone(), vel: d.clone().normalize().multiplyScalar(speed), damage, life, age: 0 });
  }

  function end(s, hitFoe) {
    const k = s.k;
    if (k.splash) {
      if (!k.hostile) foes.strike(s.pos, k.splash, hitFoe ? s.damage * 0.6 : s.damage, { stun: k.stun ?? 0, push: 1.4 });
      fx.burst(s.pos, k.sparks ?? k.trail, { count: s.kind === 'astra' ? 44 : 16, speed: s.kind === 'astra' ? 9 : 4, size: [0.08, 0.5], life: 0.7 });
      if (s.kind === 'astra') fx.ring(s.pos, [1.0, 0.85, 0.5], { count: 40, speed: 12, lift: 0.3 });
      if (k.petals) fx.burst(s.pos, [1.0, 0.72, 0.8], { count: 14, speed: 3, size: [0.09, 0.14], life: 1.1, gravity: 2.5, sheet: fx.paint });
    } else {
      fx.burst(s.pos, k.trail, { count: 6, speed: 2.5, size: [0.04, 0.2], life: 0.3 });
    }
  }

  /** hero: { pos (feet), alive }. Returns the blows that reached the hero this frame: [{ damage, from }]. */
  function update(dt, hero) {
    const hits = [];
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i], k = s.k;
      s.age += dt;
      s.vel.y -= k.gravity * dt;
      step.copy(s.vel).multiplyScalar(dt);
      const len = step.length();
      dir.copy(step).divideScalar(len || 1);
      let over = s.age > s.life, struck = null;
      // the still world: ground, walls, trunks
      const wall = castRay(s.pos, dir, len + 0.05);
      if (wall != null) { s.pos.addScaledVector(dir, Math.max(0, wall - 0.02)); over = true; }
      else s.pos.add(step);
      if (!over && s.pos.y < heightAt(s.pos.x, s.pos.z)) over = true;
      if (!over) {
        if (k.hostile) {
          p.set(hero.pos.x, hero.pos.y + 1.0, hero.pos.z);
          if (hero.alive && p.distanceTo(s.pos) < 1.0) { hits.push({ damage: s.damage, from: s.pos.clone() }); over = true; }
        } else {
          for (const foe of foes.list) {
            if (!foe.alive) continue;
            const d = Math.hypot(foe.pos.x - s.pos.x, foe.pos.z - s.pos.z);
            if (d < foe.radius + 0.35 && s.pos.y > foe.pos.y - 0.2 && s.pos.y < foe.pos.y + foe.height + 0.2) { struck = foe; break; }
          }
          if (struck) { foes.hurt(struck, s.damage, p.copy(s.pos).addScaledVector(dir, -1), { stun: k.stun ?? 0 }); over = true; }
        }
      }
      // what it looks like on the way
      fx.light.add({ pos: s.pos, dir, size: [k.size[0] * 2.2, k.size[1] * 1.3], color: k.trail.map((c) => c * k.glow * 0.55), life: 0.2 });
      fx.light.add({ pos: s.pos, dir, size: k.size, color: k.core.map((c) => c * k.glow), life: 0.07 });
      if (s.kind === 'arrow') fx.paint.add({ pos: s.pos, dir, size: [0.03, 0.8], color: [0.95, 0.82, 0.5], life: 0.05 });
      if (k.sparks && Math.random() < 0.7) {
        v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2.5);
        fx.light.add({ pos: s.pos, vel: v, size: [0.05, 0.2], color: k.sparks, life: 0.45, gravity: 2 });
      }
      if (k.petals && Math.random() < 0.5) {
        v.set(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).multiplyScalar(1.4);
        fx.paint.add({ pos: s.pos, vel: v, size: [0.07, 0.1], color: [1.0, 0.7 + 0.2 * Math.random(), 0.8], life: 0.8, gravity: 1.5 });
      }
      if (over) { end(s, struck); shots.splice(i, 1); }
    }
    return hits;
  }
  return { shoot, update, shots };
}
