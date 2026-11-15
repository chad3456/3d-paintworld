// A palace terrace at sunrise: where the heroes stand to be chosen. A small world, quick to make: paving, a
// colonnade, and the dawn behind it.
import * as THREE from 'three';
import { makeLand } from '../game/land.js';
import { makeCarpet } from '../game/ground.js';
import { makeBuilder } from '../game/build.js';
import { createNpc } from '../game/npc.js';
import { HEROES, HERO_ORDER, FOES } from '../game/cast.js';
import { createSky } from '../world/sky.js';
import { noise } from '../world/noise.js';

export const info = { id: 'studio', name: 'The terrace', far: 2500 };

export const STONE = {
  sand: { l: [0.98, 0.84, 0.62], m: [0.78, 0.58, 0.42], s: [0.44, 0.3, 0.3] },
  white: { l: [1.0, 0.96, 0.88], m: [0.8, 0.74, 0.7], s: [0.46, 0.42, 0.5] },
  red: { l: [0.86, 0.42, 0.3], m: [0.62, 0.26, 0.2], s: [0.32, 0.13, 0.15] },
  gold: { l: [1.0, 0.84, 0.36], m: [0.84, 0.56, 0.15], s: [0.46, 0.27, 0.12] },
};

export async function build({ shared, say, turn, q }) {
  shared.uSunDir.value.set(0.45, 0.42, 0.78).normalize();
  shared.uHazeDensity.value = 0.0035;
  shared.uHaze.value.setRGB(0.66, 0.62, 0.7);
  shared.uHazeSun.value.setRGB(1.0, 0.86, 0.6);
  shared.uBounce.value.setRGB(0.12, 0.08, 0.03);

  const paved = (x, z) => (Math.abs(x) < 15 && Math.abs(z) < 11 ? 1 : 0);
  const land = await makeLand(shared, {
    height: (x, z) => (paved(x, z) ? 0 : -1.2 - 2.5 * Math.min(1, (Math.max(Math.abs(x) - 15, Math.abs(z) - 11, 0)) / 30) + 0.6 * noise(x / 23, z / 23)),
    cover: (x, z) => [paved(x, z), 1 - paved(x, z), 0.5 + 0.5 * noise(x / 15, z / 15), 0],
    pause: (done) => { say(0.6 * done, 'Laying the terrace'); return turn(); },
    under: /* glsl */ `
      vec3 underpaint(vec3 P, vec4 m, float lit) {
        vec3 stone = mix(vec3(0.42, 0.3, 0.3), vec3(0.8, 0.62, 0.44), lit);
        vec3 grass = mix(vec3(0.14, 0.24, 0.16), vec3(0.5, 0.56, 0.2), lit);
        return mix(grass, stone, m.r);
      }`,
  });
  const carpet = makeCarpet(shared, {
    n: 128, levels: 5,
    paint: /* glsl */ `
      vec3 groundPaint(vec2 xz, vec3 P, vec3 Nn, vec4 m, float lit, vec4 q, out vec3 c2) {
        // paving: slabs of sandstone, each a little its own colour
        vec4 s = hash4(floor(xz / 1.6), 3.0);
        vec3 stone = paint3(vec3(1.0, 0.86, 0.64), vec3(0.76, 0.56, 0.42), vec3(0.42, 0.3, 0.32), lit, q.y) * (0.86 + 0.26 * s.x);
        vec3 grass = paint3(vec3(0.66, 0.74, 0.26), vec3(0.34, 0.47, 0.17), vec3(0.12, 0.24, 0.17), lit, q.y);
        vec3 c = mix(grass, stone, step(0.5, m.r));
        c2 = c * 1.12;
        return c;
      }`,
  });

  const b = makeBuilder(shared, { palettes: STONE, seed: 31 });
  // a low wall along the back and sides, a colonnade behind, and three domes on it
  for (const [x0, z0, x1, z1] of [[-15, -11, 15, -11], [-15, -11, -15, 11], [15, -11, 15, 11]]) b.wall(x0, z0, x1, z1, 0, 1.0, 0.5, 'sand', { stroke: [0.25, 0.7] });
  for (const x of [-15, -9, -3, 3, 9, 15]) b.pillar(x, 0, -11, 0.42, 5.4, 'white', { trim: 'sand' });
  b.block(0, 5.8, -11, 31, 0.8, 1.3, 'sand', { stroke: [0.3, 1.0], grain: 'x', solid: false });
  b.block(0, 6.5, -11, 31.6, 0.6, 1.7, 'red', { stroke: [0.3, 1.0], grain: 'x', solid: false });
  for (const x of [-12, 12]) b.dome(x, 6.8, -11, 1.9, 'gold');
  b.dome(0, 6.8, -11, 2.8, 'white', { finial: 'gold' });
  const built = b.build();

  const sky = createSky(shared);
  const shade = new THREE.Scene();
  shade.add(land.caster, new THREE.Mesh(built.under.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));

  const npcs = [];
  return {
    id: 'studio', name: 'The terrace', subtitle: '',
    heightAt: land.heightAt, heightField: land.heightField,
    spawn: { x: 0, z: 6, yaw: Math.PI },
    add: [sky.group, land.mesh, carpet.group, built.group],
    shade: { scene: shade, options: { sun: shared.uSunDir.value, size: [2048, 2048], box: [40, 40], centre: [0, 3, 0], back: 120, near: 10, far: 260 } },
    solids: b.solids,
    follow: (x, z) => carpet.follow(x, z),
    light: (p) => p,
    shafts: 0,
    outside: (feet) => feet.y < -8,
    // ?cast: everyone in a row, to look at
    begin(game) {
      if (!q.has('cast')) return;
      const all = [...HERO_ORDER.map((id) => HEROES[id]), FOES.ravana, FOES.rakshasa(0), FOES.rakshasa(1)];
      all.forEach((def, i) => npcs.push(createNpc({ shared, rigs: game.rigs, scene: game.scene, light: (p) => p }, def, { x: (i - (all.length - 1) / 2) * 1.5, y: 0, z: 0, yaw: 0, detail: 1 })));
    },
    update(dt, time, game) { for (const n of npcs) n.update(dt, game.ctx); },
  };
}
