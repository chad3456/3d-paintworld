// The game itself: one realm, one hero, and everything that goes on between them. A realm (src/realms/*.js) makes
// its world and says what is to be done there; this file gives it a canvas, a body for the hero, feet on the
// ground, an eye that follows, foes, and the turn of each frame. It is the reference demo's main loop
// (src/night/main.js) with a game put in it.
//   ?capture       no clock: window.lab.step(dt, n) advances it (for stills and tests)
//   ?quality=low   for slower machines: fewer pixels, less in the air
import * as THREE from 'three';
import { patchBlock } from 'patch-block';
import recipe from '../../recipe.json';
import RAPIER from '../figure/rapier/rapier.mjs';
import { createShared, WIND } from '../oilpaint/common.js';
import { createBrushSheet } from '../oilpaint/brush.js';
import { createShade } from '../oilpaint/shade.js';
import { createFrame } from '../oilpaint/finish.js';
import { noise } from '../world/noise.js';
import { Animator, SETUP } from '../figure/animator.js';
import { Input } from '../figure/input.js';
import { Follow } from '../figure/camera.js';
import { loadRigs } from './rigs.js';
import { buildCharacter } from './character.js';
import { HEROES } from './cast.js';
import { Hero } from './hero.js';
import { createFx } from './fx.js';
import { createFoes } from './foes.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { story } from './story.js';

const q = new URLSearchParams(location.search);
export const capture = q.has('capture');
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The canvas and what every painted thing shares. Also used by the page where a hero is chosen. */
export function createCanvas({ far = 4000 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  const low = () => (q.get('quality') ?? window.patch?.quality ?? 'high') === 'low';
  renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, low() ? 1 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  document.getElementById('view').appendChild(renderer.domElement);
  const shared = createShared();
  shared.tBrush.value = createBrushSheet();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.25, far);
  let frame = null;
  const fit = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    frame?.resize();
  };
  addEventListener('resize', fit);
  const size = new THREE.Vector2();
  return {
    renderer, shared, scene, camera, low, fit,
    makeFrame() { frame = createFrame(renderer, shared); frame.uniforms.uCanvas.value = q.has('canvas') ? +q.get('canvas') : 1; return frame; },
    /** Sets what the painter needs to know of this frame, and paints it. */
    paint(time, focus) {
      camera.updateMatrixWorld(true);
      renderer.getDrawingBufferSize(size);
      shared.uTime.value = time;
      shared.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / size.y;
      shared.uFocus.value.copy(focus);
      frame.render(scene, camera);
    },
    /** Resolves when the GPU has done everything it has been sent. */
    gpuDone() {
      const gl = renderer.getContext();
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      return new Promise((resolve) => {
        const poll = () => {
          if (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) return void setTimeout(poll, 4);
          gl.deleteSync(sync);
          resolve();
        };
        poll();
      });
    },
  };
}

/** The wind as cloth feels it: the same bands the leaves and grasses move in. */
export function makeAir(clock, strength = 1) {
  const wind = { x: WIND.x, z: WIND.y };
  return (x, y, z, out) => {
    const time = clock();
    const along = x * wind.x + z * wind.z, across = -x * wind.z + z * wind.x;
    const gust = THREE.MathUtils.clamp(0.5 + 0.8 * noise((along - time * 4) / 40, across / 90) + 0.3 * noise((along - time * 6.5) / 11, across / 17), 0, 1);
    const speed = (0.4 + 3.2 * gust * gust) * strength;
    return out.set(wind.x * speed, 0.25 * Math.sin(time * 2.3 + x) * gust, wind.z * speed);
  };
}

// How the arms are held for what has no clip of its own, in the hero's own frame (+x his left, +y up, +z ahead):
// each row is [bone, the bone it points at, where it points before, where it points at the height of the move].
const POSES = {
  bow: [
    ['upperarm_l', 'lowerarm_l', V(0.3, -0.3, 0.9), V(0.2, 0.03, 0.98)], ['lowerarm_l', 'hand_l', V(0.1, 0.1, 0.99), V(0.08, 0.03, 0.99)],
    ['upperarm_r', 'lowerarm_r', V(-0.3, -0.25, 0.9), V(-0.82, 0.06, -0.42)], ['lowerarm_r', 'hand_r', V(0.3, 0.2, 0.93), V(0.72, 0.1, 0.62)],
  ],
  cast: [
    ['upperarm_r', 'lowerarm_r', V(-0.55, 0.55, -0.35), V(-0.25, 0.12, 0.95)], ['lowerarm_r', 'hand_r', V(-0.1, 0.95, 0.1), V(0.0, 0.12, 1.0)],
  ],
  bless: [
    ['upperarm_l', 'lowerarm_l', V(0.7, 0.1, 0.4), V(0.62, 0.62, 0.2)], ['lowerarm_l', 'hand_l', V(0.5, 0.5, 0.5), V(0.3, 0.92, 0.12)],
    ['upperarm_r', 'lowerarm_r', V(-0.7, 0.1, 0.4), V(-0.62, 0.62, 0.2)], ['lowerarm_r', 'hand_r', V(-0.5, 0.5, 0.5), V(-0.3, 0.92, 0.12)],
  ],
};

export async function play(realmModule, heroId, card) {
  const def = HEROES[heroId] ?? HEROES.rama;
  let shown = true, loaded = false;
  const block = patchBlock({ ...recipe.block, onSet() {}, onTrigger() {}, onVisible(visible) { shown = visible; if (loaded) run(); } });
  let told = 0;
  const say = (value, label) => { told = Math.max(told, value); block.progress(told, label); card?.progress(told, label); };
  say(0.03, 'Stretching the canvas');

  const canvas = createCanvas({ far: realmModule.info?.far ?? 4000 });
  const { renderer, shared, scene, camera } = canvas;
  if (q.has('impasto')) shared.uImpasto.value = +q.get('impasto');
  const rigsComing = loadRigs({ onProgress: (done) => say(0.05 + 0.3 * done, 'Fetching the heroes') });

  // --- the world ---
  const realm = await realmModule.build({ shared, renderer, scene, camera, q, low: canvas.low(), say: (v, label) => say(0.35 + 0.3 * v, label), turn });
  scene.add(...realm.add);
  const shade = createShade(renderer, shared, realm.shade.scene, realm.shade.options);
  say(0.66, 'Fetching the heroes');
  await turn();

  await RAPIER.init();
  const physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  {
    const f = realm.heightField();
    physics.createCollider(RAPIER.ColliderDesc.heightfield(f.cells, f.cells, f.heights, { x: 2 * f.half, y: 1, z: 2 * f.half }));
    for (const t of realm.solids?.posts ?? []) physics.createCollider(RAPIER.ColliderDesc.cylinder((t.h ?? 8) / 2, t.r).setTranslation(t.x, t.y + (t.h ?? 8) / 2, t.z));
    for (const s of realm.solids?.boxes ?? []) {
      const d = RAPIER.ColliderDesc.cuboid(s.hx, s.hy, s.hz).setTranslation(s.x, s.y, s.z);
      if (s.rotY) d.setRotation({ x: 0, y: Math.sin(s.rotY / 2), z: 0, w: Math.cos(s.rotY / 2) });
      physics.createCollider(d);
    }
  }
  const heightAt = realm.heightAt;

  // --- the hero ---
  const rigs = await rigsComing;
  const body = rigs.spawn(def.body);
  const character = buildCharacter(shared, body, def, { light: realm.light });
  scene.add(body.object, character.group);
  const legs = def.body === 'woman' ? body.height / rigs.templates.man.height : 1;
  const pace = (def.stats.pace ?? 1) * legs;
  const animator = new Animator(body, { ...SETUP, speeds: Object.fromEntries(Object.entries(SETUP.speeds).map(([k, v]) => [k, v * pace])) });
  const start = realm.spawn;
  const spawn = V(start.x, heightAt(start.x, start.z), start.z);
  const player = new Hero({ RAPIER, world: physics, man: body, animator, spawn, yaw: start.yaw ?? Math.PI }, def.stats);
  const follow = new Follow(camera);
  follow.yaw = start.yaw ?? Math.PI;
  Object.assign(follow, realm.camera ?? {});
  const input = new Input(renderer.domElement, { pads: !capture && !q.has('nopad') });
  physics.step();

  let time = 0;
  const air = realm.air ?? makeAir(() => time, realm.wind ?? 1);
  const fx = createFx(shared);
  scene.add(fx.group);
  const foes = createFoes({ shared, rigs, scene, fx, light: realm.light, heightAt, keep: realm.keep });
  const castRay = (o, d, max) => player.castRay(o, d, max);
  const combat = createCombat({ fx, foes, castRay, heightAt });
  const hud = createHud(def);
  if (capture && !q.has('hud')) hud.hide(true);

  const frame = canvas.makeFrame();
  frame.uniforms.uShafts.value = q.has('shafts') ? +q.get('shafts') : realm.shafts && !canvas.low() ? realm.shafts : 0;
  window.patch?.addEventListener?.('qualitychange', () => { renderer.setPixelRatio(Math.min(devicePixelRatio, canvas.low() ? 1 : 1.5)); canvas.fit(); realm.quality?.(canvas.low()); });
  realm.quality?.(canvas.low());

  // --- the hero's state ---
  const maxHealth = def.stats.health;
  let health = maxHealth, dead = false, sinceHurt = 99, shake = 0, leaving = false;
  const cool = { primary: 0, special: 0 };
  let pose = null; // an arm pose being played: { kind, t, fireAt, end, fired, fire }
  let swingCount = 0, slamming = false;
  const checkpoint = { x: spawn.x, z: spawn.z, yaw: start.yaw ?? Math.PI };
  const chest = V(0, 0, 0), aimDir = V(0, 0, 1), eye = V(0, 0, 0), tmp = V(0, 0, 0), aimFrame = new THREE.Quaternion(), yawQ = new THREE.Quaternion(), pitchQ = new THREE.Quaternion();
  const X = V(1, 0, 0), Y = V(0, 1, 0);
  const wants = { primary: false, special: false };

  hud.health(health, maxHealth);

  const game = {
    def, heroId, realm, player, character, foes, fx, hud, shared, camera, scene, rigs, combat, heightAt, story,
    get ctx() { return ctx; },
    get time() { return time; },
    get health() { return health; },
    get feet() { return player.feet; },
    objective: (text) => hud.objective(text),
    say: (text, seconds) => hud.say(text, seconds),
    heal(n) { health = Math.min(maxHealth, health + n); hud.health(health, maxHealth); },
    checkpoint(x, z, yaw = player.yaw) { checkpoint.x = x; checkpoint.z = z; checkpoint.yaw = yaw; },
    spawnFoe: (foeDef, x, z, options) => foes.spawn(foeDef, x, z, options),
    hurt,
    /** The realm is done: on to the next, or to the end of the tale. */
    async finish(next = story.next(realm.id)) {
      if (leaving) return;
      leaving = true;
      story.finish(realm.id);
      await hud.fade(1, 1.6);
      if (!capture) story.go(next ?? 'ending');
    },
  };

  function hurt(damage, from) {
    if (dead || leaving) return;
    health -= damage;
    sinceHurt = 0;
    shake = Math.min(0.5, shake + 0.25);
    hud.health(health, maxHealth);
    hud.flash();
    if (health <= 0) {
      dead = true;
      player.fall();
      hud.say('You fall. The tale is not over.', 3);
      setTimeout(async () => {
        await hud.fade(1, 0.8);
        player.place(checkpoint.x, heightAt(checkpoint.x, checkpoint.z), checkpoint.z, checkpoint.yaw);
        follow.yaw = checkpoint.yaw; follow.pivot.set(0, 0, 0);
        health = maxHealth; dead = false;
        hud.health(health, maxHealth);
        for (const foe of foes.list) { foe.awake = false; foe.state = 'idle'; }
        realm.onRespawn?.(game);
        hud.fade(0, 0.8);
      }, capture ? 0 : 2200);
    }
  }

  // --- what the hero can do ---
  function aim() {
    // where the eye looks, or, if a foe stands near that line, the foe
    camera.getWorldDirection(aimDir);
    chest.set(player.feet.x, player.feet.y + 1.35 * (body.height / 1.8), player.feet.z);
    const target = foes.inSights(camera.position, aimDir, 80, 0.16);
    if (target) aimDir.set(target.pos.x, target.pos.y + target.height * 0.6, target.pos.z).sub(chest).normalize();
    else {
      // the eye sits behind and above him: meet its line of sight a long way out
      tmp.copy(camera.position).addScaledVector(aimDir, 60).sub(chest).normalize();
      aimDir.copy(tmp);
    }
    return aimDir;
  }
  function loose(kind, spec, spread = 0) {
    const dir = aim().clone();
    if (spread) dir.applyAxisAngle(Y, spread);
    const from = chest.clone().addScaledVector(dir, 0.7);
    combat.shoot({ kind, pos: from, dir, speed: spec.speed, damage: spec.damage });
  }
  function startPose(kind, fireAt, end, fire) { pose = { kind, t: 0, fireAt, end, fired: false, fire }; }
  function meleeFace() {
    const near = foes.nearest(player.feet, 5);
    return near ? Math.atan2(near.pos.x - player.feet.x, near.pos.z - player.feet.z) : follow.yaw;
  }
  function doPrimary() {
    const spec = def.primary;
    if (cool.primary > 0 || dead || player.busy || pose) return false;
    if (spec.kind === 'arrow') startPose('bow', 0.26, 0.62, () => loose('arrow', spec));
    else if (spec.kind === 'lotus') startPose('cast', 0.24, 0.6, () => loose('lotus', spec));
    else {
      const clip = spec.kind === 'mace' ? (swingCount++ % 2 ? 'Sword_Regular_B' : 'Sword_Regular_A') : (swingCount++ % 2 ? 'Sword_Regular_B' : 'Sword_Regular_A');
      const face = meleeFace();
      const ok = player.act(clip, {
        rate: spec.kind === 'mace' ? 1.0 : 1.25, face, hitAt: 0.42, fade: 0.08,
        onHit: () => {
          tmp.copy(player.feet).addScaledVector(V(Math.sin(player.yaw), 0, Math.cos(player.yaw)), 0.9);
          const n = foes.strike(player.feet, spec.reach, spec.damage, { facing: player.yaw, arc: 2.4, push: spec.kind === 'mace' ? 1.8 : 1 });
          tmp.y += 1.1;
          if (n) { shake = Math.max(shake, spec.kind === 'mace' ? 0.22 : 0.1); fx.burst(tmp, [1.0, 0.85, 0.5], { count: 8, speed: 5, size: [0.05, 0.4], life: 0.3 }); }
        },
      });
      if (!ok) return false;
    }
    cool.primary = spec.cooldown;
    return true;
  }
  function doSpecial() {
    const spec = def.special;
    if (cool.special > 0 || dead || player.busy || pose) return false;
    if (spec.kind === 'astra') {
      startPose('bow', 0.7, 1.1, () => { loose('astra', spec); shake = Math.max(shake, 0.25); });
      fx.rise(player.feet, [0.7, 0.8, 1.0], { count: 20, spread: 0.7, life: 0.9 });
    } else if (spec.kind === 'bloom') {
      startPose('bless', 0.5, 1.3, () => {
        const at = player.feet.clone();
        foes.strike(at, spec.radius, spec.damage, { stun: 3.2, push: 0.6 });
        game.heal(spec.heal);
        fx.ring(at, [1.0, 0.75, 0.55], { count: 44, speed: spec.radius * 1.5, size: [0.14, 0.5] });
        fx.ring(at, [1.0, 0.72, 0.8], { count: 30, speed: spec.radius * 1.2, size: [0.1, 0.15], which: fx.paint, life: 1.2 });
        fx.rise(at, [1.0, 0.85, 0.6], { count: 34, spread: spec.radius * 0.5, life: 1.6 });
      });
    } else if (spec.kind === 'whirl') {
      const ok = player.act('Sword_Regular_C', {
        rate: 1.7, face: meleeFace(), hitAt: 0.3, fade: 0.08,
        onHit: () => {
          foes.strike(player.feet, spec.radius, spec.damage, { push: 1.6 });
          fx.ring(player.feet, [0.85, 0.92, 1.0], { count: 32, speed: spec.radius * 2.2, size: [0.08, 0.9], life: 0.45, lift: 1.0 });
          shake = Math.max(shake, 0.18);
        },
      });
      if (!ok) return false;
    } else if (spec.kind === 'slam') {
      if (!player.leap(1 / 60, 5.2)) return false;
      // he goes up and forward, and comes down hard
      const f = V(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      player.vel.x = f.x * 7; player.vel.z = f.z * 7;
      slamming = true;
    }
    cool.special = spec.cooldown;
    return true;
  }
  player.onLand = (fallSpeed) => {
    if (slamming) {
      slamming = false;
      const spec = def.special;
      foes.strike(player.feet, spec.radius, spec.damage, { push: 2.2, stun: 0.8 });
      fx.ring(player.feet, [1.0, 0.8, 0.45], { count: 46, speed: spec.radius * 1.8, size: [0.2, 0.8] });
      fx.burst(player.feet, [0.75, 0.62, 0.45], { count: 22, speed: 6, size: [0.16, 0.3], life: 0.9, gravity: 9, up: 0.9, sheet: fx.paint });
      shake = 0.5;
    } else if (fallSpeed > 9 && def.stats.jump > 2) {
      fx.burst(player.feet, [0.75, 0.62, 0.45], { count: 8, speed: 3, size: [0.12, 0.22], life: 0.6, gravity: 8, up: 0.8, sheet: fx.paint });
    }
  };

  // clicks and keys for the two moves (the mouse is caught for looking by the first click)
  renderer.domElement.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    if (e.button === 0) wants.primary = true;
    if (e.button === 2) wants.special = true;
  });
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyJ' || e.code === 'KeyF') wants.primary = true;
    if (e.code === 'KeyE' || e.code === 'KeyK' || e.code === 'KeyQ') wants.special = true;
  });
  const padWas = { x: false, y: false };

  const ctx = { air, ground: heightAt, aim: null, eye };
  const heroState = { pos: player.feet, alive: true };
  function tick(dt) {
    dt = Math.min(dt, 1 / 20);
    time += dt;
    const inp = input.read(dt);
    // the right mouse button is the special move here, not a sidestep; he faces where he aims while he does
    inp.strafe = !!pose;
    const pad = input.pads ? [...(navigator.getGamepads?.() ?? [])].find((p) => p && p.connected) : null;
    if (pad) {
      const x = !!pad.buttons[2]?.pressed, y = !!pad.buttons[3]?.pressed || !!pad.buttons[1]?.pressed;
      if (x && !padWas.x) wants.primary = true;
      if (y && !padWas.y) wants.special = true;
      padWas.x = x; padWas.y = y;
    }
    if (dead || leaving) { inp.move = { x: 0, y: 0 }; inp.jump = false; wants.primary = wants.special = false; }
    if (wants.special) doSpecial();
    if (wants.primary) doPrimary();
    wants.primary = wants.special = false;
    cool.primary = Math.max(0, cool.primary - dt);
    cool.special = Math.max(0, cool.special - dt);
    hud.cooldowns(cool.primary / def.primary.cooldown, cool.special / def.special.cooldown);

    player.update(dt, inp, follow.yaw);
    if (realm.outside?.(player.feet) && !dead) {
      player.place(checkpoint.x, heightAt(checkpoint.x, checkpoint.z), checkpoint.z, checkpoint.yaw);
      follow.yaw = checkpoint.yaw; follow.pivot.set(0, 0, 0);
    }
    const root = player.visualRoot(dt);
    const man = body;
    man.object.position.copy(root);
    man.object.rotation.set(0, player.yaw, 0);
    man.object.updateMatrixWorld(true);
    const local = player.vel.clone().applyAxisAngle(Y, -player.yaw);
    animator.update(dt, { speed: player.mode === 'move' ? player.speed : Math.hypot(local.x, local.z), moveAngle: player.moveAngle, grounded: player.grounded });
    const acting = player.busy;
    if (!acting) {
      animator.relaxHands(player.speed);
      animator.uprightTrunk(dt, player.speed, player.grounded && player.mode !== 'jump' && player.mode !== 'air' ? 1 : 0.3);
      const lookW = player.mode === 'move' || player.mode === 'idleExtra' ? THREE.MathUtils.clamp(1 - (player.speed - 1.5) / 2, 0, 1) : 0;
      animator.lookToward(dt, camera.getWorldDirection(tmp), lookW);
      animator.armClearance(dt);
      if (player.mode === 'move' && !player.strafe) animator.leanInto(dt, player.turnRate, player.speed, player.accelF);
      else animator.leanInto(dt, 0, 0, 0);
    }
    const onGround = player.grounded && player.mode !== 'jump' && player.mode !== 'air';
    if (player.mode !== 'down') animator.placeFeet(dt, (x, z, from) => player.ground(x, z, from, 1.4), root.y, onGround ? 1 : 0);
    man.object.updateMatrixWorld(true);

    // arms held by hand: drawing the bow, throwing, blessing
    ctx.aim = null;
    if (pose) {
      pose.t += dt;
      const rise = Math.min(1, pose.t / Math.max(0.08, pose.fireAt * 0.75));
      const fall = pose.t > pose.fireAt + 0.1 ? Math.max(0, 1 - (pose.t - pose.fireAt - 0.1) / Math.max(0.1, pose.end - pose.fireAt - 0.1)) : 1;
      const w = rise * rise * (3 - 2 * rise) * fall;
      const draw = pose.kind === 'cast' ? (pose.t < pose.fireAt - 0.1 ? 0 : Math.min(1, (pose.t - pose.fireAt + 0.1) / 0.14)) : Math.min(1, pose.t / pose.fireAt);
      const dir = aim();
      // the frame the pose is held in: his heading, tipped up or down to where he aims
      yawQ.setFromAxisAngle(Y, Math.atan2(dir.x, dir.z));
      pitchQ.setFromAxisAngle(X, -Math.asin(THREE.MathUtils.clamp(dir.y, -0.7, 0.7)) * (pose.kind === 'bless' ? 0 : 1));
      aimFrame.copy(yawQ).multiply(pitchQ);
      for (const [bone, child, a, b] of POSES[pose.kind]) character.point(bone, child, tmp.copy(a).lerp(b, draw), w, aimFrame);
      if (pose.kind === 'bow') ctx.aim = dir;
      if (!pose.fired && pose.t >= pose.fireAt) { pose.fired = true; pose.fire(); }
      if (pose.t >= pose.end) pose = null;
    }
    // a weapon is gripped, whatever the clip's fingers do
    const grip = def.gear.includes('bow') ? '_l' : def.gear.some((g) => g === 'gada' || g === 'sword') ? '_r' : null;
    if (grip) for (const f of animator.fingerPoses ?? []) if (f.bone.name.endsWith(grip)) f.bone.quaternion.slerpQuaternions(f.flat, f.fist, f.thumb ? 0.75 : 1);
    man.object.updateMatrixWorld(true);
    character.update(dt, ctx);

    // foes, and what is in the air
    heroState.alive = !dead && !leaving;
    eye.copy(camera.position);
    for (const e of foes.update(dt, heroState, ctx)) hurt(e.damage, e.from);
    for (const e of combat.update(dt, heroState)) hurt(e.damage, e.from);
    fx.update(dt);
    sinceHurt += dt;
    if (!dead && sinceHurt > 6 && health < maxHealth) { health = Math.min(maxHealth, health + 4 * dt); hud.health(health, maxHealth); }
    hud.aim(!!pose && pose.kind !== 'bless');
    realm.update?.(dt, time, game);

    // a wall or a trunk between the eye and him brings the eye in; over the ground it rises instead
    follow.update(dt, root, inp.look, inp.zoom, (o, d, max) => {
      let hit = player.castRay(o, d, max);
      if (hit != null && o.y + d.y * hit - heightAt(o.x + d.x * hit, o.z + d.z * hit) < 0.5) hit = null;
      const other = realm.block?.(o, d, max);
      return other != null && (hit == null || other < hit) ? other : hit;
    }, (x, z) => heightAt(x, z) + 0.5);
    if (shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shake * 0.5; camera.position.y += (Math.random() - 0.5) * shake * 0.5;
      shake *= Math.exp(-7 * dt);
    }
    if (realm.lamp) {
      shared.uLamp.value.set(root.x, root.y + 1.2, root.z, realm.lamp);
    }
    realm.follow?.(camera.position.x, camera.position.z);
    shade.update(scene, root);
    canvas.paint(time, root);
  }

  window.lab = {
    THREE, game, player, follow, camera, input, animator, character, shared, frame, renderer, foes, combat, fx, realm, heightAt,
    step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) tick(dt); },
    setInput(fn) { input.override = fn; },
    /** Walks him: forward (y) and right (x), for n frames. */
    walk(n = 60, y = 1, x = 0, sprint = false) {
      input.override = () => ({ move: { x, y }, walk: false, sprint, strafe: false, jump: false, look: { x: 0, y: 0 }, zoom: 0, device: 'keyboard' });
      for (let i = 0; i < n; i++) tick(1 / 60);
      input.override = () => ({ move: { x: 0, y: 0 }, walk: false, sprint: false, strafe: false, jump: false, look: { x: 0, y: 0 }, zoom: 0, device: 'keyboard' });
    },
    /** Puts him at (x, z) on the ground, facing (fx, fz), with the eye behind him. */
    teleport(x, z, fx = x, fz = z - 1) {
      player.place(x, heightAt(x, z), z, Math.atan2(fx - x, fz - z));
      follow.yaw = player.yaw; follow.pivot.set(0, 0, 0);
      tick(1 / 60);
    },
    /** A fixed view for stills: eye and what it looks at. Call with nothing to go back to following him. */
    view(eyeAt, target) { follow.free = eyeAt ? { position: new THREE.Vector3(...eyeAt), target: new THREE.Vector3(...target) } : null; },
    primary() { wants.primary = true; },
    special() { wants.special = true; },
    state() { return { health, dead, mode: player.mode, feet: player.feet.toArray().map((v) => +v.toFixed(2)), foes: foes.list.length, alive: foes.alive().length, objective: hud.root.querySelector('.hud-goal')?.textContent }; },
  };
  if (capture) input.override = () => ({ move: { x: 0, y: 0 }, walk: false, sprint: false, strafe: false, jump: false, look: { x: 0, y: 0 }, zoom: 0, device: 'keyboard' });

  // --- warming up: every shader is built and drawn once before anyone is let in ---
  say(0.7, 'Mixing paint');
  realm.begin?.(game);
  if (!capture) {
    renderer.debug.checkShaderErrors = false;
    await renderer.compileAsync(scene, camera);
    say(0.86, 'Mixing paint');
  }
  for (let i = 0; i < (capture ? 1 : 4); i++) {
    tick(1 / 60);
    if (capture) break;
    await canvas.gpuDone();
    say(0.88 + 0.03 * i, 'First strokes');
    await turn();
  }

  let running = false, last = 0;
  function run() {
    const want = shown && !capture && started;
    if (want === running) return;
    running = want;
    last = performance.now();
    renderer.setAnimationLoop(want ? () => { const now = performance.now(); tick((now - last) / 1000); last = now; } : null);
  }
  let started = false;
  canvas.fit();
  loaded = true;
  say(1, 'Ready');
  block.ready();
  window.lab.ready = true;
  window.__block = { ready: true, block, set() {} };
  /** Lets the player in: the clock starts and the realm says its name. */
  return {
    game,
    begin() {
      started = true;
      hud.title(realm.name, realm.subtitle);
      const hint = document.getElementById('hint');
      if (hint && !capture) {
        hint.classList.remove('off');
        addEventListener('keydown', (e) => { if (e.code === 'KeyH') hint.classList.toggle('off'); });
        setTimeout(() => hint.classList.add('faded'), 14000);
      }
      run();
    },
  };
}
