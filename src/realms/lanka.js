// Lanka by night: an island of black rock in a dark sea, walled in gold, lit by its own fires. A road climbs from
// the shore through a lower court to the gate, and beyond the gate lies the great court before Ravana's palace,
// where he waits. Everything is made in code; the fires light whatever is near them (uFires), as the lantern
// does in the reference's night.
import * as THREE from 'three';
import { makeLand } from '../game/land.js';
import { makeCarpet } from '../game/ground.js';
import { makeBuilder, DAYLIGHT } from '../game/build.js';
import { makeSky } from '../game/sky.js';
import { createMotes } from '../game/motes.js';
import { createBeacons } from '../game/glow.js';
import { byFire, FOES } from '../game/cast.js';
import { noise } from '../world/noise.js';

export const info = { id: 'lanka', far: 3000 };

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const LOW = 3, HIGH = 7, FLOOR = 10; // the lower court, the great court, the palace floor

// what the fires do to a spot that faces n: every painted thing here asks
const FIRES = /* glsl */ `
uniform vec4 uFires[10];
float fireAt(vec3 P, vec3 Nn) {
  float sum = 0.0;
  for (int i = 0; i < 10; i++) {
    vec3 to = uFires[i].xyz - P;
    float d2 = dot(to, to);
    sum += uFires[i].w * clamp(dot(Nn, to) * inversesqrt(d2 + 1e-4) * 0.6 + 0.5, 0.0, 1.0) / (1.0 + d2 * 0.035);
  }
  return min(sum, 1.4) * (0.86 + 0.14 * sin(uTime * 8.0 + P.x * 2.3 + P.z * 1.7));
}`;

// by moonlight: [light, half-tone, shade], and each thing's own colour for the fires to find
const PALETTES = {
  gold: { l: [0.62, 0.52, 0.3], m: [0.3, 0.24, 0.17], s: [0.1, 0.08, 0.1], own: [1.0, 0.8, 0.34] },
  basalt: { l: [0.2, 0.22, 0.3], m: [0.09, 0.1, 0.16], s: [0.03, 0.035, 0.07], own: [0.5, 0.4, 0.36] },
  crimson: { l: [0.4, 0.1, 0.14], m: [0.2, 0.05, 0.09], s: [0.08, 0.02, 0.06], own: [0.95, 0.2, 0.14] },
  dark: { l: [0.07, 0.06, 0.09], m: [0.035, 0.03, 0.05], s: [0.015, 0.012, 0.03], own: [0.2, 0.12, 0.1] },
  ember: { l: [1.0, 0.5, 0.14], glow: true },
};

export async function build({ shared, say, turn }) {
  shared.uSunDir.value.set(-0.5, 0.5, 0.7).normalize(); // the moon, over the sea behind those who come
  shared.uHaze.value.setRGB(0.1, 0.055, 0.075);
  shared.uHazeSun.value.setRGB(0.16, 0.12, 0.16);
  shared.uHazeGlow.value.setRGB(0.03, 0.03, 0.05);
  shared.uHazeDensity.value = 0.0032;
  shared.uBounce.value.setRGB(0.1, 0.035, 0.01);
  shared.uLampCol.value.setRGB(1.0, 0.72, 0.4);
  shared.uGlazeMul.value.setRGB(0.4, 0.3, 0.4);
  shared.uGlazeAdd.value.setRGB(0.01, 0.0, 0.02);
  shared.uFires = { value: Array.from({ length: 10 }, () => new THREE.Vector4(0, -100, 0, 0)) };

  // --- the island: terraces up from the shore, falling to the sea on both hands, the peak behind ---
  const terrace = (x, z) => {
    if (z > 44) return LOW - (LOW - 1) * sstep(92, 104, z) - 6 * sstep(118, 136, z);
    if (z > 36 && Math.abs(x) < 7) return HIGH + (LOW - HIGH) * (z - 36) / 8;
    if (z > -50) return z > 42 ? LOW : HIGH;
    if (z > -58 && Math.abs(x) < 11) return FLOOR + (HIGH - FLOOR) * (z + 58) / 8;
    return z > -54 ? HIGH : FLOOR;
  };
  const land = await makeLand(shared, {
    height(x, z) {
      const ax = Math.abs(x);
      let h = terrace(x, z);
      const flank = sstep(40, 96, ax);
      h += (4 * noise(x / 21 + 3, z / 21) + 1.5 * noise(x / 7, z / 7 + 5)) * sstep(37, 52, ax) * (1 - flank);
      h = h + (-5 - h) * flank;
      // Trikuta, the three-peaked hill the city is built against
      h += 70 * sstep(-104, -190, z) * (1 - sstep(60, 150, ax)) * (0.8 + 0.3 * noise(x / 40, z / 40));
      return h;
    },
    cover(x, z, h) {
      const ax = Math.abs(x);
      const road = (ax < 4.6 && z > 36 && z < 112) || (ax < 34 && z <= 36 && z > -50) || (ax < 30 && z <= -50 && z > -104);
      return [road && h > 0.5 ? 1 : 0, 0.5 + 0.5 * noise(x / 13, z / 13 + 2), 0.5 + 0.5 * noise(x / 31 + 7, z / 31), 1 - sstep(-0.2, 0.5, h)];
    },
    pause: (done) => { say(0.45 * done, 'Raising the island'); return turn(); },
    head: FIRES,
    under: /* glsl */ `
      vec3 underpaint(vec3 P, vec4 m, float lit) {
        vec3 rock = mix(vec3(0.02, 0.025, 0.05), vec3(0.09, 0.1, 0.15), lit);
        vec3 paved = mix(vec3(0.07, 0.055, 0.06), vec3(0.24, 0.2, 0.15), lit);
        vec3 c = mix(rock, paved, m.r);
        c += mix(vec3(0.4, 0.3, 0.26), vec3(0.95, 0.72, 0.3), m.r) * vec3(1.0, 0.55, 0.2) * fireAt(P, vec3(0.0, 1.0, 0.0)) * 0.6;
        return mix(c, vec3(0.02, 0.035, 0.06), m.a);
      }`,
  });
  const heightAt = land.heightAt;
  const carpet = makeCarpet(shared, {
    head: FIRES,
    paint: /* glsl */ `
      vec3 groundPaint(vec2 xz, vec3 P, vec3 Nn, vec4 m, float lit, vec4 q, out vec3 c2) {
        vec4 s = hash4(floor(xz / 1.8), 3.0);
        vec3 rock = paint3(vec3(0.17, 0.2, 0.28), vec3(0.07, 0.085, 0.14), vec3(0.025, 0.03, 0.065), lit, q.y) * (0.75 + 0.5 * m.g);
        // the paving is plates of gold, dull under the moon
        vec3 paved = paint3(vec3(0.5, 0.42, 0.26), vec3(0.24, 0.2, 0.15), vec3(0.09, 0.07, 0.09), lit, q.y) * (0.8 + 0.4 * s.x);
        vec3 own = mix(vec3(0.45, 0.34, 0.3), vec3(1.0, 0.78, 0.32) * (0.8 + 0.4 * s.x), step(0.5, m.r));
        vec3 c = mix(rock, paved, step(0.5, m.r));
        float f = fireAt(P, Nn);
        c += own * vec3(1.0, 0.55, 0.2) * f;
        c += own * uLampCol * lampAt(P, Nn);
        // the sea: black, with the fires of the city lying on it in broken streaks
        float streak = smoothstep(0.5, 0.82, texture(tNoise, xz / vec2(7.0, 38.0) + vec2(uTime * 0.01, 0.0)).r);
        vec3 water = mix(vec3(0.015, 0.03, 0.06), vec3(0.5, 0.2, 0.06), streak * smoothstep(150.0, 40.0, abs(xz.x)) * 0.8) + vec3(0.06, 0.07, 0.1) * step(0.9, q.w) * lit;
        c = mix(c, water, step(0.5, m.a));
        c2 = c * 1.15;
        return c;
      }`,
    grain: 'if (m.a > 0.5) d.dir = vec3(0.1 * sin(xz.x * 0.2), 0.0, 1.0);',
  });

  say(0.5, 'Raising the walls of gold');
  await turn();
  const b = makeBuilder(shared, {
    palettes: PALETTES, seed: 665, head: FIRES,
    light: DAYLIGHT('c += PAL_O[k] * vec3(1.0, 0.55, 0.2) * fireAt(P, Nn) * tone;'),
  });
  const k = b.kit;
  const big = { stroke: [0.6, 1.8] };
  const fires = [];
  /** A brazier: a stand and a bowl, and a fire in it that lights what is near. */
  const brazier = (x, z, size = 1.6) => {
    const y = heightAt(x, z);
    b.pillar(x, y, z, 0.3, 1.9, 'basalt', { trim: 'gold' });
    k.round(x, y + 2.05, z, 0.45, 0.34, 'gold', { top: 0.75, stroke: [0.12, 0.3] });
    fires.push({ x, y: y + 2.5, z, size });
  };
  for (const z of [106, 78, 54]) for (const x of [-6.5, 6.5]) brazier(x, z);
  for (const [x, z] of [[-15, 16], [15, 16], [-15, -30], [15, -30]]) brazier(x, z, 2.1);

  // the wall across the island at the top of the stair, and the gate through it between two towers
  const wall = { merlons: 3, cap: 'gold', stroke: [0.6, 1.7] };
  b.wall(-52, 40, -11, 40, HIGH - 4, 13, 2.4, 'basalt', wall);
  b.wall(11, 40, 52, 40, HIGH - 4, 13, 2.4, 'basalt', wall);
  for (const x of [-10, 10]) {
    b.block(x, HIGH + 6, 40, 7, 20, 7, 'gold', big);
    b.spire(x, HIGH + 16, 40, 3.6, 12, 'gold', { finial: 'ember' });
    k.box(x, HIGH + 9, 43.6, 1.6, 2.6, 0.2, 'ember', { stroke: [0.3, 0.5] });
  }
  b.block(0, HIGH + 9.5, 40, 13, 3, 3.2, 'gold', { solid: false, grain: 'x' });
  for (const s of [1, -1]) k.tri([s * 6.5, HIGH + 8, 41.7], [s * 6.5, HIGH + 2, 41.7], [s * 3.4, HIGH + 7, 41.7], 'crimson', { stroke: [0.3, 0.8] });
  // walls down either side of the great court
  b.wall(-36, 39, -36, -104, HIGH - 1, 8, 2, 'basalt', wall);
  b.wall(36, 39, 36, -104, HIGH - 1, 8, 2, 'basalt', wall);
  // pillars of gold along the court, each with a banner
  for (const z of [22, 4, -14, -32]) for (const x of [-27, 27]) {
    b.pillar(x, HIGH, z, 0.7, 11, 'gold', { trim: 'basalt' });
    const s = x > 0 ? -1 : 1;
    k.tri([x + s * 0.8, HIGH + 10, z], [x + s * 0.8, HIGH + 4, z], [x + s * 3.2, HIGH + 8.6, z], 'crimson', { stroke: [0.3, 0.9] });
    k.tri([x + s * 0.8, HIGH + 4, z], [x + s * 0.8, HIGH + 10, z], [x + s * 3.2, HIGH + 8.6, z], 'crimson', { stroke: [0.3, 0.9] });
  }
  // the palace: three storeys of gold drawing in, a porch of pillars, a burning door, and the spires
  b.block(0, FLOOR / 2 + 3.4, -81, 62, FLOOR - HIGH + 0.2, 46, 'basalt', { ...big, solid: false, grain: 'x' });
  for (let i = 0; i < 10; i++) k.box(0, HIGH + (i + 0.5) * 0.3, -50 - (i + 0.5) * 0.8, 21, 0.3, 0.82, i % 2 ? 'gold' : 'basalt', { stroke: [0.25, 0.9], grain: 'x' });
  b.block(0, FLOOR + 6.5, -86, 48, 13, 28, 'gold', { ...big, grain: 'x' });
  b.block(0, FLOOR + 16.5, -88, 34, 7, 20, 'gold', { ...big, solid: false, grain: 'x' });
  b.block(0, FLOOR + 22.5, -89, 20, 5, 13, 'gold', { ...big, solid: false, grain: 'x' });
  b.spire(0, FLOOR + 25, -89, 6.5, 24, 'gold', { finial: 'ember' });
  for (const [x, z] of [[-19, -76], [19, -76], [-19, -97], [19, -97]]) b.spire(x, FLOOR + 13, z, 3.8, 15, 'gold', { finial: 'ember' });
  for (let x = -20; x <= 20; x += 8) b.pillar(x, FLOOR, -66.5, 0.7, 10, 'gold', { trim: 'basalt' });
  b.block(0, FLOOR + 10.6, -69, 50, 1.2, 8, 'basalt', { solid: false, grain: 'x' });
  k.box(0, FLOOR + 4.2, -71.9, 6.4, 8.4, 0.3, 'ember', { stroke: [0.5, 0.9], density: 1.2 });
  for (const x of [-14, 14]) k.box(x, FLOOR + 5, -71.9, 2.4, 4, 0.3, 'ember', { stroke: [0.4, 0.7] });
  // Ravana's seat before his door
  b.block(0, HIGH + 0.4, -44, 12, 0.8, 7, 'gold', { stroke: [0.4, 1.0] });
  const built = b.build();

  fires.slice(0, 10).forEach((f, i) => shared.uFires.value[i].set(f.x, f.y, f.z, f.size * 0.75));
  const beacons = createBeacons(shared);
  for (const f of fires) beacons.add(f.x, f.y - 0.1, f.z, { color: [1.0, 0.45, 0.12], size: f.size });

  const sky = makeSky(shared, /* glsl */ `
    vec3 skyColour(vec3 v) {
      float up = clamp(v.y, 0.0, 1.0);
      vec3 c = mix(vec3(0.07, 0.045, 0.1), vec3(0.012, 0.016, 0.05), pow(up, 0.6));
      // the city burns: its light stands in the smoke over it, to the north
      float north = max(-v.z, 0.0) / max(length(v.xz), 1e-4);
      c += vec3(0.5, 0.15, 0.04) * north * north * exp(-pow(up / 0.24, 2.0));
      c += vec3(0.16, 0.05, 0.03) * exp(-pow(up / 0.1, 2.0));
      float moon = max(dot(v, uSunDir), 0.0);
      c += vec3(0.12, 0.13, 0.18) * pow(moon, 40.0) + vec3(0.9, 0.9, 0.84) * smoothstep(0.9993, 0.9996, moon);
      return mix(airColour(v), c, smoothstep(-0.02, 0.05, v.y));
    }`, { count: 2200, seed: 77 });
  const embers = createMotes(shared, 'embers', 1500);

  const shade = new THREE.Scene();
  shade.add(land.caster, new THREE.Mesh(built.under.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));

  const LOWER = [-30, 30, 45, 116], UPPER = [-33, 33, -49, 34];
  let ravana = null, phase = 'shore', summoned = false, left = -1, won = false;
  return {
    id: 'lanka', name: 'Lanka', subtitle: 'The city of gold',
    heightAt, heightField: land.heightField,
    spawn: { x: 0, z: 112, yaw: Math.PI },
    add: [sky.group, land.mesh, carpet.group, built.group, beacons.mesh, embers],
    shade: { scene: shade, options: { sun: shared.uSunDir.value, size: [4096, 4096], box: [150, 160], centre: [0, 10, 0], back: 340, near: 30, far: 760 } },
    solids: b.solids,
    follow: (x, z) => carpet.follow(x, z),
    light: byFire,
    lamp: 0.55,
    wind: 0.8,
    camera: { pitch: 0.0, lift: 1.2 },
    keep: (x, z, foe) => !foe.zone || (x > foe.zone[0] && x < foe.zone[1] && z > foe.zone[2] && z < foe.zone[3]),
    outside: (feet) => feet.y < -0.6 || Math.abs(feet.x) > 150 || Math.abs(feet.z) > 190,
    quality(low) { embers.geometry.instanceCount = low ? 600 : 1500; },
    begin(game) {
      const put = (variant, x, z, zone, aggro = 26) => { const f = game.spawnFoe(FOES.rakshasa(variant), x, z, { yaw: 0, aggro }); f.zone = zone; return f; };
      // the shore road, the lower court, and the watch on the great court
      put(0, -3, 92, LOWER); put(1, 3, 88, LOWER); put(2, 0, 84, LOWER);
      put(3, -6, 62, LOWER); put(0, 6, 60, LOWER); put(1, -3, 52, LOWER, 22); put(2, 3, 50, LOWER, 22);
      put(3, -12, 20, UPPER, 30); put(1, 12, 18, UPPER, 30); put(0, 0, 8, UPPER, 30);
      ravana = game.spawnFoe(FOES.ravana, 0, -41, { yaw: 0, boss: true, aggro: 34, ranged: { cooldown: 4.2 } });
      ravana.zone = UPPER;
      ravana.onThrow = (foe) => {
        const from = new THREE.Vector3(foe.pos.x, foe.pos.y + foe.height * 0.75, foe.pos.z);
        const to = new THREE.Vector3(game.feet.x, game.feet.y + 1.1, game.feet.z).sub(from).normalize();
        game.combat.shoot({ kind: 'fire', pos: from.addScaledVector(to, 1.2), dir: to, speed: 17, damage: 15 });
      };
      ravana.onDeath = () => {
        won = true;
        game.hud.boss(null);
        game.objective('');
        game.say('Ravana falls, and with him the night. Across the sea, Ayodhya is lighting its lamps.', 8);
        game.fx.rise(new THREE.Vector3(0, HIGH, -30), [1.0, 0.85, 0.5], { count: 60, spread: 12, life: 3 });
        setTimeout(() => game.finish('ending'), 5200);
      };
      game.objective('Fight up the road to the gate of Lanka');
      game.say('The sea is behind you. Ahead the road climbs between fires to a gate of gold.', 7);
    },
    onRespawn(game) { if (ravana?.alive) ravana.health = Math.max(ravana.health, ravana.maxHealth * 0.5); },
    update(dt, time, game) {
      const feet = game.feet;
      if (won) return;
      if (phase === 'shore') {
        const n = game.foes.alive().filter((f) => f.zone === LOWER).length;
        if (n !== left) { left = n; game.objective(n ? `Fight up the road to the gate of Lanka (${n} guards)` : 'Pass through the gate'); }
        if (feet.z < 34) {
          phase = 'court';
          game.checkpoint(0, 30, Math.PI);
          game.objective('Cross the great court');
          game.say('Beyond the gate the court lies open, and at its end a figure with too many heads sits waiting.', 7);
        }
      } else if (phase === 'court') {
        if (ravana.awake || feet.z < -8) {
          phase = 'ravana';
          ravana.awake = true;
          game.checkpoint(0, 14, Math.PI);
          game.objective('Defeat Ravana');
          game.say('Ravana: "Ten heads have looked on every weapon in the three worlds. Show me yours."', 7);
        }
      } else if (phase === 'ravana' && ravana) {
        game.hud.boss(ravana.alive ? 'Ravana' : null, ravana.health, ravana.maxHealth);
        if (!summoned && ravana.alive && ravana.health < ravana.maxHealth * 0.5) {
          summoned = true;
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2, x = ravana.pos.x + Math.cos(a) * 7, z = Math.max(-46, Math.min(30, ravana.pos.z + Math.sin(a) * 7));
            const f = game.spawnFoe(FOES.rakshasa(i + 1), Math.max(-30, Math.min(30, x)), z, { aggro: 60 });
            f.zone = UPPER; f.awake = true;
            game.fx.rise(f.pos, [1.0, 0.4, 0.1], { count: 14, spread: 0.6 });
          }
          game.say('Ravana laughs with all his mouths, and the court fills with his guard.', 6);
        }
      }
    },
  };
}
