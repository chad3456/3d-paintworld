// Building in paint: palaces, gates, walls, towers, huts. It is the reference's kit for made things
// (src/night/kit.js) with daylight (or firelight) put on it and a mason's few shapes added: walls between two
// points, pillars, domes, spires, flights of steps. Whatever is built is also noted down as something solid, for
// the hero's feet and for arrows to stop against.
import * as THREE from 'three';
import { createKit } from '../night/kit.js';

/** Sun, shade and sky on a made thing, by day. `extra` is GLSL run on the colour `c` last (a fire's glow, say). */
export const DAYLIGHT = (extra = '') => /* glsl */ `
  vec3 kitPaint(vec3 P, vec3 Nn, int k, float tone, float r) {
    float x = woodSunAt(P + Nn * 0.25) * clamp(dot(Nn, uSunDir) * 0.95 + 0.34, 0.0, 1.0);
    vec3 c = paint3(PAL_L[k], PAL_M[k], PAL_S[k], x, r) * tone;
    // light thrown up by the ground into the shade, and the sky's cool light on what faces up
    c += uBounce * max(-Nn.y, 0.0) * (1.0 - x);
    c = mix(c, c * vec3(0.86, 0.92, 1.16), (1.0 - x) * max(Nn.y, 0.0) * 0.5);
    ${extra}
    c += PAL_O[k] * uLampCol * lampAt(P, Nn);
    vec3 lit = PAL_L[k] * tone * (PAL_G[k] > 1.5 ? 1.0 : 0.8 + 0.2 * sin(uTime * 7.0 + P.x * 7.0 + P.z * 5.0 + P.y * 3.0));
    return PAL_G[k] > 0.5 ? lit : c;
  }`;

export function makeBuilder(shared, { palettes, seed = 1, origin = [0, 0, 0], head = '', light = DAYLIGHT(), order = 3 }) {
  const kit = createKit(shared, { palettes, seed, origin, head, light, haze: true, order });
  const solids = { boxes: [], posts: [] };
  const O = origin;
  const solidBox = (x, y, z, sx, sy, sz, rotY = 0) => solids.boxes.push({ x: x + O[0], y: y + O[1], z: z + O[2], hx: sx / 2, hy: sy / 2, hz: sz / 2, rotY });

  const b = {
    kit, solids,
    /** A block by its middle and size; solid unless told otherwise. */
    block(x, y, z, sx, sy, sz, pal, opts = {}) {
      kit.box(x, y, z, sx, sy, sz, pal, { stroke: [0.3, 0.9], ...opts });
      if (opts.solid !== false) solidBox(x, y, z, sx, sy, sz, opts.rotY ?? 0);
    },
    /** A wall from (x0, z0) to (x1, z1), standing on y0, h high and t thick. */
    wall(x0, z0, x1, z1, y0, h, t, pal, opts = {}) {
      const len = Math.hypot(x1 - x0, z1 - z0), rotY = Math.atan2(-(z1 - z0), x1 - x0);
      kit.box((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2, len, h, t, pal, { stroke: [0.4, 1.2], grain: 'x', ...opts, rotY });
      if (opts.solid !== false) solidBox((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2, len, h, t, rotY);
      // merlons along its top
      if (opts.merlons) {
        const n = Math.max(2, Math.round(len / opts.merlons));
        for (let i = 0; i < n; i++) {
          const k = (i + 0.5) / n;
          kit.box(x0 + (x1 - x0) * k, y0 + h + 0.4, z0 + (z1 - z0) * k, (len / n) * 0.55, 0.8, t, opts.cap ?? pal, { stroke: [0.3, 0.6], rotY });
        }
      }
    },
    /** A round pillar on a square foot with a square head. */
    pillar(x, y, z, r, h, pal, opts = {}) {
      kit.box(x, y + 0.18, z, r * 2.9, 0.36, r * 2.9, opts.trim ?? pal, { stroke: [0.2, 0.4] });
      kit.round(x, y + 0.36 + (h - 0.8) / 2, z, r, h - 0.8, pal, { top: r * 0.86, stroke: [0.16, 0.7], sides: 10, ...opts });
      kit.box(x, y + h - 0.22, z, r * 3.1, 0.44, r * 3.1, opts.trim ?? pal, { stroke: [0.2, 0.4] });
      if (opts.solid !== false) solids.posts.push({ x: x + O[0], y: y + O[1], z: z + O[2], r: r * 1.15, h });
    },
    /** A dome: half a ball, a little taller than round, with a finial. */
    dome(x, y, z, r, pal, opts = {}) {
      const g = new THREE.SphereGeometry(r, opts.sides ?? 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, opts.tall ?? 1.15, 1));
      kit.add(g, m, pal, { smooth: true, grain: new THREE.Vector3(0, 1, 0), stroke: [0.3 * Math.min(1, r / 3), 0.9 * Math.min(1, r / 3)], ...opts });
      if (opts.finial !== false) {
        const top = y + r * (opts.tall ?? 1.15);
        kit.round(x, top + r * 0.12, z, r * 0.07, r * 0.3, opts.finial ?? pal, { stroke: [0.08, 0.2] });
        kit.add(new THREE.SphereGeometry(r * 0.13, 8, 6), kit.place(x, top + r * 0.36, z), opts.finial ?? pal, { smooth: true, stroke: [0.08, 0.16] });
      }
    },
    /** A temple spire: a tall curved tower that draws in to a point, turned on a lathe. */
    spire(x, y, z, r, h, pal, opts = {}) {
      const pts = [];
      for (let i = 0; i <= 9; i++) {
        const t = i / 9;
        pts.push(new THREE.Vector2(Math.max(0.02, r * (1 - Math.pow(t, 1.7)) * (1 + 0.06 * Math.sin(t * 28))), t * h));
      }
      const g = new THREE.LatheGeometry(pts, opts.sides ?? 12);
      kit.add(g, kit.place(x, y, z), pal, { smooth: true, grain: new THREE.Vector3(0, 1, 0), stroke: [0.28 * Math.min(1, r / 3), 0.8 * Math.min(1, r / 3)], ...opts });
      kit.add(new THREE.SphereGeometry(r * 0.16, 8, 6), kit.place(x, y + h + r * 0.1, z), opts.finial ?? pal, { smooth: true, stroke: [0.1, 0.2] });
    },
    /** A flight of n steps rising toward -z (or, turned by rotY, another way), w wide, from (x, y, z) at its foot. */
    steps(x, y, z, w, n, rise, run, pal, opts = {}) {
      const rotY = opts.rotY ?? 0, c = Math.cos(rotY), s = Math.sin(rotY);
      for (let i = 0; i < n; i++) {
        const back = (i + 0.5) * run + (n - i - 1) * run * 0, depth = (n - i) * run;
        // each step is a slab reaching back under the ones above it
        const mid = -(i * run + depth / 2);
        const px = x + s * mid, pz = z + c * mid;
        kit.box(px, y + (i + 0.5) * rise, pz, w, rise, depth, pal, { stroke: [0.25, 0.8], grain: 'x', rotY, ...opts });
        solidBox(px, y + (i + 0.5) * rise, pz, w, rise, depth, rotY);
        void back;
      }
    },
    build() { return kit.build(); },
  };
  return b;
}
