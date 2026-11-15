// What is in the air: petals coming down over a city, or sparks going up from one that burns. Small dabs in a box
// of air that travels with the eye, as the wood's falling leaves do (src/world/leaves.js).
import * as THREE from 'three';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';

/** kind: 'petals' (marigold and rose, falling, lit by the sun) or 'embers' (rising, lit of themselves). */
export function createMotes(shared, kind = 'petals', count = 1800) {
  const embers = kind === 'embers';
  const mesh = dabMesh(dabGeometry(count), dabMaterial(shared, {
    body: /* glsl */ `
      const vec3 BOX = vec3(60.0, 24.0, 60.0);
      void makeDab(inout Dab d) {
        float id = float(gl_InstanceID);
        vec4 r = hash4(id * 1.13 + 3.0);
        vec4 q = hash4(id * 2.71 + 19.0);
        vec3 p = r.xyz * BOX;
        ${embers
          ? 'p.y += uTime * (1.2 + 2.2 * r.w); p.xz += uWind.xy * uTime * (1.0 + 2.0 * q.x) + vec2(sin(uTime * (1.7 + q.y) + q.z * 20.0), cos(uTime * (1.9 + q.w) + q.x * 20.0)) * 0.5;'
          : 'p.y -= uTime * (0.7 + 0.9 * r.w); p.xz += uWind.xy * uTime * (0.4 + 0.9 * q.x) + vec2(sin(uTime * (0.7 + q.y) + q.z * 20.0), cos(uTime * (0.9 + q.w) + q.x * 20.0)) * 0.7;'}
        vec3 origin = vec3(cameraPosition.x, uFocus.y + 9.0, cameraPosition.z);
        p = mod(p - origin + BOX * 0.5, BOX) - BOX * 0.5 + origin;
        float ground = heightAt(p.xz);
        d.alive = smoothstep(ground, ground + 0.5, p.y) * (1.0 - smoothstep(BOX.x * 0.38, BOX.x * 0.5, distance(p.xz, cameraPosition.xz)));
        if (d.alive <= 0.0) return;
        float turnOver = sin(uTime * (2.0 + 3.0 * q.y) + q.w * 30.0);
        ${embers
          ? `float glow = 0.5 + 0.5 * sin(uTime * (3.0 + 5.0 * q.z) + q.x * 40.0);
             vec3 c = mix(vec3(1.0, 0.32, 0.05), vec3(1.0, 0.75, 0.3), q.x) * (0.25 + 0.6 * glow) * smoothstep(1.0, 0.3, (p.y - origin.y + BOX.y * 0.5) / BOX.y);
             d.size = vec2(0.035, 0.16) * (0.6 + 0.8 * r.x);
             d.dir = normalize(vec3(uWind.x * 0.5 + 0.3 * sin(uTime * 2.0 + q.z * 9.0), 1.0, uWind.y * 0.5));
             d.c1 = c; d.c2 = c * 1.2;`
          : `float sun = sunAt(p);
             vec3 c = q.x < 0.55 ? vec3(1.0, 0.62, 0.1) : q.x < 0.8 ? vec3(1.0, 0.84, 0.2) : vec3(0.96, 0.36, 0.4);
             c = mix(c * vec3(0.42, 0.34, 0.4), c, sun * (0.72 + 0.28 * turnOver));
             d.dir = normalize(vec3(sin(uTime * 1.3 + q.z * 9.0), turnOver, cos(uTime * 1.7 + q.x * 9.0)));
             d.size = vec2(0.07, 0.1) * (0.7 + 0.7 * r.x) * (0.55 + 0.45 * abs(turnOver));
             d.c1 = hazed(jitter(c, r.zxy, 0.3), p); d.c2 = d.c1 * 1.12;`}
        d.pos = p;
        d.seed = id;
        d.lift = 0.0;
      }`,
    uniforms: embers ? { uImpasto: { value: 0.3 } } : {},
    minPx: [2.2, 3.2], maxPx: [24, 40], cells: [4, 2],
  }), embers ? 20 : 6);
  if (embers) {
    const m = mesh.material;
    m.transparent = true; m.blending = THREE.AdditiveBlending; m.alphaToCoverage = false; m.depthWrite = false;
  }
  return mesh;
}
