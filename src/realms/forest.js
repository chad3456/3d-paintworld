// Panchavati, in the forest of Dandaka: a way through tall trees to a clearing where the hermitage stands. The
// wood is the reference demo's (src/world), its autumn turned to the green of a sal forest with flame trees in
// orange flower. What is added is the tale: the golden deer that wants to be followed, what it turns out to be,
// and the hut in the clearing.
import * as THREE from 'three';
import { prepareLand, createLand, heightAt, wayDist, way, START, CLEARING } from '../world/land.js';
import { createFloor } from '../world/floor.js';
import { createForest } from '../world/forest.js';
import { createSky } from '../world/sky.js';
import { createLeaves } from '../world/leaves.js';
import { createKick } from '../world/kick.js';
import { makeBuilder } from '../game/build.js';
import { createBeacons } from '../game/glow.js';
import { createDeer } from '../game/deer.js';
import { FOES } from '../game/cast.js';

export const info = { id: 'forest', far: 2000 };

export async function build({ shared, say, turn }) {
  shared.uHaze.value.setRGB(0.58, 0.66, 0.62);
  shared.uHazeSun.value.setRGB(1.0, 0.92, 0.62);
  shared.uBounce.value.setRGB(0.05, 0.08, 0.0);
  await prepareLand((done) => { say(0.3 * done, 'Laying the ground'); return turn(); });
  const land = createLand(shared);
  say(0.32, 'Growing the forest');
  await turn();
  const forest = createForest(shared);
  say(0.7, 'Growing the forest');
  await turn();
  const floor = createFloor(shared);
  const sky = createSky(shared);
  const leaves = createLeaves(shared, 2400);
  const kick = createKick(shared);
  const beacons = createBeacons(shared);

  // --- the hermitage: a round hut of mud under thatch, at the far edge of the clearing, with its fire before it ---
  const hut = { x: CLEARING.x - 9, z: CLEARING.z - 7 };
  hut.y = heightAt(hut.x, hut.z);
  const b = makeBuilder(shared, {
    seed: 77, origin: [hut.x, hut.y, hut.z],
    palettes: {
      mud: { l: [0.9, 0.66, 0.42], m: [0.62, 0.4, 0.28], s: [0.3, 0.19, 0.2] },
      thatch: { l: [0.96, 0.82, 0.42], m: [0.68, 0.52, 0.24], s: [0.32, 0.24, 0.17] },
      dark: { l: [0.2, 0.14, 0.12], m: [0.1, 0.07, 0.08], s: [0.04, 0.03, 0.05] },
      wood: { l: [0.62, 0.42, 0.24], m: [0.36, 0.23, 0.15], s: [0.16, 0.1, 0.1] },
      stone: { l: [0.8, 0.76, 0.66], m: [0.52, 0.48, 0.46], s: [0.24, 0.22, 0.27] },
    },
  });
  b.kit.round(0, 1.05, 0, 2.3, 2.3, 'mud', { sides: 14, stroke: [0.3, 0.6], grain: new THREE.Vector3(1, 0, 0) });
  b.kit.add(new THREE.ConeGeometry(3.3, 2.7, 16, 3, true), b.kit.place(0, 3.4, 0), 'thatch', { smooth: true, grain: new THREE.Vector3(0, 1, 0), stroke: [0.2, 0.9], density: 1.3 });
  b.kit.box(0.6, 0.95, 2.26, 1.0, 1.9, 0.12, 'dark', { stroke: [0.2, 0.5] });
  for (const x of [0.0, 1.2]) b.kit.round(x, 1.0, 2.34, 0.07, 2.0, 'wood', { stroke: [0.06, 0.5] });
  // the fire altar: a low square of stone
  b.block(3.6, 0.2, 4.6, 1.3, 0.4, 1.3, 'stone', { stroke: [0.2, 0.4] });
  b.solids.posts.push({ x: hut.x, y: hut.y, z: hut.z, r: 2.4, h: 5 });
  const built = b.build();
  forest.shade.add(new THREE.Mesh(built.under.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  const fire = beacons.add(hut.x + 3.6, hut.y + 0.5, hut.z + 4.6, { color: [1.0, 0.5, 0.14], size: 1.5, shaft: false });
  const goal = beacons.add(hut.x + 0.6, hut.y + 0.4, hut.z + 3.6, { color: [1.0, 0.8, 0.4], size: 1.2, shaft: true, lit: 0 });

  let deer = null;
  // where the deer stops to look back: places along the way, by their number in its list of points
  const STOPS = [44, 76, 108, 140, 168, way.length - 1];
  let stop = 0, phase = 'follow', ambush = false, left = 0, said = 0;
  const trunks = forest.colliders;
  const free = (x, z) => wayDist(x, z) < 68 && !trunks.some((t) => (x - t.x) ** 2 + (z - t.z) ** 2 < (t.r + 0.5) ** 2);

  return {
    id: 'forest', name: 'Panchavati', subtitle: 'The forest of Dandaka',
    heightAt, heightField: land.heightField,
    spawn: { x: START.x, z: START.z, yaw: Math.PI },
    add: [sky.group, land.mesh, forest.group, floor.group, leaves.mesh, kick.mesh, built.group, beacons.mesh],
    shade: { scene: forest.shade, options: {} },
    solids: { posts: [...trunks.map((t) => ({ x: t.x, y: t.y - 0.5, z: t.z, r: t.r, h: 10 })), ...b.solids.posts], boxes: b.solids.boxes },
    follow: (x, z) => floor.follow(x, z),
    light: (p) => p,
    shafts: 1,
    keep: free,
    outside: (feet) => feet.y < heightAt(feet.x, feet.z) - 6 || wayDist(feet.x, feet.z) > 78,
    quality(low) { leaves.mesh.geometry.instanceCount = low ? 900 : 2400; },
    deerAt: () => deer.position,
    begin(game) {
      deer = createDeer({ shared, fx: game.fx, heightAt });
      game.scene.add(deer.root, deer.dabs);
      const [x, z] = way[STOPS[0]];
      deer.place(x, z, 0);
      game.objective('Follow the golden deer');
      game.say('Between the trunks ahead, something shines like beaten gold.', 6);
    },
    update(dt, time, game) {
      const p = game.player, feet = p.feet;
      const onGround = p.grounded && p.mode !== 'jump' && p.mode !== 'air';
      kick.update(dt, feet, { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }, p.speed, onGround, heightAt);
      deer.update(dt, time);
      if (phase === 'follow') {
        const d = Math.hypot(feet.x - deer.position.x, feet.z - deer.position.z);
        if (!deer.moving) deer.face(feet.x, feet.z);
        if (!deer.moving && d < 13) {
          if (stop < STOPS.length - 1) {
            // it lets the hunter come near, then is off down the way to its next stand
            deer.run(way.slice(STOPS[stop] + 1, STOPS[stop + 1] + 1), 9.5);
            stop++;
            game.checkpoint(feet.x, feet.z);
            if (stop === 2 && said < 1) { said = 1; game.say('It waits until you are almost upon it. Then it is gone again, always deeper in.', 6); }
            if (stop === 3 && !ambush) {
              // those who sent the deer are watching the way
              ambush = true;
              const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
              for (const side of [-1, 1]) {
                let x = feet.x + f.x * 15 + f.z * side * 7, z = feet.z + f.z * 15 - f.x * side * 7;
                for (let tries = 0; tries < 8 && !free(x, z); tries++) { x += f.x * 1.5; z += f.z * 1.5; }
                game.spawnFoe(FOES.rakshasa(side > 0 ? 0 : 2), x, z, { yaw: Math.atan2(feet.x - x, feet.z - z), aggro: 40 }).awake = true;
              }
              game.say('The trees are not empty. Rakshasas!', 4);
            }
          } else if (d < 11) {
            // the clearing: the deer is no deer
            phase = 'fight';
            const at = deer.position.clone();
            deer.show(false);
            game.fx.burst(at.clone().setY(at.y + 0.9), [1.0, 0.8, 0.3], { count: 40, speed: 6, size: [0.07, 0.4], life: 1.0 });
            game.fx.ring(at, [1.0, 0.7, 0.3], { count: 30, speed: 8 });
            const maricha = game.spawnFoe({ ...FOES.rakshasa(3), name: 'Maricha', scale: 1.3, stats: { health: 220, pace: 0.95 }, attack: { damage: 16, reach: 2.2, cooldown: 1.8 } }, at.x, at.z, { yaw: Math.atan2(feet.x - at.x, feet.z - at.z), aggro: 60 });
            maricha.awake = true;
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * Math.PI * 2 + 0.6;
              let x = CLEARING.x + Math.cos(a) * 14, z = CLEARING.z + Math.sin(a) * 14;
              if (!free(x, z)) { x = CLEARING.x + Math.cos(a) * 9; z = CLEARING.z + Math.sin(a) * 9; }
              game.spawnFoe(FOES.rakshasa(i), x, z, { yaw: Math.atan2(feet.x - x, feet.z - z), aggro: 60 }).awake = true;
            }
            game.checkpoint(feet.x, feet.z);
            game.say('The deer cries out in a man\'s voice. It is Maricha, Ravana\'s sorcerer, and he has not come alone.', 7);
          }
        }
      } else if (phase === 'fight') {
        const n = game.foes.alive().length;
        if (n !== left) { left = n; game.objective(n ? `Drive off the rakshasas (${n} left)` : ''); }
        if (n === 0) {
          phase = 'home';
          goal.on(1);
          game.objective('Return to the hermitage');
          game.say('The clearing is quiet again. Too quiet: far to the south, a chariot is crossing the sky toward Lanka.', 8);
        }
      } else if (phase === 'home') {
        if (Math.hypot(feet.x - goal.position.x, feet.z - goal.position.z) < 2.4) { phase = 'done'; game.finish(); }
      }
      void fire;
    },
  };
}
