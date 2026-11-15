// Dronagiri: a ridge of the Himalaya by night, under the lights of the northern sky, where the herb Sanjeevani
// glows among the snow. The world is the reference demo's aurora scene (src/night), whole; what is added is the
// herb to gather, the rakshasas sent to stop it being found, and the hermit's hut to carry it to.
import * as THREE from 'three';
import { prepareLand, createLand, heightAt, crestX, START, MOON, EXTENT, CABIN } from '../night/land.js';
import { createSnow } from '../night/snow.js';
import { createSky } from '../night/sky.js';
import { createFar } from '../night/far.js';
import { createTracks } from '../night/tracks.js';
import { createDrift } from '../night/drift.js';
import { createPines } from '../night/pines.js';
import { createCabin } from '../night/cabin.js';
import { createBeacons } from '../game/glow.js';
import { byNight, FOES } from '../game/cast.js';

export const info = { id: 'himalaya', far: 16000 };

const HERB = [0.35, 1.0, 0.55];

export async function build({ shared, say, turn }) {
  // the night: a low moon for the sun, thin clear air
  shared.uSunDir.value.copy(MOON);
  shared.uHaze.value.setRGB(0.035, 0.12, 0.17);
  shared.uHazeSun.value.setRGB(0.06, 0.16, 0.2);
  shared.uHazeGlow.value.setRGB(0.03, 0.045, 0.05);
  shared.uHazeDensity.value = 0.00046;
  shared.uShadeBias.value = 0.0004;
  shared.uBounce.value.setRGB(0.015, 0.06, 0.07);
  shared.uLampCol.value.setRGB(1.0, 0.72, 0.36);
  shared.uGlazeMul.value.setRGB(0.3, 0.38, 0.62);
  shared.uGlazeAdd.value.setRGB(0.0, 0.008, 0.03);
  shared.uGlow = { value: new THREE.Vector3(1, 0, 0) };
  shared.uWarm = { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] };
  shared.uRoom = { value: new THREE.Vector4(0, 0, -1, -1) };

  await prepareLand((done) => { say(0.5 * done, 'Raising the mountain'); return turn(); });
  const land = createLand(shared);
  say(0.55, 'Laying the snow');
  await turn();
  const snow = createSnow(shared);
  const pines = createPines(shared);
  land.shade.add(pines.caster);
  const cabin = createCabin(shared);
  land.shade.add(cabin.caster);
  say(0.8, 'Lighting the sky');
  await turn();
  const sky = createSky(shared);
  const far = createFar(shared);
  const tracks = createTracks(shared);
  const drift = createDrift(shared);
  const beacons = createBeacons(shared);

  // the herb grows in five places along the crest, a little off the way each time
  const herbs = [[262, 5], [206, -6], [146, 7], [84, -5], [22, 6]].map(([z, off]) => {
    const x = crestX(z) + off;
    return { x, z, y: heightAt(x, z), found: false, light: beacons.add(x, heightAt(x, z) + 0.25, z, { color: HERB, size: 1.3, shaft: true }) };
  });
  const door = { x: CABIN.x + 1.75, z: CABIN.z + 4.2 };
  const doorLight = beacons.add(door.x, CABIN.y + 0.4, door.z, { color: [1.0, 0.7, 0.3], size: 1.2, shaft: true, lit: 0 });

  let found = 0, sent = false, guard = false;
  return {
    id: 'himalaya', name: 'Dronagiri', subtitle: 'The mountain of herbs',
    heightAt, heightField: land.heightField,
    spawn: { x: START.x, z: START.z, yaw: Math.PI },
    add: [sky.group, far.group, land.mesh, snow.group, pines.group, cabin.group, tracks.mesh, drift, beacons.mesh],
    shade: { scene: land.shade, options: { sun: MOON, size: [4096, 3072], box: [740, 560], centre: [0, 150, 0], back: 1600, near: 700, far: 2500 } },
    solids: { posts: pines.colliders.map((t) => ({ x: t.x, y: t.y, z: t.z, r: t.r, h: 8 })), boxes: cabin.solid },
    follow: (x, z) => snow.follow(x, z),
    block: (o, d, max) => pines.block(o, d, max),
    light: byNight,
    lamp: 0.9, // the hero carries no lantern: a light goes with them all the same
    camera: { pitch: -0.05, lift: 1.4, sink: 0.7 },
    wind: 1.15,
    outside: (feet) => feet.y < 1.5 || Math.max(Math.abs(feet.x), Math.abs(feet.z)) > EXTENT - 30,
    quality(low) {
      const veil = sky.group.getObjectByName('veil');
      if (veil) veil.visible = !low;
      drift.geometry.instanceCount = low ? 900 : 2400;
    },
    begin(game) {
      tracks.lay(crestX, START.z + 16, START.z + 0.4);
      game.objective('Find the glowing Sanjeevani along the ridge (0 of 5)');
      game.say(game.heroId === 'hanuman' ? 'You could carry the whole mountain back. Tonight the herb itself will do.' : 'Follow the crest north. The herb shows itself as a green light in the snow.', 7);
    },
    update(dt, time, game) {
      // the sky breathes: brighter and dimmer over a minute or so, and the snow under it with it
      shared.uGlow.value.x = 1.0 + 0.2 * Math.sin(time * 0.11) + 0.1 * Math.sin(time * 0.37 + 1.0) + 0.07 * Math.sin(time * 1.1 + 2.0);
      cabin.update(time);
      const p = game.player, feet = p.feet;
      const onGround = p.grounded && p.mode !== 'jump' && p.mode !== 'air';
      if (!cabin.inside(feet)) tracks.update(feet, p.yaw, p.speed, onGround);
      for (const h of herbs) {
        if (h.found || Math.hypot(feet.x - h.x, feet.z - h.z) > 1.9) continue;
        h.found = true; found++;
        h.light.on(0);
        game.fx.rise(new THREE.Vector3(h.x, h.y, h.z), HERB, { count: 26, spread: 0.6, life: 1.6 });
        game.heal(25);
        game.checkpoint(h.x, h.z);
        if (found < herbs.length) {
          game.objective(`Find the glowing Sanjeevani along the ridge (${found} of 5)`);
          if (found === 2) game.say('From the knoll the whole sky opens. Far ahead, under the horn, a window is lit.', 6);
        } else {
          game.objective('Carry the herb to the hermit\'s hut under the horn');
          game.say('Enough to wake an army. The hermit below the horn knows how it is prepared.', 6);
          doorLight.on(1);
        }
      }
      // Ravana has sent rakshasas to keep the herb from being found: they wait where the crest narrows
      if (!sent && feet.z < 120) {
        sent = true;
        for (let i = 0; i < 3; i++) game.spawnFoe(FOES.rakshasa(i), crestX(84) + (i - 1) * 4, 78 - i * 3, { yaw: 0, aggro: 30 });
        game.say('Shapes stand in the snow ahead. Ravana does not mean the herb to be found.', 5);
      }
      if (!guard && feet.z < 0) {
        guard = true;
        for (let i = 0; i < 3; i++) game.spawnFoe(FOES.rakshasa(i + 1), crestX(-36) + (i - 1) * 3.5, -34 - i * 2.5, { yaw: 0, aggro: 32 });
      }
      if (found === herbs.length && Math.hypot(feet.x - door.x, feet.z - door.z) < 2.6) {
        game.say('The herb is ground and carried south on the wind. By dawn the fallen stand again.', 6);
        game.finish();
      }
    },
  };
}
