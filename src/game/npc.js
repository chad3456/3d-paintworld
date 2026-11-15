// Someone who stands in the picture and is not played: a painted character with one clip going round.
import * as THREE from 'three';
import { buildCharacter } from './character.js';

export function createNpc({ shared, rigs, scene, light }, def, { x, y, z, yaw = 0, clip = 'Idle', detail = 0.7, rate = 1 }) {
  const body = rigs.spawn(def.body);
  const character = buildCharacter(shared, body, def, { light, detail });
  const mixer = new THREE.AnimationMixer(body.object);
  const action = mixer.clipAction(body.clips[clip]);
  action.timeScale = rate;
  action.time = Math.random() * 2;
  action.play();
  body.object.position.set(x, y, z);
  body.object.rotation.set(0, yaw, 0);
  scene.add(body.object, character.group);
  const head = new THREE.Vector3();
  return {
    def, body, character, position: body.object.position,
    turn(to) { body.object.rotation.y = to; },
    update(dt, ctx) {
      mixer.update(dt);
      // the fingers of a hand that holds something stay closed on it
      body.object.updateMatrixWorld(true);
      character.update(dt, ctx);
    },
    top() { return head.setFromMatrixPosition(body.bones.Head.matrixWorld); },
  };
}
