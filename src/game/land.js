// The ground of a realm, made from two plain functions: how high the land is at (x, z), and what lies there (four
// numbers 0..1 the realm's own shaders read: by custom r is a path or paving, g open ground, b a slow patchiness,
// a whatever the realm likes). The same height serves the picture (a map the shaders read), the hero's feet (a
// height field for the physics) and everything planted on it. It is the wood's land (src/world/land.js) made general.
import * as THREE from 'three';
import { COMMON, EXTENT, LAND_RES } from '../oilpaint/common.js';

const N = LAND_RES;

/**
 * height(x, z) -> metres; cover(x, z, h) -> [r, g, b, a]; pause(done 0..1) lets the page breathe while the million
 * points are worked out. under: GLSL for `vec3 underpaint(vec3 P, vec4 m, float lit)`, the broad colour that shows
 * between the dabs laid over the ground (lit is 1 in the sun, 0 in the still world's shade).
 */
export async function makeLand(shared, { height, cover, pause, under, head = '', sink = 0.04, segments = 512, hazy = true }) {
  const heights = new Float32Array(N * N);
  const land = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) {
    if (pause && j % 32 === 0) await pause(j / N);
    for (let i = 0; i < N; i++) {
      const x = -EXTENT + (i / (N - 1)) * 2 * EXTENT, z = -EXTENT + (j / (N - 1)) * 2 * EXTENT;
      const h = height(x, z);
      heights[i + j * N] = h;
      const c = cover(x, z, h), k = (i + j * N) * 4;
      for (let n = 0; n < 4; n++) land[k + n] = Math.round(255 * Math.min(1, Math.max(0, c[n] ?? 0)));
    }
  }
  function heightAt(x, z) {
    const fx = Math.min(N - 1.001, Math.max(0, ((x + EXTENT) / (2 * EXTENT)) * (N - 1)));
    const fz = Math.min(N - 1.001, Math.max(0, ((z + EXTENT) / (2 * EXTENT)) * (N - 1)));
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const a = heights[i + j * N], b = heights[i + 1 + j * N], c = heights[i + (j + 1) * N], d = heights[i + 1 + (j + 1) * N];
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  }
  /** What lies at (x, z), as cover gave it: [r, g, b, a], each 0..1 (nearest point of the map). */
  function coverAt(x, z) {
    const i = Math.round(Math.min(N - 1, Math.max(0, ((x + EXTENT) / (2 * EXTENT)) * (N - 1))));
    const j = Math.round(Math.min(N - 1, Math.max(0, ((z + EXTENT) / (2 * EXTENT)) * (N - 1))));
    const k = (i + j * N) * 4;
    return [land[k] / 255, land[k + 1] / 255, land[k + 2] / 255, land[k + 3] / 255];
  }
  const tHeight = new THREE.DataTexture(heights, N, N, THREE.RedFormat, THREE.FloatType);
  tHeight.minFilter = tHeight.magFilter = THREE.LinearFilter;
  tHeight.needsUpdate = true;
  const tLand = new THREE.DataTexture(land, N, N);
  tLand.minFilter = tLand.magFilter = THREE.LinearFilter;
  tLand.needsUpdate = true;
  shared.tHeight.value = tHeight;
  shared.tLand.value = tLand;

  const geometry = new THREE.PlaneGeometry(2 * EXTENT, 2 * EXTENT, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)) - sink);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared,
    vertexShader: /* glsl */ `
      ${COMMON}
      out vec3 vWorld;
      void main() { vWorld = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      ${head}
      in vec3 vWorld;
      layout(location = 0) out vec4 outC;
      ${under}
      void main() {
        vec4 m = texture(tLand, landUv(vWorld.xz));
        // asked square by ragged square, so that what shows between the dabs is itself in touches
        vec2 sq = floor(vWorld.xz / 0.32 + (texture(tNoise, vWorld.xz / 2.3).rg - 0.5) * 1.8) * 0.32;
        float lit = step(0.5, woodSunAt(vec3(sq.x, vWorld.y + 0.2, sq.y)));
        vec3 c = underpaint(vWorld, m, lit) * (0.8 + 0.28 * texture(tNoise, vWorld.xz / 9.0).r);
        outC = vec4(${hazy ? 'hazed(c, vWorld)' : 'c'}, 1.0);
      }`,
  }));
  mesh.frustumCulled = false;
  // the ground stands in the sun's way too: a plain copy of it for the picture of the shade
  const caster = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  caster.frustumCulled = false;

  /** Heights for the physics: `cells` squares a side over the middle `half` metres, column by column. */
  function heightField(cells = 384, half = 192) {
    const out = new Float32Array((cells + 1) * (cells + 1));
    for (let col = 0; col <= cells; col++) {
      for (let row = 0; row <= cells; row++) out[row + col * (cells + 1)] = heightAt(-half + (col / cells) * 2 * half, -half + (row / cells) * 2 * half);
    }
    return { heights: out, cells, half };
  }
  return { mesh, caster, heightAt, coverAt, heightField };
}
