// Sparks: short-lived strokes thrown into the picture by what happens in it: the streak of an arrow, the burst
// where it lands, petals, dust, the light of a blessing. They are dabs like everything else, but few, and moved
// here each frame. Two sheets of them: `light` adds its colour to what is behind it (fire, glow, anything that
// shines); `paint` covers it (petals, dust, an arrow's shaft).
import * as THREE from 'three';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';

function sheet(shared, count, additive) {
  const aPos = new Float32Array(count * 3), aDir = new Float32Array(count * 3), aCol = new Float32Array(count * 3), aSize = new Float32Array(count * 3);
  const geometry = dabGeometry(count, { aPos: [aPos, 3], aDir: [aDir, 3], aCol: [aCol, 3], aSize: [aSize, 3] }, true);
  const mesh = dabMesh(geometry, dabMaterial(shared, {
    head: /* glsl */ `in vec3 aPos; in vec3 aDir; in vec3 aCol; in vec3 aSize;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        if (aSize.z <= 0.0) { d.alive = 0.0; return; }
        vec4 r = hash4(float(gl_InstanceID) * 3.1 + 2.0);
        d.pos = aPos; d.dir = aDir; d.size = aSize.xy;
        d.alive = min(aSize.z, 1.0);
        vec3 c = aCol;
        ${additive ? '' : 'c = hazed(c * (0.55 + 0.45 * sunAt(aPos)), aPos);'}
        d.c1 = c; d.c2 = c * 1.25;
        d.seed = float(gl_InstanceID); d.lift = 0.0; d.turnabout = 1.0;
      }`,
    uniforms: additive ? { uImpasto: { value: 0.3 } } : {},
    minPx: [1.5, 2.5], maxPx: [500, 900], cells: [0, 6],
  }), additive ? 22 : 7);
  if (additive) {
    const m = mesh.material;
    m.transparent = true; m.blending = THREE.AdditiveBlending; m.alphaToCoverage = false; m.depthWrite = false;
  }
  const live = [];
  let dirty = true;
  return {
    mesh,
    /** pos, vel, dir (or null: along its travel), size [across, along], color [r, g, b], life (s), gravity, drag, grow (per s), fade: 'out' | 'inout' */
    add(o) {
      if (live.length >= count) live.shift();
      live.push({
        p: o.pos.clone(), v: (o.vel ?? new THREE.Vector3()).clone(), dir: o.dir ? o.dir.clone() : null, size: [...o.size], color: [...o.color],
        life: o.life, age: 0, gravity: o.gravity ?? 0, drag: o.drag ?? 0, grow: o.grow ?? 0, fade: o.fade ?? 'out',
      });
      dirty = true;
    },
    update(dt) {
      if (!live.length && !dirty) return;
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i];
        s.age += dt;
        if (s.age >= s.life) { live.splice(i, 1); continue; }
        s.v.y -= s.gravity * dt;
        if (s.drag) s.v.multiplyScalar(Math.exp(-s.drag * dt));
        s.p.addScaledVector(s.v, dt);
      }
      aSize.fill(0);
      for (let i = 0; i < live.length; i++) {
        const s = live[i], t = s.age / s.life;
        const k = s.fade === 'inout' ? Math.sin(Math.PI * t) : 1 - t * t;
        const g = 1 + s.grow * s.age;
        aPos.set([s.p.x, s.p.y, s.p.z], i * 3);
        const d = s.dir ?? s.v;
        aDir.set(d.lengthSq() > 1e-6 ? [d.x, d.y, d.z] : [0, 1, 0], i * 3);
        aCol.set(additive ? [s.color[0] * k, s.color[1] * k, s.color[2] * k] : s.color, i * 3);
        aSize.set([s.size[0] * g, s.size[1] * g, additive ? 1 : Math.max(0.01, k)], i * 3);
      }
      for (const name of ['aPos', 'aDir', 'aCol', 'aSize']) geometry.attributes[name].needsUpdate = true;
      dirty = live.length > 0;
    },
  };
}

export function createFx(shared) {
  const light = sheet(shared, 420, true), paint = sheet(shared, 260, false);
  const group = new THREE.Group();
  group.add(light.mesh, paint.mesh);
  const v = new THREE.Vector3(), d = new THREE.Vector3();
  const rand = () => Math.random();
  return {
    group, light, paint,
    update(dt) { light.update(dt); paint.update(dt); },
    /** Sparks flying out from a point. */
    burst(pos, color, { count = 14, speed = 4, size = [0.07, 0.3], life = 0.5, gravity = 6, up = 0.4, sheet: which = light } = {}) {
      for (let i = 0; i < count; i++) {
        v.set(rand() - 0.5, rand() - 0.5 + up, rand() - 0.5).normalize().multiplyScalar(speed * (0.4 + 0.8 * rand()));
        which.add({ pos, vel: v, size: [size[0] * (0.6 + 0.8 * rand()), size[1] * (0.6 + 0.8 * rand())], color, life: life * (0.6 + 0.8 * rand()), gravity, drag: 1.5 });
      }
    },
    /** A ring of strokes running outward over the ground. */
    ring(pos, color, { count = 36, speed = 9, size = [0.16, 0.7], life = 0.7, which = light, lift = 0.25 } = {}) {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rand() * 0.2;
        v.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar(speed * (0.85 + 0.3 * rand()));
        d.copy(pos); d.y += lift;
        which.add({ pos: d, vel: v, dir: new THREE.Vector3(-Math.sin(a), 0.15, Math.cos(a)), size, color, life: life * (0.8 + 0.4 * rand()), drag: 2.2, grow: 1.2 });
      }
    },
    /** Light rising from a spot: a blessing, a thing found. */
    rise(pos, color, { count = 16, spread = 0.6, speed = 1.8, size = [0.06, 0.4], life = 1.1 } = {}) {
      for (let i = 0; i < count; i++) {
        d.set(pos.x + (rand() - 0.5) * 2 * spread, pos.y + rand() * 0.6, pos.z + (rand() - 0.5) * 2 * spread);
        v.set((rand() - 0.5) * 0.4, speed * (0.5 + rand()), (rand() - 0.5) * 0.4);
        light.add({ pos: d, vel: v, dir: new THREE.Vector3(0, 1, 0), size, color, life: life * (0.6 + 0.8 * rand()), fade: 'inout' });
      }
    },
  };
}
