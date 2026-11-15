// The chosen hero as a player: the starter man's controller (walk, run, jump, turns: src/figure/player.js) with
// what a hero adds to it: a blow or a throw played out as a clip while he stands his ground, a great leap, and
// being struck down.
import * as THREE from 'three';
import { Player, TUNING } from '../figure/player.js';

const ZERO = new THREE.Vector3();

export class Hero extends Player {
  constructor(options, stats = {}) {
    super({ ...options, tuning: { ...TUNING, jumpHeight: stats.jump ?? TUNING.jumpHeight, airControl: (stats.jump ?? 0) > 2 ? 5 : TUNING.airControl } });
    this.action = null;
    this.onLand = null; // (fallSpeed) => void
  }

  update(dt, input, camYaw) {
    if (this.mode === 'act') return this.acting(dt);
    if (this.mode === 'down') return this.step(dt, ZERO, true);
    const before = this.mode;
    const out = super.update(dt, input, camYaw);
    if (before !== 'land' && this.mode === 'land') this.onLand?.(this.lastFallSpeed ?? 0);
    return out;
  }

  get busy() { return this.mode === 'act' || this.mode === 'down'; }

  /**
   * Plays `clip` from `from` to `to` (shares of it) standing where he is, turning to `face` (a yaw) as he does.
   * onHit is called once, when the clip is `hitAt` of the way through.
   */
  act(clip, { from = 0, to = 1, rate = 1, fade = 0.1, face = null, hitAt = 0.5, onHit = null } = {}) {
    if (!this.grounded || this.busy || this.mode === 'jump' || this.mode === 'air') return false;
    const A = this.anim;
    this.mode = 'act';
    this.speed = 0;
    this.action = { from, to, face, hitAt, onHit, fired: false };
    A.enter(A.oneShot('act', clip, { from, to, rate }), fade);
    return true;
  }

  acting(dt) {
    const A = this.anim, st = A.state, a = this.action;
    if (a.face != null) this.yaw = this.turnToward(this.yaw, a.face, 16, dt);
    const done = (st.u - a.from) / Math.max(1e-4, a.to - a.from);
    if (!a.fired && done >= a.hitAt) { a.fired = true; a.onHit?.(); }
    if (st.done || st.kind !== 'act') {
      this.mode = 'move';
      A.enter(A.locoState({ strafe: this.strafe }), 0.22);
    }
    return this.step(dt, ZERO, true);
  }

  /** A jump to `height` metres, whatever his usual jump is. */
  leap(dt, height) {
    if (!this.grounded || this.busy || this.mode === 'jump' || this.mode === 'air') return false;
    this.jump(dt, null);
    this.vel.y = Math.sqrt(2 * this.t.gravity * height);
    return true;
  }

  /** Struck down: he falls and lies until `rise` is called. */
  fall() {
    if (this.mode === 'down') return;
    const A = this.anim;
    this.mode = 'down';
    this.speed = 0;
    A.enter(A.oneShot('down', 'Hit_Knockback', { from: 0, to: 0.98 }), 0.1);
  }
  rise() {
    const A = this.anim;
    this.mode = 'move';
    A.enter(A.locoState({ strafe: false }), 0.3);
  }

  /** Puts him at (x, z) on the ground, facing `yaw`, standing. */
  place(x, y, z, yaw) {
    const half = this.halfHeight();
    this.body.setTranslation({ x, y: y + this.t.radius + half + 0.05, z }, true);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.feet.set(x, y, z); this.prevFeet.copy(this.feet); this.visualY = y;
    this.vel.set(0, 0, 0); this.speed = 0; this.mode = 'move'; this.grounded = true;
    this.yaw = this.lastYaw = yaw;
    this.anim.lock = null; this.anim.lockOff = null;
    this.anim.enter(this.anim.locoState({ strafe: false }), 0.05);
  }
}
