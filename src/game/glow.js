// Lights that stand in the world: a lamp's flame, a herb that glows, a fire, the mark of somewhere to go. Each is
// a few strokes of light (they add to the picture instead of covering it, like the reference's lantern): a flame,
// a soft glow round it, and, if wanted, a thin shaft standing up from it that can be seen from far off.
import * as THREE from 'three';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';

const PER = 14;

export function createBeacons(shared, max = 28) {
  const count = max * PER;
  const aSpot = new Float32Array(count * 4), aCol = new Float32Array(count * 3), aKind = new Float32Array(count * 2);
  const geometry = dabGeometry(count, { aSpot: [aSpot, 4], aCol: [aCol, 3], aKind: [aKind, 2] }, true);
  const mesh = dabMesh(geometry, dabMaterial(shared, {
    head: /* glsl */ `in vec4 aSpot; in vec3 aCol; in vec2 aKind;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        if (aSpot.w <= 0.0) { d.alive = 0.0; return; }
        float id = float(gl_InstanceID);
        vec4 r = hash4(id * 7.3 + 2.0);
        float size = aKind.y;
        float flicker = 0.82 + 0.18 * sin(uTime * (7.0 + 9.0 * r.z) + r.w * 30.0);
        float a = r.x * TAU + uTime * 0.2 * (r.w - 0.5);
        vec3 out_ = normalize(vec3(cos(a), (r.y - 0.4) * 1.6, sin(a)));
        if (aKind.x < 0.5) {
          d.pos = aSpot.xyz + vec3(0.0, 0.07 * size, 0.0);
          d.dir = vec3(0.12 * sin(uTime * 5.0 + r.x * 9.0), 1.0, 0.1 * cos(uTime * 4.0 + r.y * 9.0));
          d.size = vec2(0.1, 0.2) * size;
          d.c1 = mix(aCol, vec3(1.0, 0.95, 0.8), 0.5) * 0.6;
        } else if (aKind.x < 1.5) {
          d.pos = aSpot.xyz + out_ * (0.1 + 0.42 * r.z) * size;
          d.dir = out_;
          d.size = vec2(0.15, 0.38) * size * (0.6 + 0.9 * r.w);
          d.c1 = aCol * 0.16 / (1.0 + 3.0 * r.z);
        } else {
          d.pos = aSpot.xyz + vec3(0.0, (0.8 + 5.5 * r.x) * size, 0.0);
          d.dir = vec3(0.0, 1.0, 0.0);
          d.size = vec2(0.1, 2.6) * size;
          d.c1 = aCol * 0.075 * (0.6 + 0.4 * sin(uTime * 1.3 + r.y * 20.0));
        }
        d.c1 *= flicker * aSpot.w;
        d.c2 = d.c1 * 1.3;
        d.seed = id;
        d.lift = 0.0;
      }`,
    uniforms: { uImpasto: { value: 0.3 } },
    minPx: [3, 5], maxPx: [300, 900], cells: [0, 6],
  }), 21);
  const m = mesh.material;
  m.transparent = true; m.blending = THREE.AdditiveBlending; m.alphaToCoverage = false; m.depthWrite = false;
  let used = 0;
  const touch = () => { geometry.attributes.aSpot.needsUpdate = true; };
  return {
    mesh,
    /** A light at (x, y, z). shaft: also a beam standing up from it. Returns its handle: on(0..1), move(x, y, z). */
    add(x, y, z, { color = [1.0, 0.62, 0.25], size = 1, shaft = false, lit = 1 } = {}) {
      if (used >= max) throw new Error('too many beacons');
      const first = used++ * PER;
      for (let k = 0; k < PER; k++) {
        const i = first + k, kind = k < 3 ? 0 : k < (shaft ? 10 : PER) ? 1 : 2;
        aSpot.set([x, y, z, lit], i * 4); aCol.set(color, i * 3); aKind.set([kind, size], i * 2);
      }
      for (const name of ['aSpot', 'aCol', 'aKind']) geometry.attributes[name].needsUpdate = true;
      const handle = {
        position: new THREE.Vector3(x, y, z), lit,
        on(v) { handle.lit = v; for (let k = 0; k < PER; k++) aSpot[(first + k) * 4 + 3] = v; touch(); },
        move(nx, ny, nz) { handle.position.set(nx, ny, nz); for (let k = 0; k < PER; k++) aSpot.set([nx, ny, nz], (first + k) * 4); touch(); },
      };
      return handle;
    },
  };
}
