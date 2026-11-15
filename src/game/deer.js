// The golden deer: Maricha in the shape Ravana gave him, to draw the hunters from the hermitage. A small made
// creature of a few painted shapes on legs that swing, covered in dabs of gold with pale spots.
import * as THREE from 'three';
import { paint } from '../figure/figure.js';
import { pinDabs } from '../oilpaint/pins.js';

const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);

export function createDeer({ shared, fx, heightAt, light = (p) => p }) {
  const GOLD = light([[1.0, 0.86, 0.36], [0.88, 0.6, 0.16], [0.52, 0.31, 0.12]]);
  const SPOT = light([[1.0, 0.98, 0.86], [0.92, 0.8, 0.6], [0.6, 0.48, 0.4]]);
  const root = new THREE.Group();
  const parts = [];
  const part = (geometry, parent, count, size, dir = FWD) => {
    const mesh = new THREE.Mesh(geometry, paint(shared, GOLD, { grain: 3 }));
    mesh.layers.enable(1);
    parent.add(mesh);
    parts.push({ mesh, count, style: (p) => ({ pal: Math.abs(Math.sin(p.x * 71 + p.y * 53 + p.z * 37)) > 0.82 ? 1 : 0, size, dir }) });
    return mesh;
  };
  const trunk = new THREE.Group();
  trunk.position.y = 0.8;
  root.add(trunk);
  const barrel = new THREE.CapsuleGeometry(0.2, 0.56, 4, 9);
  barrel.rotateX(Math.PI / 2);
  part(barrel, trunk, 90, [0.06, 0.13]);
  const neck = new THREE.CylinderGeometry(0.07, 0.11, 0.46, 7);
  neck.rotateX(0.55); neck.translate(0, 0.27, 0.4);
  part(neck, trunk, 22, [0.045, 0.1], UP);
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.54);
  trunk.add(head);
  const skull = new THREE.SphereGeometry(1, 9, 7);
  skull.scale(0.08, 0.09, 0.15); skull.translate(0, 0, 0.06);
  part(skull, head, 18, [0.035, 0.07]);
  for (const s of [1, -1]) {
    const ear = new THREE.ConeGeometry(0.03, 0.12, 5);
    ear.rotateZ(-s * 0.9); ear.translate(s * 0.09, 0.07, -0.02);
    part(ear, head, 3, [0.03, 0.07], UP);
    // antlers: a beam and two tines
    const beam = new THREE.CylinderGeometry(0.008, 0.014, 0.34, 4);
    beam.rotateZ(-s * 0.35); beam.rotateX(-0.25); beam.translate(s * 0.07, 0.25, -0.03);
    part(beam, head, 5, [0.016, 0.1], UP);
    const tine = new THREE.CylinderGeometry(0.005, 0.01, 0.16, 4);
    tine.rotateX(0.9); tine.translate(s * 0.1, 0.3, 0.04);
    part(tine, head, 3, [0.012, 0.07], UP);
  }
  const tail = new THREE.ConeGeometry(0.035, 0.14, 5);
  tail.rotateX(-2.2); tail.translate(0, 0.08, -0.5);
  part(tail, trunk, 3, [0.03, 0.07], UP);
  const legs = [];
  for (const [x, z, phase] of [[0.11, 0.3, 0], [-0.11, 0.3, Math.PI * 0.9], [0.11, -0.3, Math.PI * 1.1], [-0.11, -0.3, 0.2]]) {
    const hip = new THREE.Group();
    hip.position.set(x, -0.05, z);
    trunk.add(hip);
    const leg = new THREE.CylinderGeometry(0.038, 0.022, 0.76, 5);
    leg.translate(0, -0.38, 0);
    part(leg, hip, 9, [0.028, 0.12], UP);
    legs.push({ hip, phase });
  }
  const pins = pinDabs(shared, [GOLD, SPOT], parts);

  let phase = 0, speed = 0, yaw = 0, path = null, at = 0, glitter = 0, shown = true;
  const pos = root.position, v = new THREE.Vector3();
  const api = {
    root, dabs: pins.mesh, position: pos,
    get moving() { return !!path; },
    place(x, z, facing = 0) { pos.set(x, heightAt(x, z), z); yaw = facing; path = null; speed = 0; },
    /** Runs through the points [[x, z], ...] in turn and stops at the last. */
    run(points, pace = 8.5) { if (!points.length) return; path = points; at = 0; speed = pace; },
    face(x, z) { yaw = Math.atan2(x - pos.x, z - pos.z); },
    show(on) { shown = on; root.visible = pins.mesh.visible = on; },
    update(dt, time) {
      if (!shown) return;
      if (path) {
        const [tx, tz] = path[at];
        const dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz);
        const step = speed * dt;
        if (d <= step + 0.3) { at++; if (at >= path.length) { path = null; speed = 0; } }
        else {
          // it goes straight for the next point of its way; only its body is slower to come round
          const want = Math.atan2(dx, dz);
          yaw += THREE.MathUtils.clamp(Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)), -9 * dt, 9 * dt);
          pos.x += (dx / d) * step; pos.z += (dz / d) * step;
        }
      }
      const going = path ? 1 : 0;
      phase += dt * (path ? 13 : 0);
      const ground = heightAt(pos.x, pos.z);
      // it goes in bounds: all four feet off the ground together at the top of each
      pos.y = ground + going * 0.28 * Math.abs(Math.sin(phase * 0.5));
      root.rotation.set(0, yaw, 0);
      trunk.rotation.x = going * 0.12 * Math.sin(phase);
      for (const l of legs) l.hip.rotation.x = going * 0.75 * Math.sin(phase + l.phase);
      head.rotation.y = going ? 0 : 0.5 * Math.sin(time * 0.7);
      head.rotation.x = going ? -0.2 : 0.12 * Math.sin(time * 1.3);
      root.updateMatrixWorld(true);
      pins.update();
      glitter -= dt;
      if (glitter <= 0) {
        glitter = 0.09;
        v.set(pos.x + (Math.random() - 0.5) * 0.7, pos.y + 0.5 + Math.random() * 0.8, pos.z + (Math.random() - 0.5) * 0.7);
        fx.light.add({ pos: v, vel: new THREE.Vector3(0, 0.4, 0), dir: UP, size: [0.035, 0.12], color: [0.7, 0.55, 0.2], life: 0.6, fade: 'inout' });
      }
    },
  };
  return api;
}
