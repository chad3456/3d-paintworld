// A character, painted: a body from src/game/rigs.js given its colours, dressed in what its definition lists
// (src/game/cast.js) and covered in dabs that ride on it. The body keeps its real shape as an underpainting in three
// flat mixes; crowns, weapons and ornaments are simple shapes made here, set on while the body stands at rest (arms
// out, facing +z) and then handed to the bone that carries them. Cloth is the reference cloak's, cut shorter.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { pinDabs } from '../oilpaint/pins.js';
import { paint } from '../figure/figure.js';
import { Cloak } from '../figure/cloak.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), DOWN = V(0, -1, 0), OUT = V(1, 0, 0), FWD = V(0, 0, 1);
const glsl3 = (c) => `vec3(${c.map((x) => x.toFixed(3)).join(', ')})`;

/** light: what the hour does to a palette (src/game/cast.js byNight, byFire); detail: 1 for the hero, less for a crowd. */
export function buildCharacter(shared, body, def, { light = (p) => p, detail = 1, cloth = true } = {}) {
  const { object, bones, rest, head } = body;
  object.position.set(0, 0, 0); object.rotation.set(0, 0, 0); object.scale.set(1, 1, 1);
  object.updateMatrixWorld(true);

  // --- palettes: by name, and in a fixed order for the dabs ---
  const names = Object.keys(def.palettes);
  const pal = {};
  for (const name of names) {
    let p = def.palettes[name];
    while (typeof p === 'string') p = def.palettes[p];
    pal[name] = light(p);
  }
  const at = (name) => { const i = names.indexOf(name); if (i < 0) throw new Error(`${def.name} has no palette ${name}`); return i; };
  const has = (name) => names.includes(name);

  // --- the body ---
  const woman = body.kind === 'woman';
  const find = (re) => body.meshes.find((m) => re.test(m.name + ' ' + (m.material?.name ?? '')));
  for (const mesh of body.meshes) {
    const name = mesh.name + ' ' + (mesh.material?.name ?? '');
    if (/eyebrow|eyelash/.test(name)) { mesh.visible = false; continue; }
    mesh.material = /casualsuit/.test(name) ? paint(shared, pal.upper, { skinned: true, lower: pal.lower, split: 0.98, grain: 2.6 })
      : /sweater/.test(name) ? paint(shared, pal.blouse, { skinned: true, grain: 2.6 })
      : /skirt/.test(name) ? paint(shared, pal.skirt, { skinned: true, lower: pal.hem, split: 0.13, grain: 2.2 })
      : /shoes/.test(name) ? paint(shared, pal.feet, { skinned: true })
      : /short01|braid/.test(name) ? paint(shared, pal.hair, { skinned: true })
      : /high-poly/.test(name) ? paint(shared, pal.eyes, { skinned: true })
      : paint(shared, pal.skin, { skinned: true });
    mesh.layers.enable(1);
    mesh.frustumCulled = false;
  }

  // --- measures of this body at rest ---
  const W = rest.upperarm_l.x - rest.upperarm_r.x; // across the shoulders
  const R = (head.max.x - head.min.x) / 2; // half the head's width
  const hc = V((head.min.x + head.max.x) / 2, (head.min.y + head.max.y) / 2, (head.min.z + head.max.z) / 2);
  const top = head.max.y, face = head.max.z;
  const u = W / 0.37; // this body's size against the starter man's

  const parts = []; // for the pins
  const group = new THREE.Group(); // everything of the character that isn't hung on its bones
  const tick = []; // (dt, ctx) => void

  /** A made thing, given in the body's resting measure, carried by a bone. pins: { count, size, dir | style, pal } */
  function piece(geometry, palette, bone, pins) {
    const mesh = new THREE.Mesh(geometry, paint(shared, pal[palette], { grain: 3 }));
    mesh.layers.enable(1);
    mesh.frustumCulled = false;
    object.add(mesh);
    mesh.updateMatrixWorld(true);
    bones[bone].attach(mesh);
    if (pins) {
      const k = at(pins.pal ?? palette);
      parts.push({ mesh, count: Math.max(3, Math.round(pins.count * detail)), style: pins.style ? (p, n) => pins.style(p, n, k) : () => ({ pal: k, size: pins.size, dir: pins.dir ?? UP }) });
    }
    return mesh;
  }
  const ring = (radius, tube, turnX = Math.PI / 2, squash = 1) => {
    const g = new THREE.TorusGeometry(radius, tube, 6, 20);
    g.rotateX(turnX);
    g.scale(1, 1, squash);
    return g;
  };
  const move = (g, x, y, z) => g.translate(x, y, z);
  const round = (r, y) => new THREE.Vector2(r, y);

  /** A crown: `tiers` are [radius, height] in head-halves, turned on a lathe and set on the skull at (x, y, z). */
  function crown(tiers, x, y, z, size, bone = 'Head', count = 70) {
    const g = new THREE.LatheGeometry(tiers.map(([r, h]) => round(r * size, h * size)), 14);
    move(g, x, y, z);
    const jewel = has('jewel') ? at('jewel') : null;
    piece(g, 'gold', bone, {
      count,
      style: (p, n, k) => {
        // a band of stones round the brow, and one here and there above it
        const band = p.y - y < 0.42 * size;
        const stone = jewel != null && Math.abs(Math.sin(p.x * 91.7 + p.z * 57.3 + p.y * 33.1)) > (band ? 0.72 : 0.93);
        return { pal: stone ? jewel : k, size: stone ? [0.024 * u, 0.03 * u] : [0.03 * u, 0.06 * u], dir: UP };
      },
    });
  }
  const KIRITA = [[1.06, 0], [1.16, 0.22], [1.08, 0.46], [1.0, 0.7], [0.86, 1.1], [0.66, 1.55], [0.46, 1.95], [0.26, 2.25], [0.32, 2.45], [0.2, 2.62], [0.0, 2.75]];
  const TIARA = [[1.05, 0], [1.12, 0.2], [1.02, 0.42], [0.8, 0.7], [0.5, 0.95], [0.2, 1.1], [0.0, 1.16]];
  const LOW = [[1.08, 0], [1.2, 0.25], [1.1, 0.5], [0.92, 0.85], [0.62, 1.25], [0.32, 1.55], [0.36, 1.7], [0.0, 1.9]];

  const gear = {
    crown() {
      const tiers = def.crown === 'tiara' ? TIARA : def.crown === 'low' ? LOW : KIRITA;
      crown(tiers, hc.x, top - 0.62 * R, hc.z - 0.1 * R, R);
    },
    tilak() {
      const g = new THREE.BoxGeometry(0.014 * u, 0.045 * u, 0.008);
      move(g, hc.x, hc.y + 0.36 * R, face - 0.012);
      piece(g, has('jewel') ? 'jewel' : 'gold', 'Head', { count: 3, size: [0.014 * u, 0.04 * u], dir: UP });
    },
    necklace() {
      const g = ring(0.3 * W, 0.016 * u, Math.PI / 2 + 0.6, 0.9);
      move(g, 0, rest.neck_01.y - 0.015 * u, rest.neck_01.z + 0.03 * u);
      piece(g, 'gold', 'spine_03', { count: 26, size: [0.022 * u, 0.045 * u], style: (p, n, k) => ({ pal: k, size: [0.022 * u, 0.045 * u], dir: V(-p.z + rest.neck_01.z, 0, p.x).normalize() }) });
    },
    garland() {
      const g = ring(0.52 * W, 0.024 * u, Math.PI / 2 + 1.02, 0.8);
      move(g, 0, rest.neck_01.y - 0.07 * u, rest.neck_01.z + 0.035 * u);
      piece(g, 'flower', 'spine_03', { count: 44, size: [0.036 * u, 0.045 * u], dir: OUT });
    },
    armlets() {
      for (const s of ['l', 'r']) {
        const sign = s === 'l' ? 1 : -1, a = rest[`upperarm_${s}`];
        const g = ring(0.058 * u, 0.014 * u, 0);
        g.rotateY(Math.PI / 2);
        move(g, a.x + sign * 0.11 * u, a.y, a.z);
        piece(g, 'gold', `upperarm_${s}`, { count: 10, size: [0.022 * u, 0.05 * u], dir: FWD });
      }
    },
    bracelets() {
      for (const s of ['l', 'r']) {
        const sign = s === 'l' ? 1 : -1, a = rest[`hand_${s}`];
        const g = ring(0.04 * u, 0.012 * u, 0);
        g.rotateY(Math.PI / 2);
        move(g, a.x - sign * 0.035 * u, a.y, a.z);
        piece(g, 'gold', `lowerarm_${s}`, { count: 7, size: [0.018 * u, 0.04 * u], dir: FWD });
      }
    },
    anklets() {
      for (const s of ['l', 'r']) {
        const a = rest[`foot_${s}`];
        const g = ring(0.052 * u, 0.013 * u);
        move(g, a.x, a.y + 0.035 * u, a.z);
        piece(g, 'gold', `calf_${s}`, { count: 7, size: [0.018 * u, 0.04 * u], dir: OUT });
      }
    },
    belt() {
      const g = ring(woman ? 0.41 * W : 0.44 * W, 0.028 * u, Math.PI / 2, 0.74);
      move(g, 0, rest.pelvis.y + (woman ? 0.1 : 0.075) * u, rest.pelvis.z + 0.01);
      piece(g, 'gold', 'pelvis', { count: 30, style: (p, n, k) => ({ pal: k, size: [0.03 * u, 0.07 * u], dir: V(-p.z, 0, p.x).normalize() }) });
    },
    pleat() {
      // the folds of the dhoti gathered and let fall in front
      const g = new THREE.BoxGeometry(0.13 * u, 0.36 * u, 0.035 * u, 1, 3, 1);
      move(g, 0, rest.pelvis.y - 0.13 * u, rest.pelvis.z + 0.125 * u);
      piece(g, 'lower', 'pelvis', { count: 16, size: [0.04 * u, 0.13 * u], dir: UP });
    },
    sash() {
      // a cloth from the left shoulder across the chest to the right hip
      const g = ring(0.66 * W, 0.024 * u, Math.PI / 2, 0.62);
      g.rotateZ(0.95);
      move(g, 0, rest.spine_03.y - 0.07 * u, rest.spine_03.z + 0.005);
      piece(g, 'cloth', 'spine_02', { count: 34, style: (p, n, k) => ({ pal: k, size: [0.04 * u, 0.1 * u], dir: V(0.6, 0.8, 0) }) });
    },
    quiver() {
      const tube = new THREE.CylinderGeometry(0.045 * u, 0.036 * u, 0.5 * u, 8);
      const shafts = [];
      for (let i = 0; i < 4; i++) {
        const s = new THREE.CylinderGeometry(0.007, 0.007, 0.2 * u, 4);
        s.translate((i - 1.5) * 0.02 * u, 0.33 * u, ((i * 7) % 3 - 1) * 0.015 * u);
        shafts.push(s);
      }
      const g = mergeGeometries([tube, ...shafts]);
      g.rotateZ(-0.42); g.rotateX(-0.1);
      move(g, -0.03 * u, rest.spine_03.y - 0.02 * u, rest.spine_03.z - 0.17 * u);
      piece(g, has('wood') ? 'wood' : 'gold', 'spine_03', {
        count: 30,
        style: (p, n, k) => (p.y > rest.spine_03.y + 0.22 * u ? { pal: at('jewel'), size: [0.022 * u, 0.06 * u], dir: UP } : { pal: p.y > rest.spine_03.y + 0.14 * u || p.y < rest.spine_03.y - 0.18 * u ? at('gold') : k, size: [0.035 * u, 0.1 * u], dir: V(0.4, 0.9, 0) }),
      });
    },
    hairflowers() {
      const g = new THREE.TorusGeometry(0.06 * u, 0.02 * u, 5, 12);
      move(g, hc.x, hc.y + 0.2 * R, head.min.z + 0.01);
      piece(g, 'flower', 'Head', { count: 14, size: [0.028 * u, 0.034 * u], dir: OUT });
    },
    muzzle() {
      const g = new THREE.SphereGeometry(1, 12, 8);
      g.scale(0.62 * R, 0.5 * R, 0.5 * R);
      move(g, hc.x, hc.y - 0.42 * R, face - 0.3 * R);
      piece(g, 'face', 'Head', { count: 22, size: [0.022 * u, 0.04 * u], style: (p, n, k) => ({ pal: k, size: [0.022 * u, 0.04 * u], dir: V(n.z + 0.2, 0.3, -n.x).normalize() }) });
    },
    moustache() {
      for (const sign of [1, -1]) {
        const g = new THREE.ConeGeometry(0.02 * u, 0.13 * u, 5);
        g.rotateZ(-sign * 1.25);
        move(g, hc.x + sign * 0.075 * u, hc.y - 0.44 * R, face - 0.02);
        piece(g, 'hair', 'Head', { count: 5, size: [0.02 * u, 0.07 * u], dir: V(sign, 0.3, 0) });
      }
    },
    horns() {
      for (const sign of [1, -1]) {
        const g = new THREE.ConeGeometry(0.034 * u, 0.2 * u, 6);
        g.translate(0, 0.1 * u, 0);
        g.rotateZ(-sign * 0.5);
        move(g, hc.x + sign * 0.72 * R, top - 0.3 * R, hc.z);
        piece(g, 'ivory', 'Head', { count: 8, size: [0.025 * u, 0.08 * u], dir: V(sign * 0.45, 0.9, 0) });
      }
    },
    tusks() {
      for (const sign of [1, -1]) {
        const g = new THREE.ConeGeometry(0.013 * u, 0.06 * u, 5);
        move(g, hc.x + sign * 0.36 * R, hc.y - 0.5 * R, face - 0.035);
        piece(g, 'ivory', 'Head', { count: 3, size: [0.014 * u, 0.045 * u], dir: UP });
      }
    },
    heads() {
      // nine more heads, ranged to either side of his own, each under a crown
      const skin = [], crowns = [];
      for (const [sign, n] of [[1, 4], [-1, 5]]) {
        for (let i = 1; i <= n; i++) {
          const r = R * (0.86 - 0.035 * i);
          const x = hc.x + sign * (1.72 * R * i - 0.05 * R * i * i), y = hc.y - 0.05 * R * i, z = hc.z - 0.07 * R * i * i;
          const s = new THREE.SphereGeometry(r, 9, 7);
          s.scale(1, 1.14, 1);
          s.translate(x, y, z);
          skin.push(s);
          const c = new THREE.LatheGeometry(LOW.map(([cr, ch]) => round(cr * r * 0.95, ch * r * 0.95)), 9);
          c.translate(x, y + 0.72 * r, z);
          crowns.push(c);
        }
      }
      piece(mergeGeometries(skin), 'skin', 'Head', { count: 110, size: [0.032 * u, 0.05 * u], style: (p, n, k) => ({ pal: n.z > 0.55 && n.y < 0.1 && n.y > -0.5 && Math.abs(n.x) < 0.5 ? at('hair') : k, size: [0.03 * u, 0.05 * u], dir: V(n.z, 0.4, -n.x).normalize() }) });
      piece(mergeGeometries(crowns), 'gold', 'Head', { count: 90, size: [0.026 * u, 0.05 * u], dir: UP });
    },
    // --- carried in the right hand: made pointing ahead of the open palm, so a swing of the arm swings it ---
    gada() {
      const g0 = rest.hand_r.clone().lerp(rest.middle_01_r, 0.7);
      const shaft = new THREE.CylinderGeometry(0.02 * u, 0.026 * u, 0.74 * u, 7);
      shaft.translate(0, 0.26 * u, 0);
      const ball = new THREE.LatheGeometry([[0, 0], [0.07, 0.01], [0.125, 0.07], [0.14, 0.14], [0.125, 0.215], [0.075, 0.27], [0.03, 0.3], [0.045, 0.33], [0.0, 0.37]].map(([r, h]) => round(r * u, h * u)), 12);
      ball.translate(0, 0.6 * u, 0);
      const pommel = new THREE.SphereGeometry(0.036 * u, 7, 5);
      pommel.translate(0, -0.12 * u, 0);
      const g = mergeGeometries([shaft, ball, pommel]);
      g.rotateX(Math.PI / 2);
      move(g, g0.x, g0.y - 0.02, g0.z);
      piece(g, 'gold', 'hand_r', {
        count: 80,
        style: (p, n, k) => {
          const along = p.z - g0.z;
          if (along > 0.58 * u) return { pal: has('jewel') && Math.abs(Math.sin(p.x * 80 + p.y * 60 + p.z * 40)) > 0.85 ? at('jewel') : k, size: [0.035 * u, 0.07 * u], dir: V(n.y, -n.x, 0.25).normalize() };
          return { pal: k, size: [0.022 * u, 0.09 * u], dir: FWD };
        },
      });
    },
    sword() {
      const g0 = rest.hand_r.clone().lerp(rest.middle_01_r, 0.7);
      // a curved blade, broadening toward the point
      const shape = new THREE.Shape();
      shape.moveTo(-0.022, 0); shape.lineTo(0.022, 0); shape.quadraticCurveTo(0.05, 0.45, 0.02, 0.82); shape.quadraticCurveTo(-0.01, 0.9, -0.05, 0.86); shape.quadraticCurveTo(-0.015, 0.45, -0.022, 0);
      const blade = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false });
      blade.translate(0, 0.1, -0.006);
      blade.rotateY(Math.PI / 2);
      const guard = new THREE.BoxGeometry(0.03, 0.03, 0.13);
      guard.translate(0, 0.09, 0);
      const hilt = new THREE.CylinderGeometry(0.018, 0.02, 0.17, 6);
      const g = mergeGeometries([blade.toNonIndexed(), guard.toNonIndexed(), hilt.toNonIndexed()]);
      g.scale(u, u, u);
      g.rotateX(Math.PI / 2);
      move(g, g0.x, g0.y - 0.02, g0.z);
      piece(g, 'steel', 'hand_r', {
        count: 46,
        style: (p, n, k) => (p.z - g0.z < 0.11 * u ? { pal: at('gold'), size: [0.022 * u, 0.05 * u], dir: FWD } : { pal: k, size: [0.03 * u, 0.16 * u], dir: FWD }),
      });
    },
    club() {
      const g0 = rest.hand_r.clone().lerp(rest.middle_01_r, 0.7);
      const g = new THREE.CylinderGeometry(0.085 * u, 0.028 * u, 0.86 * u, 7, 3);
      g.translate(0, 0.3 * u, 0);
      g.rotateX(Math.PI / 2);
      move(g, g0.x, g0.y - 0.02, g0.z);
      piece(g, 'wood', 'hand_r', { count: 34, size: [0.035 * u, 0.15 * u], dir: FWD });
    },
    bow() { makeBow(); },
    tail() { makeTail(); },
  };

  // --- the bow: held upright in the left hand, turned to where he faces or aims; it rides on no bone ---
  let bow = null;
  function makeBow() {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * 2 - 1;
      pts.push(V(0, t * 0.66 * u, (-0.2 * t * t + 0.035 * Math.pow(Math.abs(t), 6)) * u));
    }
    const limb = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.016 * u, 5);
    const string = new THREE.CylinderGeometry(0.004, 0.004, 1.3 * u, 3);
    string.translate(0, 0, -0.165 * u);
    const g = mergeGeometries([limb, string]);
    const mesh = new THREE.Mesh(g, paint(shared, pal.gold, { grain: 3 }));
    mesh.layers.enable(1);
    mesh.frustumCulled = false;
    group.add(mesh);
    parts.push({ mesh, count: Math.round(50 * detail), style: (p) => (Math.abs(p.z + 0.165 * u) < 0.004 && Math.abs(p.x) < 0.005 ? { pal: at('cloth'), size: [0.008, 0.2 * u], dir: UP } : { pal: at(Math.abs(p.y) < 0.09 * u ? 'jewel' : 'gold'), size: [0.026 * u, 0.1 * u], dir: UP }) });
    const grip = V(0, 0, 0), a = V(0, 0, 0), x = V(0, 0, 0), y = V(0, 0, 0), z = V(0, 0, 0), m = new THREE.Matrix4();
    bow = mesh;
    tick.push((dt, ctx) => {
      grip.setFromMatrixPosition(bones.hand_l.matrixWorld).lerp(a.setFromMatrixPosition(bones.middle_01_l.matrixWorld), 0.7);
      // it faces where he aims, or where he faces; and leans a little with the arm that carries it
      if (ctx?.aim) z.copy(ctx.aim); else z.set(0, 0, 1).transformDirection(object.matrixWorld);
      a.setFromMatrixPosition(bones.lowerarm_l.matrixWorld).sub(grip).normalize();
      y.copy(UP).addScaledVector(a, ctx?.aim ? 0 : -0.25);
      y.addScaledVector(z, -y.dot(z)).normalize();
      x.crossVectors(y, z);
      mesh.matrix.copy(m.makeBasis(x, y, z)).setPosition(grip);
      mesh.matrixAutoUpdate = false;
      mesh.matrixWorld.copy(mesh.matrix);
    });
  }

  // --- a tail: a line of points that follow where the tail should be, each a little later than the last ---
  function makeTail() {
    const N = 13, per = 3, tuft = 5;
    const nodes = Array.from({ length: N }, () => V(0, 0, 0));
    const count = (N - 1) * per + tuft;
    const aPos = new Float32Array(count * 3), aDir = new Float32Array(count * 3), aData = new Float32Array(count * 3);
    const geometry = dabGeometry(count, { aPos: [aPos, 3], aDir: [aDir, 3], aData: [aData, 3] }, true);
    const mesh = dabMesh(geometry, dabMaterial(shared, {
      head: /* glsl */ `in vec3 aPos; in vec3 aDir; in vec3 aData;`,
      body: /* glsl */ `
        void makeDab(inout Dab d) {
          vec4 r = hash4(float(gl_InstanceID) * 2.3 + 4.0);
          float lit = sunAt(aPos + vec3(0.0, 0.1, 0.0)) * (0.55 + 0.4 * r.x);
          vec3 c = paint3(${glsl3(pal.hair[0])}, ${glsl3(pal.hair[1])}, ${glsl3(pal.hair[2])}, lit, r.y);
          c = mix(c, c * 0.45, aData.z);
          c = jitter(c, r.yzw, 0.4);
          c += ${glsl3(pal.hair[3] ?? pal.hair[0])} * uLampCol * lampAt(aPos, vec3(0.0, 1.0, 0.0));
          d.pos = aPos; d.dir = aDir; d.size = aData.xy * (0.85 + 0.3 * r.z);
          d.c1 = hazed(c, aPos); d.c2 = hazed(c * 1.22, aPos);
          d.seed = float(gl_InstanceID); d.lift = 0.3; d.turnabout = 1.0;
        }`,
      minPx: [2.5, 4], maxPx: [200, 400], cells: [0, 6],
    }), 5);
    group.add(mesh);
    const base = V(0, 0, 0), f = V(0, 0, 0), side = V(0, 0, 0), want = V(0, 0, 0), d = V(0, 0, 0);
    let time = 0, started = false;
    tick.push((dt) => {
      time += dt;
      base.setFromMatrixPosition(bones.pelvis.matrixWorld);
      f.set(0, 0, 1).transformDirection(object.matrixWorld);
      side.set(f.z, 0, -f.x);
      const s = object.scale.y * u;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const sway = Math.sin(time * 1.7 + t * 3.0) * 0.1 * t + Math.sin(time * 0.6) * 0.06 * t;
        want.copy(base).addScaledVector(f, -(0.13 + 0.62 * Math.sin(t * 2.3)) * s).addScaledVector(side, sway * s);
        want.y += (-0.12 * Math.sin(t * 3.1) + 1.05 * t * t) * s;
        if (!started || nodes[i].distanceToSquared(want) > 9) nodes[i].copy(want);
        else nodes[i].lerp(want, 1 - Math.exp(-dt * (34 - 26 * t)));
      }
      started = true;
      let o = 0;
      const put = (p, dir, across, along, dark) => { aPos.set([p.x, p.y, p.z], o * 3); aDir.set([dir.x, dir.y, dir.z], o * 3); aData.set([across, along, dark], o * 3); o++; };
      for (let i = 0; i < N - 1; i++) {
        d.subVectors(nodes[i + 1], nodes[i]);
        const len = d.length(), t = i / (N - 1);
        d.normalize();
        for (let k = 0; k < per; k++) {
          want.lerpVectors(nodes[i], nodes[i + 1], (k + 0.5) / per);
          put(want, d, (0.075 - 0.03 * t) * s, Math.max(0.1, len * 1.5), 0);
        }
      }
      for (let k = 0; k < tuft; k++) {
        want.copy(nodes[N - 1]).addScaledVector(d, 0.04 * k * s);
        put(want, d, 0.085 * s, 0.17 * s, 0.6);
      }
      for (const name of ['aPos', 'aDir', 'aData']) geometry.attributes[name].needsUpdate = true;
    });
  }

  for (const name of def.gear ?? []) {
    if (!gear[name]) throw new Error(`no gear ${name}`);
    gear[name]();
  }

  // --- cloth from the shoulders ---
  let cloak = null, clothMesh = null;
  if (cloth && def.cloth) {
    const C = pal[def.cloth.pal];
    cloak = new Cloak(bones, { cols: def.cloth.cols ?? 13, rows: def.cloth.rows ?? 9, wrap: def.cloth.wrap ?? 1.2, body: u * (def.scale ?? 1), drop: 0.088 * u * (def.scale ?? 1) });
    const { cols, rows } = cloak;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(cloak.p, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('normal', new THREE.BufferAttribute(cloak.normals, 3).setUsage(THREE.DynamicDrawUsage));
    const uvs = new Float32Array(cols * rows * 2), index = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        uvs.set([(i / (cols - 1)) * 2.2, (j / (rows - 1)) * 1.6], (i + j * cols) * 2);
        if (i + 1 < cols && j + 1 < rows) { const k = i + j * cols; index.push(k, k + cols, k + 1, k + 1, k + cols, k + cols + 1); }
      }
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    clothMesh = new THREE.Mesh(geometry, paint(shared, C, { grain: 1.4 }));
    clothMesh.frustumCulled = false;
    clothMesh.layers.enable(1);
    group.add(clothMesh);
    const nd = (cols - 1) * (rows - 1);
    const dPos = new Float32Array(nd * 3), dDir = new Float32Array(nd * 3), dNrm = new Float32Array(nd * 3);
    const dabsGeometry = dabGeometry(nd, { aPos: [dPos, 3], aDir: [dDir, 3], aNrm: [dNrm, 3] }, true);
    const border = has('gold') ? pal.gold : C;
    group.add(dabMesh(dabsGeometry, dabMaterial(shared, {
      head: /* glsl */ `in vec3 aPos; in vec3 aDir; in vec3 aNrm;`,
      body: /* glsl */ `
        void makeDab(inout Dab d) {
          vec4 r = hash4(float(gl_InstanceID) * 1.9 + 7.0);
          vec3 Nn = normalize(aNrm);
          if (dot(Nn, cameraPosition - aPos) < 0.0) Nn = -Nn;
          float lit = sunAt(aPos + Nn * 0.1) * clamp(dot(Nn, uSunDir) * 0.85 + 0.42, 0.0, 1.0);
          // the last row of the cloth is its border, in gold
          bool hem = gl_InstanceID >= ${(cols - 1) * (rows - 2)};
          vec3 c = hem ? paint3(${glsl3(border[0])}, ${glsl3(border[1])}, ${glsl3(border[2])}, lit, r.x) : paint3(${glsl3(C[0])}, ${glsl3(C[1])}, ${glsl3(C[2])}, lit, r.x);
          c += uBounce * max(-Nn.y, 0.0) * (1.0 - lit);
          c = jitter(c, r.yzw, 0.35);
          c += ${glsl3(C[3] ?? C[0])} * uLampCol * lampAt(aPos, Nn);
          d.pos = aPos; d.dir = aDir;
          d.size = vec2(${(0.105 * u).toFixed(3)}, ${(0.19 * u).toFixed(3)}) * (0.8 + 0.4 * r.y);
          d.turnabout = 1.0;
          d.c1 = hazed(c, aPos); d.c2 = hazed(c * 1.3 + vec3(0.02, 0.02, 0.0), aPos);
          d.seed = float(gl_InstanceID); d.lift = 0.2;
        }`,
      minPx: [3, 7], maxPx: [200, 500], cells: [0, 4],
    }), 5));
    tick.push((dt, ctx) => {
      cloak.update(dt, ctx.air, ctx.ground);
      const p = cloak.p, nrm = cloak.normals;
      let o = 0;
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = (i + j * cols) * 3, b = a + 3, c = a + cols * 3, e = c + 3;
          dPos[o] = (p[a] + p[b] + p[c] + p[e]) / 4; dPos[o + 1] = (p[a + 1] + p[b + 1] + p[c + 1] + p[e + 1]) / 4; dPos[o + 2] = (p[a + 2] + p[b + 2] + p[c + 2] + p[e + 2]) / 4;
          dDir[o] = p[c] - p[a]; dDir[o + 1] = p[c + 1] - p[a + 1]; dDir[o + 2] = p[c + 2] - p[a + 2];
          dNrm[o] = nrm[a]; dNrm[o + 1] = nrm[a + 1]; dNrm[o + 2] = nrm[a + 2];
          o += 3;
        }
      }
      for (const name of ['aPos', 'aDir', 'aNrm']) dabsGeometry.attributes[name].needsUpdate = true;
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.normal.needsUpdate = true;
    });
  }

  // --- paint on the body itself ---
  const h = body.height / 1.8;
  if (woman) {
    const blouse = find(/sweater/), skirt = find(/skirt/), skin = find(/generic/), hair = find(/braid/), shoes = find(/shoes/);
    // she was modelled with her arms held a little out from her sides: a sleeve runs down the arm
    if (blouse) parts.push({ mesh: blouse, count: Math.round(260 * detail), style: (p) => ({ pal: at('blouse'), size: [0.05 * h, 0.1 * h], dir: Math.abs(p.x) > 0.19 ? V(Math.sign(p.x) * 0.7, -0.7, 0) : UP }) });
    if (skirt) parts.push({ mesh: skirt, count: Math.round(380 * detail), style: (p) => (p.y < 0.13 ? { pal: at('hem'), size: [0.045 * h, 0.07 * h], dir: OUT } : { pal: at('skirt'), size: [0.06 * h, 0.15 * h], dir: UP }) });
    if (skin) parts.push({ mesh: skin, count: Math.round(200 * detail), style: (p, n) => (p.y > rest.neck_01.y ? { pal: at('skin'), size: [0.026 * h, 0.048 * h], dir: new THREE.Vector3().crossVectors(UP, n).add(V(0, 0.3, 0)) } : { pal: at('skin'), size: [0.024 * h, 0.05 * h], dir: DOWN }) });
    if (hair) parts.push({ mesh: hair, count: Math.round(90 * detail), style: () => ({ pal: at('hair'), size: [0.036 * h, 0.08 * h], dir: DOWN }) });
    if (shoes) parts.push({ mesh: shoes, count: Math.round(30 * detail), style: () => ({ pal: at('feet'), size: [0.04 * h, 0.07 * h], dir: FWD }) });
  } else {
    const suit = find(/casualsuit/), skin = find(/generic/), shoes = find(/shoes/), hair = find(/short01/);
    // he was made standing with his arms straight out: a sleeve runs sideways, everything else runs down
    if (suit) parts.push({ mesh: suit, count: Math.round(480 * detail), style: (p) => ({ pal: at(p.y < 0.98 ? 'lower' : 'upper'), size: [0.055, 0.12], dir: Math.abs(p.x) > 0.2 && p.y > 1.3 ? OUT : UP }) });
    if (skin) parts.push({
      mesh: skin, count: Math.round(230 * detail), accept: (p) => p.y > 1.52 || Math.abs(p.x) > 0.37,
      style: (p, n) => (Math.abs(p.x) > 0.37
        ? { pal: at('skin'), size: Math.abs(p.x) > 0.78 ? [0.022, 0.04] : [0.034, 0.08], dir: OUT }
        : { pal: at('skin'), size: [0.028, 0.05], dir: new THREE.Vector3().crossVectors(UP, n).add(V(0, 0.3, 0)) }),
    });
    if (shoes) parts.push({ mesh: shoes, count: Math.round(60 * detail), style: () => ({ pal: at('feet'), size: [0.045, 0.085], dir: FWD }) });
    if (hair) parts.push({ mesh: hair, count: Math.round(50 * detail), style: () => ({ pal: at('hair'), size: [0.035, 0.07], dir: UP }) });
  }
  const pins = pinDabs(shared, names.map((n) => pal[n]), parts);
  group.add(pins.mesh);

  object.scale.set((def.scale ?? 1) * (def.broad ?? 1), def.scale ?? 1, (def.scale ?? 1) * (def.broad ?? 1));
  object.updateMatrixWorld(true);

  // --- posing limbs by hand, over whatever the clips have done ---
  const from = V(0, 0, 0), to = V(0, 0, 0), swing = new THREE.Quaternion(), pq = new THREE.Quaternion(), wq = new THREE.Quaternion();
  /** Turns `bone` so that it points at its `child` along dir (in the character's own frame: +x left, +z ahead). */
  function point(bone, child, dir, weight = 1, frame = object.quaternion) {
    const b = bones[bone];
    from.setFromMatrixPosition(bones[child].matrixWorld).sub(to.setFromMatrixPosition(b.matrixWorld)).normalize();
    to.copy(dir).normalize().applyQuaternion(frame);
    swing.setFromUnitVectors(from, to);
    b.parent.getWorldQuaternion(pq); b.getWorldQuaternion(wq);
    pq.invert().multiply(swing.multiply(wq));
    b.quaternion.slerp(pq, weight);
    b.updateMatrixWorld(true);
  }

  return {
    def, body, object, group, bones, pal, bow, cloak, pins,
    point,
    /** After the body has been posed for this frame: cloth, tail, bow, and the paint that rides on it all. */
    update(dt, ctx) {
      for (const f of tick) f(dt, ctx);
      pins.update();
    },
    show(visible) { object.visible = group.visible = visible; },
  };
}
