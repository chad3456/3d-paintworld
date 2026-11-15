// Ayodhya at sunrise: the palace on its plinth, the great court before it, the walls and the gate, the city's flat
// roofs beyond them and the Sarayu shining to the east. Everything here is made in code and painted in strokes:
// the buildings with the kit for made things (src/game/build.js), the ground with dabs that lie on it.
//
// The look follows the palace in the background of Raja Ravi Varma's prints: cream sandstone arcades, a dark
// dome, a pale spire (see CREDITS.md).
import * as THREE from 'three';
import { makeLand } from '../game/land.js';
import { makeCarpet, makeTufts } from '../game/ground.js';
import { makeBuilder } from '../game/build.js';
import { makeSky } from '../game/sky.js';
import { createMotes } from '../game/motes.js';
import { createBeacons } from '../game/glow.js';
import { createNpc } from '../game/npc.js';
import { HEROES } from '../game/cast.js';
import { noise, rng } from '../world/noise.js';

export const info = { id: 'ayodhya', far: 3000 };

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const TOP = 2.4; // the palace floor above the court

const PALETTES = {
  sand: { l: [1.0, 0.86, 0.62], m: [0.8, 0.6, 0.43], s: [0.45, 0.31, 0.32] },
  white: { l: [1.0, 0.97, 0.9], m: [0.82, 0.76, 0.72], s: [0.48, 0.44, 0.53] },
  red: { l: [0.9, 0.45, 0.32], m: [0.66, 0.28, 0.22], s: [0.34, 0.14, 0.17] },
  gold: { l: [1.0, 0.85, 0.36], m: [0.86, 0.58, 0.15], s: [0.48, 0.28, 0.12] },
  slate: { l: [0.46, 0.5, 0.62], m: [0.26, 0.29, 0.4], s: [0.12, 0.13, 0.22] },
  saffron: { l: [1.0, 0.56, 0.12], m: [0.82, 0.34, 0.08], s: [0.46, 0.17, 0.1] },
  dark: { l: [0.24, 0.16, 0.15], m: [0.12, 0.08, 0.1], s: [0.05, 0.035, 0.06] },
  rose: { l: [0.98, 0.72, 0.62], m: [0.78, 0.48, 0.42], s: [0.42, 0.25, 0.28] },
};

export async function build({ shared, say, turn }) {
  shared.uSunDir.value.set(0.52, 0.44, 0.73).normalize();
  shared.uHaze.value.setRGB(0.72, 0.66, 0.7);
  shared.uHazeSun.value.setRGB(1.0, 0.78, 0.5);
  shared.uHazeGlow.value.setRGB(0.1, 0.07, 0.02);
  shared.uHazeDensity.value = 0.0017;
  shared.uBounce.value.setRGB(0.13, 0.085, 0.03);

  // --- the ground: the court level, the palace floor above it with a ramp of steps, the river to the east ---
  const inWalls = (x, z) => Math.abs(x) < 45 && z > -84 && z < 75;
  const land = await makeLand(shared, {
    height(x, z) {
      let h = 0;
      if (Math.abs(x) < 30.5 && z < -37 && z > -84) h = TOP;
      else if (Math.abs(x) < 12.5 && z <= -31 && z >= -37) h = TOP * (-31 - z) / 6;
      const out = Math.max(Math.abs(x) - 47, z - 78, -z - 86, 0);
      h += (1.1 * noise(x / 37 + 2, z / 37) + 0.3 * noise(x / 9, z / 9)) * sstep(0, 24, out) * (Math.abs(x) < 7 && z > 70 ? 0.15 : 1);
      return h + (-3.2 - h) * sstep(80, 96, x);
    },
    cover(x, z) {
      const road = Math.abs(x) < 5.5 && z >= 74 ? 1 : 0;
      return [inWalls(x, z) || road ? 1 : 0, inWalls(x, z) || road ? 0 : 1, 0.5 + 0.5 * noise(x / 15 + 4, z / 15), sstep(86, 91, x)];
    },
    pause: (done) => { say(0.45 * done, 'Laying the court'); return turn(); },
    under: /* glsl */ `
      vec3 underpaint(vec3 P, vec4 m, float lit) {
        vec3 stone = mix(vec3(0.44, 0.31, 0.32), vec3(0.82, 0.63, 0.45), lit);
        vec3 grass = mix(vec3(0.14, 0.25, 0.17), vec3(0.5, 0.58, 0.2), lit);
        vec3 c = mix(grass, stone, m.r);
        return mix(c, vec3(0.3, 0.46, 0.6), m.a);
      }`,
  });
  const heightAt = land.heightAt;
  const carpet = makeCarpet(shared, {
    paint: /* glsl */ `
      vec3 groundPaint(vec2 xz, vec3 P, vec3 Nn, vec4 m, float lit, vec4 q, out vec3 c2) {
        // paving in slabs of sandstone, each a little its own colour, with flowers strewn on it for the day
        vec4 s = hash4(floor(xz / 2.0), 3.0);
        vec3 stone = paint3(vec3(1.0, 0.87, 0.66), vec3(0.78, 0.58, 0.44), vec3(0.42, 0.3, 0.33), lit, q.y) * (0.86 + 0.26 * s.x);
        float strewn = smoothstep(0.5, 0.75, texture(tNoise, xz / 11.0).g);
        if (q.w > 0.985 - 0.1 * strewn) stone = mix(vec3(1.0, 0.6, 0.1), vec3(0.96, 0.32, 0.34), step(0.7, q.z)) * (0.5 + 0.5 * lit);
        vec3 grass = paint3(vec3(0.72, 0.8, 0.28), vec3(0.4, 0.52, 0.18), vec3(0.13, 0.25, 0.17), lit, q.y);
        grass = mix(grass, paint3(vec3(0.9, 0.78, 0.4), vec3(0.62, 0.5, 0.26), vec3(0.3, 0.24, 0.2), lit, q.x), smoothstep(0.55, 0.8, m.b));
        // the river gives back the sky in long streaks
        float shine = smoothstep(0.42, 0.78, texture(tNoise, xz / vec2(9.0, 46.0) + vec2(0.0, uTime * 0.012)).r);
        vec3 water = mix(vec3(0.22, 0.4, 0.56), vec3(0.98, 0.86, 0.68), shine * (0.4 + 0.6 * lit));
        vec3 c = mix(grass, stone, step(0.5, m.r));
        c = mix(c, water, step(0.5, m.a));
        c2 = c * 1.12;
        return c;
      }`,
    grain: 'if (m.a > 0.5) d.dir = vec3(0.12 * sin(xz.y * 0.1), 0.0, 1.0);',
  });
  const tufts = makeTufts(shared, {
    tuft: /* glsl */ `
      bool tuftAt(vec2 foot, vec4 m, vec4 q, out vec3 L, out vec3 M, out vec3 S, out float tall, out float wide) {
        if (m.r > 0.3 || m.a > 0.2 || q.x > 0.5) return false;
        bool flower = q.y > 0.86;
        L = flower ? vec3(1.0, 0.7, 0.16) : vec3(0.78, 0.88, 0.34); M = flower ? vec3(0.9, 0.44, 0.1) : vec3(0.44, 0.6, 0.2); S = flower ? vec3(0.5, 0.22, 0.1) : vec3(0.15, 0.28, 0.16);
        tall = flower ? 0.3 : 0.5; wide = flower ? 0.09 : 0.045;
        return true;
      }`,
  });

  // --- the palace, the walls and the gate ---
  say(0.5, 'Raising the palace');
  await turn();
  const b = makeBuilder(shared, { palettes: PALETTES, seed: 211 });
  const k = b.kit;
  const big = { stroke: [0.55, 1.7] };
  // the plinth (the land under it is what is stood on) and the steps up to it
  b.block(0, TOP / 2 - 0.05, -60.5, 61, TOP, 47, 'red', { ...big, grain: 'x', solid: false });
  for (let i = 0; i < 8; i++) k.box(0, (i + 0.5) * 0.3 - 0.06, -31 - (i + 0.5) * 0.75, 25, 0.3, 0.76, i % 2 ? 'sand' : 'white', { stroke: [0.25, 0.9], grain: 'x' });
  for (const x of [-13.2, 13.2]) b.block(x, 1.4, -34, 1.4, 2.8, 6.4, 'sand', { stroke: [0.3, 0.8] });
  // the hall, its porch of pillars, and the roof over the porch
  b.block(0, TOP + 5, -68, 54, 10, 26, 'sand', { ...big, grain: 'x' });
  for (let x = -24; x <= 24; x += 6) b.pillar(x, TOP, -41.5, 0.55, 8, 'white', { trim: 'gold' });
  b.block(0, TOP + 8.6, -48.2, 57, 1.2, 15.4, 'red', { ...big, grain: 'x', solid: false });
  b.wall(-28.5, -40.6, 28.5, -40.6, TOP + 9.2, 0.5, 0.6, 'sand', { merlons: 2.4, cap: 'white', solid: false, stroke: [0.3, 0.8] });
  // the door, and the tall windows either side of it
  k.box(0, TOP + 3.2, -54.9, 5, 6.4, 0.3, 'dark', { stroke: [0.4, 0.9] });
  k.box(0, TOP + 6.7, -54.85, 6.2, 0.6, 0.4, 'gold', { stroke: [0.2, 0.6] });
  for (const x of [-2.8, 2.8]) k.box(x, TOP + 3.2, -54.85, 0.6, 6.4, 0.4, 'gold', { stroke: [0.2, 0.6], grain: 'y' });
  for (const x of [-20, -13, 13, 20]) { k.box(x, TOP + 4.2, -54.9, 2.2, 4.4, 0.3, 'slate', { stroke: [0.3, 0.7] }); k.box(x, TOP + 6.6, -54.85, 2.8, 0.4, 0.4, 'white', { stroke: [0.2, 0.5] }); }
  // the roof: a drum and the great dome, two lesser domes, two spires behind, a pavilion at each front corner
  b.block(0, TOP + 11, -68, 19, 2, 19, 'white', { ...big, solid: false });
  b.dome(0, TOP + 12, -68, 9, 'slate', { finial: 'gold', tall: 1.12 });
  for (const x of [-19, 19]) { b.block(x, TOP + 10.6, -68, 9, 1.2, 9, 'sand', { solid: false }); b.dome(x, TOP + 11.2, -68, 4.2, 'gold'); }
  for (const x of [-22, 22]) { b.block(x, TOP + 8, -79.5, 9, 16, 5, 'sand', { solid: false, ...big }); b.spire(x, TOP + 16, -79.5, 4.6, 19, 'white', { finial: 'gold' }); }
  for (const x of [-25, 25]) {
    for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) k.round(x + dx, TOP + 11.4, -44 + dz, 0.16, 2.6, 'white', { stroke: [0.1, 0.5] });
    b.block(x, TOP + 12.85, -44, 3.6, 0.3, 3.6, 'red', { solid: false });
    b.dome(x, TOP + 13, -44, 1.7, 'gold');
  }
  // the walls of the court, and the gate in the south wall between its two towers
  const wall = { merlons: 3.2, cap: 'red', stroke: [0.6, 1.8] };
  b.wall(-46, -85, -46, 77, 0, 6, 1.8, 'sand', wall);
  b.wall(46, -85, 46, 77, 0, 6, 1.8, 'sand', wall);
  b.wall(-46, -85, 46, -85, 0, 6, 1.8, 'sand', wall);
  b.wall(-46, 76, -12, 76, 0, 6, 1.8, 'sand', wall);
  b.wall(12, 76, 46, 76, 0, 6, 1.8, 'sand', wall);
  for (const x of [-9, 9]) {
    b.block(x, 7.5, 76, 7.4, 15, 7.4, 'red', big);
    b.block(x, 15.3, 76, 8.4, 0.6, 8.4, 'white', { solid: false });
    b.dome(x, 15.6, 76, 3.5, 'white', { finial: 'gold' });
    k.box(x, 9.5, 79.75, 2.2, 3.4, 0.2, 'slate', { stroke: [0.3, 0.6] });
    k.box(x, 9.5, 72.25, 2.2, 3.4, 0.2, 'slate', { stroke: [0.3, 0.6] });
  }
  b.block(0, 11.2, 76, 11, 3.2, 3.4, 'sand', { solid: false, grain: 'x' });
  b.block(0, 13.1, 76, 11.6, 0.6, 4, 'gold', { solid: false, grain: 'x', stroke: [0.3, 0.9] });
  // pennants on the towers and the palace
  const flag = (x, y, z, s = 1) => {
    k.round(x, y + 2.6 * s, z, 0.07, 5.2 * s, 'gold', { stroke: [0.06, 0.6] });
    for (const f of [1, -1]) k.tri([x, y + 5.1 * s, z], [x, y + 3.7 * s, z], f > 0 ? [x - 2.1 * s, y + 4.3 * s, z + 0.5 * s] : [x - 2.1 * s, y + 4.3 * s, z + 0.5 * s], 'saffron', { stroke: [0.2, 0.5] });
    k.tri([x, y + 3.7 * s, z], [x, y + 5.1 * s, z], [x - 2.1 * s, y + 4.3 * s, z + 0.5 * s], 'saffron', { stroke: [0.2, 0.5] });
  };
  flag(-9, 19.8, 76); flag(9, 19.8, 76); flag(0, TOP + 23.2, -68, 1.3);
  // the lamps of the court: a stone stand and a bowl of gold on each
  const LAMPS = [[-17, -12], [17, -12], [-24, 26], [24, 26], [0, 50]];
  for (const [x, z] of LAMPS) {
    b.pillar(x, 0, z, 0.26, 2.3, 'sand', { trim: 'red' });
    k.round(x, 2.45, z, 0.34, 0.3, 'gold', { top: 0.56, stroke: [0.1, 0.25] });
  }
  // small shrines in the corners of the court
  for (const [x, z] of [[-34, 58], [34, 58]]) {
    b.block(x, 0.4, z, 7, 0.8, 7, 'white', { stroke: [0.3, 0.9] });
    for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) b.pillar(x + dx, 0.8, z + dz, 0.26, 3.6, 'white', { trim: 'gold' });
    b.block(x, 4.7, z, 7.2, 0.6, 7.2, 'red', { solid: false });
    b.dome(x, 5.0, z, 3.0, 'gold');
  }
  // the city: flat-roofed houses beyond the west wall and down the road from the gate
  const rand = rng(909);
  const tints = ['sand', 'white', 'rose', 'sand', 'red'];
  for (let i = 0; i < 46; i++) {
    const west = i < 26;
    const x = west ? -58 - rand() * 90 : (rand() < 0.5 ? -1 : 1) * (16 + rand() * 70), z = west ? -90 + rand() * 180 : 92 + rand() * 90;
    const w = 6 + rand() * 7, d = 6 + rand() * 7, h = 3.5 + rand() * 5.5, y = heightAt(x, z) - 0.3;
    b.block(x, y + h / 2, z, w, h, d, tints[Math.floor(rand() * tints.length)], { stroke: [0.7, 1.6], solid: false, rotY: (rand() - 0.5) * 0.5 });
    if (rand() < 0.35) b.dome(x, y + h, z, Math.min(w, d) * 0.3, rand() < 0.5 ? 'white' : 'gold', { finial: false });
  }
  const built = b.build();

  const sky = makeSky(shared, /* glsl */ `
    vec3 skyColour(vec3 v) {
      float sunward = max(dot(v, uSunDir), 0.0);
      vec3 high = mix(vec3(0.36, 0.56, 0.88), vec3(0.62, 0.74, 0.9), sunward * sunward);
      vec3 c = mix(airColour(v), high, smoothstep(0.0, 0.7, v.y));
      // rose and gold lie along the horizon at this hour
      c = mix(c, vec3(1.0, 0.72, 0.5), (1.0 - smoothstep(0.0, 0.3, v.y)) * 0.5);
      return mix(c, vec3(1.0, 0.95, 0.78), pow(sunward, 70.0) * 0.9);
    }`);
  const petals = createMotes(shared, 'petals', 1500);
  const beacons = createBeacons(shared);
  const lamps = LAMPS.map(([x, z]) => ({ x, z, lit: false, flame: beacons.add(x, 2.72, z, { color: [1.0, 0.6, 0.2], size: 1.25, lit: 0 }) }));
  const gate = beacons.add(0, 0.6, 77, { color: [1.0, 0.85, 0.5], size: 1.5, shaft: true, lit: 0 });

  const shade = new THREE.Scene();
  shade.add(land.caster, new THREE.Mesh(built.under.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));

  const npcs = [];
  const LINES = {
    rama: 'Rama: "A father\'s word is kept by his son. There is no sorrow in it. Come."',
    sita: 'Sita: "The forest holds no fear for me. Where you walk, I walk."',
    lakshmana: 'Lakshmana: "I will carry the bows and keep the watch. You do not take this road alone."',
    hanuman: 'Hanuman: "Wherever this road ends, call my name and I will be there."',
  };
  let lit = 0, leaving = false;
  return {
    id: 'ayodhya', name: 'Ayodhya', subtitle: 'The city on the Sarayu',
    heightAt, heightField: land.heightField,
    spawn: { x: 0, z: -24, yaw: 0 },
    add: [sky.group, land.mesh, carpet.group, tufts.group, built.group, petals, beacons.mesh],
    shade: { scene: shade, options: { sun: shared.uSunDir.value, size: [4096, 4096], box: [135, 135], centre: [0, 6, 0], back: 320, near: 30, far: 700 } },
    solids: b.solids,
    follow: (x, z) => { carpet.follow(x, z); tufts.follow(x, z); },
    light: (p) => p,
    shafts: 0.5,
    wind: 0.6,
    camera: { pitch: 0.02, lift: 1.1 },
    outside: (feet) => feet.y < -2.6 || Math.abs(feet.x) > 200 || Math.abs(feet.z) > 200,
    quality(low) { petals.geometry.instanceCount = low ? 600 : 1500; },
    begin(game) {
      // the others of the house stand in the court to see the exile off
      const others = Object.keys(LINES).filter((id) => id !== game.heroId);
      const places = [[-4.5, -13], [4.5, -13], [0, -8]];
      others.forEach((id, i) => {
        const [x, z] = places[i];
        const npc = createNpc({ shared, rigs: game.rigs, scene: game.scene, light: (p) => p }, HEROES[id], { x, y: heightAt(x, z), z, yaw: Math.atan2(0 - x, -24 - z), detail: 0.8 });
        npc.line = LINES[id]; npc.said = false;
        npcs.push(npc);
      });
      game.objective('Light the five lamps of the court (0 of 5)');
      game.say('Walk up to a lamp to light it. The court is yours to cross one last time.', 7);
    },
    update(dt, time, game) {
      const feet = game.feet;
      for (const n of npcs) {
        const d = Math.hypot(feet.x - n.position.x, feet.z - n.position.z);
        if (d < 60) n.update(dt, game.ctx);
        if (d < 3.2 && !n.said) { n.said = true; game.say(n.line, 6); }
        // they turn to watch the one who is leaving
        if (d < 30) n.turn(Math.atan2(feet.x - n.position.x, feet.z - n.position.z));
      }
      for (const l of lamps) {
        if (l.lit || Math.hypot(feet.x - l.x, feet.z - l.z) > 2.3) continue;
        l.lit = true; lit++;
        l.flame.on(1);
        game.fx.rise(new THREE.Vector3(l.x, 2.6, l.z), [1.0, 0.7, 0.3], { count: 18, spread: 0.3, life: 1.3 });
        game.checkpoint(feet.x, feet.z);
        if (lit < lamps.length) game.objective(`Light the five lamps of the court (${lit} of 5)`);
        else {
          gate.on(1);
          game.objective('Leave by the great gate');
          game.say('Five lamps burn in the court. They will be kept burning for fourteen years.', 7);
        }
      }
      if (lit === lamps.length && !leaving && feet.z > 79.5 && Math.abs(feet.x) < 6) {
        leaving = true;
        game.say('Behind you the city is silent. Ahead lies the forest.', 5);
        game.finish();
      }
    },
  };
}
