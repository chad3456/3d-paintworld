// Those who stand in the hero's way: rakshasas, and Ravana. Each is a painted character like the hero
// (src/game/character.js) moved by a few clips and a short list of intentions: wait, come on, strike, reel, fall.
// They walk the land's own height and know nothing of walls; a realm that needs them kept somewhere gives `keep`.
import * as THREE from 'three';
import { buildCharacter } from './character.js';

const angleWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const CLIPS = {
  rakshasa: { idle: 'Zombie_Idle_Loop', walk: 'Zombie_Walk_Fwd_Loop', attack: 'Zombie_Scratch', hitAt: 0.42, rate: 1.5, walkRate: 1.5, speed: 2.1 },
  boss: { idle: 'Idle', walk: 'Walk', attack: 'Sword_Regular_C', hitAt: 0.3, rate: 1.0, walkRate: 1.15, speed: 2.3 },
};

export function createFoes({ shared, rigs, scene, fx, light, heightAt, keep = null }) {
  const list = [];
  const v = new THREE.Vector3(), chest = new THREE.Vector3();
  const events = []; // what they did to the hero this frame: { damage, from }

  function spawn(def, x, z, { yaw = 0, boss = false, aggro = 24, home = null, ranged = null } = {}) {
    const body = rigs.spawn(def.body);
    const character = buildCharacter(shared, body, def, { light, detail: boss ? 0.9 : 0.42, cloth: boss });
    const mixer = new THREE.AnimationMixer(body.object);
    const set = boss ? CLIPS.boss : CLIPS.rakshasa;
    const actions = {};
    for (const key of ['idle', 'walk', 'attack']) actions[key] = mixer.clipAction(body.clips[set[key]]);
    actions.hit = mixer.clipAction(body.clips.Hit_Knockback);
    for (const key of ['attack', 'hit']) { actions[key].setLoop(THREE.LoopOnce); actions[key].clampWhenFinished = true; }
    scene.add(body.object, character.group);
    const foe = {
      def, body, character, mixer, actions, set, boss, ranged,
      pos: new THREE.Vector3(x, heightAt(x, z), z), home: home ?? { x, z }, yaw,
      health: def.stats.health, maxHealth: def.stats.health, radius: 0.5 * def.scale, height: 1.85 * def.scale,
      state: 'idle', t: 0, cooldown: 1 + Math.random(), aggro, awake: false, stun: 0, push: new THREE.Vector3(), struck: false, playing: null, alive: true, rangedIn: 3,
    };
    play(foe, 'idle', 0);
    foe.actions.idle.time = Math.random() * 2;
    list.push(foe);
    return foe;
  }

  function play(foe, key, fade = 0.2, rate = 1) {
    if (foe.playing === key) return;
    const next = foe.actions[key], prev = foe.playing ? foe.actions[foe.playing] : null;
    next.reset(); next.timeScale = rate; next.setEffectiveWeight(1); next.play();
    if (prev && fade > 0) next.crossFadeFrom(prev, fade, false); else if (prev) prev.stop();
    foe.playing = key;
  }

  /** Takes `damage` from a blow that came from `from`; `stun` holds it still that many seconds. */
  function hurt(foe, damage, from, { stun = 0, push = 1 } = {}) {
    if (!foe.alive) return;
    foe.health -= damage;
    foe.awake = true;
    chest.copy(foe.pos); chest.y += foe.height * 0.62;
    fx.burst(chest, [1.0, 0.75, 0.35], { count: foe.boss ? 9 : 7, speed: 3.5, size: [0.05, 0.22], life: 0.4 });
    v.copy(foe.pos).sub(from); v.y = 0;
    if (v.lengthSq() > 1e-4) foe.push.copy(v.normalize()).multiplyScalar((foe.boss ? 1.2 : 3.5) * push);
    foe.stun = Math.max(foe.stun, stun);
    if (foe.health <= 0) {
      foe.alive = false; foe.state = 'dead'; foe.t = 0;
      play(foe, 'hit', 0.08, 1);
    } else if (!foe.boss || damage > 60) {
      foe.state = 'hurt'; foe.t = 0;
      play(foe, 'hit', 0.06, 1.2);
    }
  }

  function remove(foe) {
    scene.remove(foe.body.object, foe.character.group);
    foe.character.group.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    const i = list.indexOf(foe);
    if (i >= 0) list.splice(i, 1);
  }

  function update(dt, hero, ctx) {
    events.length = 0;
    for (const foe of [...list]) {
      foe.t += dt;
      foe.cooldown -= dt;
      const dx = hero.pos.x - foe.pos.x, dz = hero.pos.z - foe.pos.z, dist = Math.hypot(dx, dz);
      const reach = foe.def.attack.reach;
      let speed = 0;
      if (foe.state === 'dead') {
        // he lies a moment, then goes up in light
        if (foe.t > 1.0 && !foe.gone) {
          foe.gone = true;
          fx.rise(foe.pos, foe.boss ? [1.0, 0.85, 0.5] : [0.9, 0.6, 0.3], { count: foe.boss ? 60 : 18, spread: foe.boss ? 1.6 : 0.7, life: foe.boss ? 2.4 : 1.2 });
        }
        if (foe.t > 1.0) {
          const k = Math.max(0.001, 1 - (foe.t - 1.0) / 0.5), s = foe.def.scale;
          foe.body.object.scale.set(s * (foe.def.broad ?? 1) * k, s * k, s * (foe.def.broad ?? 1) * k);
        }
        if (foe.t > 1.5) { remove(foe); foe.onDeath?.(foe); continue; }
      } else if (foe.stun > 0) {
        foe.stun -= dt;
        if (foe.state !== 'hurt') play(foe, 'idle', 0.2, 0.3);
        if (foe.state === 'hurt' && foe.t > 0.45) foe.state = 'chase';
      } else if (foe.state === 'hurt') {
        if (foe.t > 0.45) foe.state = 'chase';
      } else if (foe.state === 'attack') {
        const a = foe.actions.attack, done = a.time / a.getClip().duration;
        if (!foe.struck && done >= foe.set.hitAt) {
          foe.struck = true;
          const facing = Math.abs(angleWrap(Math.atan2(dx, dz) - foe.yaw)) < 1.0;
          if (hero.alive && dist < reach * 1.25 && facing && Math.abs(hero.pos.y - foe.pos.y) < 2.2) events.push({ damage: foe.def.attack.damage, from: foe.pos });
        }
        if (done < foe.set.hitAt) foe.yaw += THREE.MathUtils.clamp(angleWrap(Math.atan2(dx, dz) - foe.yaw), -3 * dt, 3 * dt);
        if (done >= 0.96 || !a.isRunning()) { foe.state = 'chase'; foe.cooldown = foe.def.attack.cooldown * (0.8 + 0.4 * Math.random()); play(foe, 'idle', 0.25); }
      } else {
        if (!foe.awake && hero.alive && dist < foe.aggro) foe.awake = true;
        const far = Math.hypot(foe.pos.x - foe.home.x, foe.pos.z - foe.home.z);
        if (foe.awake && (!hero.alive || (far > 70 && dist > 30))) foe.awake = false;
        if (foe.awake) {
          foe.state = 'chase';
          foe.yaw += THREE.MathUtils.clamp(angleWrap(Math.atan2(dx, dz) - foe.yaw), -5 * dt, 5 * dt);
          if (dist < reach * 0.85 && foe.cooldown <= 0 && Math.abs(hero.pos.y - foe.pos.y) < 2.2) {
            foe.state = 'attack'; foe.struck = false;
            play(foe, 'attack', 0.12, foe.set.rate);
          } else if (dist > reach * 0.7) speed = foe.set.speed * foe.def.stats.pace;
          // one who can throw fire does, from a distance
          if (foe.ranged) {
            foe.rangedIn -= dt;
            if (foe.rangedIn <= 0 && dist > 7 && dist < 60) { foe.rangedIn = foe.ranged.cooldown; foe.onThrow?.(foe); }
          }
        } else {
          foe.state = 'idle';
        }
        if (foe.state !== 'attack') play(foe, speed > 0 ? 'walk' : 'idle', 0.25, speed > 0 ? foe.set.walkRate : 1);
      }
      // travel: his own steps, whatever pushed him, and room between him and the next
      v.set(Math.sin(foe.yaw) * speed, 0, Math.cos(foe.yaw) * speed).add(foe.push);
      foe.push.multiplyScalar(Math.exp(-7 * dt));
      for (const other of list) {
        if (other === foe || !other.alive) continue;
        const ox = foe.pos.x - other.pos.x, oz = foe.pos.z - other.pos.z, od = Math.hypot(ox, oz), min = foe.radius + other.radius + 0.25;
        if (od < min && od > 1e-3) { v.x += (ox / od) * (min - od) * 4; v.z += (oz / od) * (min - od) * 4; }
      }
      if (foe.alive) {
        const nx = foe.pos.x + v.x * dt, nz = foe.pos.z + v.z * dt;
        if (!keep || keep(nx, nz, foe)) { foe.pos.x = nx; foe.pos.z = nz; }
        else if (keep(nx, foe.pos.z, foe)) foe.pos.x = nx;
        else if (keep(foe.pos.x, nz, foe)) foe.pos.z = nz;
      }
      foe.pos.y = heightAt(foe.pos.x, foe.pos.z);
      const o = foe.body.object;
      o.position.copy(foe.pos);
      o.rotation.set(0, foe.yaw, 0);
      const seen = ctx.eye.distanceToSquared(foe.pos) < 110 * 110;
      foe.character.show(seen);
      if (seen) {
        foe.mixer.update(dt);
        o.updateMatrixWorld(true);
        foe.character.update(dt, ctx);
      }
    }
    return events;
  }

  return {
    list, spawn, update, hurt, remove,
    alive: () => list.filter((f) => f.alive),
    /** Everyone within `radius` of `at` (and, with `facing` and `arc`, in front of it) takes the blow. Returns how many. */
    strike(at, radius, damage, { facing = null, arc = Math.PI, stun = 0, push = 1 } = {}) {
      let n = 0;
      for (const foe of list) {
        if (!foe.alive) continue;
        const dx = foe.pos.x - at.x, dz = foe.pos.z - at.z, d = Math.hypot(dx, dz);
        if (d > radius + foe.radius || Math.abs(foe.pos.y - at.y) > 3) continue;
        if (facing != null && d > 0.6 && Math.abs(angleWrap(Math.atan2(dx, dz) - facing)) > arc / 2) continue;
        hurt(foe, damage, at, { stun, push });
        n++;
      }
      return n;
    },
    /** The living foe nearest the line from `from` along `dir` (unit), within `cone` radians and `range` metres. */
    inSights(from, dir, range = 70, cone = 0.2) {
      let best = null, bestA = cone;
      for (const foe of list) {
        if (!foe.alive) continue;
        v.set(foe.pos.x - from.x, foe.pos.y + foe.height * 0.6 - from.y, foe.pos.z - from.z);
        const d = v.length();
        if (d > range || d < 0.5) continue;
        const a = Math.acos(THREE.MathUtils.clamp(v.dot(dir) / d, -1, 1));
        if (a < bestA) { bestA = a; best = foe; }
      }
      return best;
    },
    nearest(at, range = 6) {
      let best = null, bd = range;
      for (const foe of list) {
        if (!foe.alive) continue;
        const d = Math.hypot(foe.pos.x - at.x, foe.pos.z - at.z);
        if (d < bd) { bd = d; best = foe; }
      }
      return best;
    },
  };
}
