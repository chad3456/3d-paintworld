// The bodies everyone in the game is made from, and the clips that move them.
//
//   man     Patch's starter man (a MakeHuman figure on the skeleton of Quaternius' Universal Animation Library)
//   woman   a MakeHuman woman from Patch's library, put onto that same skeleton here, when the page loads
//
// Both end up with the same bones by the same names, resting the same way, so every clip plays on either: the
// starter man's own (walk, run, jump, turns) and the fighting clips cut from the Universal Animation Library 2
// (tools/make-assets.mjs). A template is loaded once; `spawn` hands out as many copies as the scene needs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/** Clips as the game plays them (in place), their travel (`motion`), and as they were made (`raw`). */
function sortClips(animations, scale = 1) {
  const out = { clips: {}, motion: {}, raw: {} };
  for (const source of animations) {
    let clip = source;
    if (scale !== 1) {
      // another body, other legs: the hips travel in proportion to them
      clip = source.clone();
      for (const t of clip.tracks) if (t.name === 'pelvis.position' || t.name === 'root.position') t.values = t.values.map((v) => v * scale);
    }
    out.raw[clip.name] = clip;
    const root = clip.tracks.find((t) => t.name === 'root.position');
    const rootRot = clip.tracks.find((t) => t.name === 'root.quaternion');
    const motion = { speed: 0, velocity: new THREE.Vector3(), yaw: 0, duration: clip.duration };
    if (root) {
      const v = root.values, n = v.length;
      motion.velocity.set(v[n - 3] - v[0], 0, v[n - 1] - v[2]).divideScalar(clip.duration || 1);
      motion.speed = motion.velocity.length();
    }
    if (rootRot) {
      const v = rootRot.values, n = v.length;
      const q0 = new THREE.Quaternion().fromArray(v, 0), q1 = new THREE.Quaternion().fromArray(v, n - 4);
      const d = q1.multiply(q0.invert());
      motion.yaw = 2 * Math.atan2(d.y, d.w);
    }
    out.motion[clip.name] = motion;
    out.clips[clip.name] = new THREE.AnimationClip(clip.name, clip.duration, clip.tracks.filter((t) => !t.name.startsWith('root.')));
  }
  return out;
}

const partsOf = (object) => {
  const meshes = [], bones = {};
  object.traverse((o) => {
    if (o.isSkinnedMesh) { o.frustumCulled = false; meshes.push(o); }
    if (o.isBone) bones[o.name] = o;
  });
  return { meshes, bones };
};

/** Where the joints are, and the box of the head, with the body standing at rest (arms out) at the origin. */
function measure(object, meshes, bones) {
  object.position.set(0, 0, 0); object.rotation.set(0, 0, 0); object.scale.set(1, 1, 1);
  object.updateMatrixWorld(true);
  for (const m of meshes) m.skeleton.update();
  const rest = {};
  for (const [name, b] of Object.entries(bones)) rest[name] = b.getWorldPosition(new THREE.Vector3());
  const head = new THREE.Box3(), all = new THREE.Box3(), p = new THREE.Vector3();
  const neck = rest.Head.y - 0.01;
  for (const m of meshes) {
    if (/eyebrow|eyelash/.test(m.name)) continue;
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 2) {
      m.getVertexPosition(i, p).applyMatrix4(m.matrixWorld);
      all.expandByPoint(p);
      // the head, without a braid or long hair hanging behind it
      if (p.y > neck && Math.abs(p.x) < 0.14 && !/braid|long/.test(m.name)) head.expandByPoint(p);
    }
  }
  return { rest, head, height: all.max.y };
}

/**
 * Puts the woman's meshes on a copy of the man's skeleton. His bones are moved to her joints and turned, each by
 * the least turn that points it at her next joint, which poses his skeleton inside her as she was modelled; her
 * skin is bound to it there. Afterwards the bones go back to their resting turns, and she stands as he does.
 */
function rigWoman(man, gltf) {
  const her = gltf.scene;
  her.updateMatrixWorld(true);
  const RENAME = { Root: 'root', head: 'Head' };
  const joint = {};
  const herMeshes = [];
  her.traverse((o) => {
    if (o.isBone) joint[RENAME[o.name] ?? o.name] = o.getWorldPosition(new THREE.Vector3());
    if (o.isSkinnedMesh) herMeshes.push(o);
  });
  const object = SkeletonUtils.clone(man.object);
  object.position.set(0, 0, 0); object.rotation.set(0, 0, 0);
  const his = [];
  object.traverse((o) => { if (o.isSkinnedMesh) his.push(o); });
  for (const m of his) m.removeFromParent();
  const bones = {};
  object.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  object.updateMatrixWorld(true);
  const rest = {};
  for (const [name, b] of Object.entries(bones)) rest[name] = { q: b.quaternion.clone(), p: b.position.clone() };
  const manHead = bones.Head.getWorldPosition(new THREE.Vector3()).y;
  const size = joint.Head.y / manHead;
  // where a bone forks, the joint it is pointed at
  const TOWARD = { pelvis: 'spine_01', spine_03: 'neck_01', hand_l: 'middle_01_l', hand_r: 'middle_01_r' };
  const swing = new THREE.Quaternion(), inv = new THREE.Quaternion();
  const fit = (bone, parentQ, parentP) => {
    const name = bone.name;
    const P = joint[name] ? joint[name].clone() : rest[name].p.clone().multiplyScalar(size).applyQuaternion(parentQ).add(parentP);
    const Q = parentQ.clone().multiply(rest[name].q);
    const kids = bone.children.filter((c) => c.isBone);
    const toward = TOWARD[name] ?? (kids.filter((c) => joint[c.name]).length === 1 ? kids.find((c) => joint[c.name]).name : null);
    if (name !== 'root' && toward && joint[toward]) {
      const mine = rest[toward].p.clone().applyQuaternion(Q).normalize();
      const hers = joint[toward].clone().sub(P).normalize();
      Q.premultiply(swing.setFromUnitVectors(mine, hers));
    }
    inv.copy(parentQ).invert();
    bone.position.copy(P).sub(parentP).applyQuaternion(inv);
    bone.quaternion.copy(inv).multiply(Q);
    for (const k of kids) fit(k, Q, P);
  };
  const top = bones.root;
  fit(top, top.parent.getWorldQuaternion(new THREE.Quaternion()), top.parent.getWorldPosition(new THREE.Vector3()));
  object.updateMatrixWorld(true);
  for (const mesh of herMeshes) {
    const bind = mesh.matrixWorld.clone();
    const list = mesh.skeleton.bones.map((b) => bones[RENAME[b.name] ?? b.name]);
    const skeleton = new THREE.Skeleton(list, list.map((b) => b.matrixWorld.clone().invert()));
    mesh.removeFromParent();
    mesh.position.set(0, 0, 0); mesh.quaternion.identity(); mesh.scale.set(1, 1, 1);
    object.add(mesh);
    mesh.bind(skeleton, bind);
  }
  for (const [name, b] of Object.entries(bones)) b.quaternion.copy(rest[name].q);
  object.updateMatrixWorld(true);
  return { object, hips: bones.pelvis.position.length() / rest.pelvis.p.length() };
}

export async function loadRigs({ base = './figure/', onProgress } = {}) {
  const loader = new GLTFLoader();
  const files = ['starter-man.glb', 'starter-man-clips.glb', 'epic-clips.glb', 'woman.glb'];
  const size = [1.26e6, 2.38e6, 0.87e6, 1.34e6], got = [0, 0, 0, 0];
  const total = size.reduce((a, b) => a + b, 0);
  const tell = (i) => (e) => { got[i] = Math.min(e.loaded, size[i]); onProgress?.(Math.min(1, got.reduce((a, b) => a + b, 0) / total)); };
  const [m, c, e, w, hands] = await Promise.all([
    ...files.map((f, i) => loader.loadAsync(base + f, tell(i))),
    fetch(new URL('../figure/hands-anymove.json', import.meta.url)).then((r) => r.json()),
  ]);
  const animations = [...c.animations, ...e.animations];
  const man = { kind: 'man', object: m.scene, ...partsOf(m.scene), ...sortClips(animations), hands };
  Object.assign(man, measure(man.object, man.meshes, man.bones));
  const rigged = rigWoman(man, w);
  const woman = { kind: 'woman', object: rigged.object, ...partsOf(rigged.object), ...sortClips(animations, rigged.hips), hands };
  Object.assign(woman, measure(woman.object, woman.meshes, woman.bones));
  const templates = { man, woman };

  /** A body of its own to pose: the same shape as what loadMan gives, plus what was measured of it at rest. */
  function spawn(kind = 'man') {
    const t = templates[kind];
    const object = SkeletonUtils.clone(t.object);
    return { kind, object, ...partsOf(object), clips: t.clips, motion: t.motion, raw: t.raw, hands: t.hands, rest: t.rest, head: t.head, height: t.height };
  }
  return { templates, spawn };
}
