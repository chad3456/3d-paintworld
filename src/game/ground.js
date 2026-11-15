// A carpet for any ground: dabs that lie flat on the land, each belonging to one small square of it for good (see
// src/oilpaint/ground.js for how they keep still as the eye moves). A realm says only what colour a spot is:
//
//   vec3 groundPaint(vec2 xz, vec3 P, vec3 Nn, vec4 m, float lit, vec4 q, out vec3 c2)
//
// where m is the land's cover there (src/game/land.js), lit how much sun reaches it, q four random numbers that are
// this dab's own, and c2 the colour streaked into the stroke. It is the wood's leaf carpet (src/world/floor.js)
// with the leaves taken out.
import { groundRings } from '../oilpaint/ground.js';

export function makeCarpet(shared, { head = '', paint, per = 3, n = 192, cell0 = 0.14, levels = 6, stroke = [1.05, 1.7], spread = [0.5, 0.9], grain = '' }) {
  const body = /* glsl */ `
    ${paint}
    void makeDab(inout Dab d) {
      vec2 cell; float sub;
      if (!ringCell(0.0, true, cell, sub)) { d.alive = 0.0; return; }
      vec4 r = hash4(cell, sub * 3.0 + 1.0);
      vec4 q = hash4(cell + 31.7, sub + 11.0);
      vec2 xz = (cell + r.xy) * uCell0;
      float lod;
      d.alive = ringGrow(distance(xz, cameraPosition.xz), lod);
      if (d.alive <= 0.0) return;
      vec3 P = vec3(xz.x, heightAt(xz), xz.y);
      vec3 Nn = normalAt(xz);
      vec4 m = texture(tLand, landUv(xz));
      float lit = woodSunAt(P + vec3(0.0, 0.2, 0.0)) * clamp(dot(Nn, uSunDir) * 2.4, 0.0, 1.0);
      vec3 c2;
      vec3 c1 = groundPaint(xz, P, Nn, m, lit, q, c2);
      c1 = jitter(c1, r.wzy, 0.45);
      c2 = jitter(c2, q.wzy, 0.45);
      float a = (texture(tNoise, xz / 6.3).a * 1.2 + q.y * 0.8) * TAU;
      d.dir = vec3(cos(a), 0.0, sin(a));
      ${grain}
      d.pos = P;
      d.size = uCell0 * vec2(${stroke[0].toFixed(2)} + ${spread[0].toFixed(2)} * r.z, ${stroke[1].toFixed(2)} + ${spread[1].toFixed(2)} * r.w) * lod;
      d.c1 = hazed(c1, P);
      d.c2 = hazed(c2, P);
      d.seed = dot(cell, vec2(1.0, 57.0)) + sub * 0.37;
      d.turnabout = 1.0;
      d.lie = 1.0;
      d.nrm = Nn;
      d.height = (0.03 + 0.07 * q.z) * pow(lod, 0.35);
      d.glaze = 1.0;
    }`;
  return groundRings(shared, { head, body, per, n, cell0, levels, minPx: [5, 9], maxPx: [4000, 4000], cells: [0, 8] });
}

/**
 * Things that stand up out of the ground in clumps: grass, reeds, flowers. A realm gives
 *   bool tuftAt(vec2 foot, vec4 m, vec4 q, out vec3 light, out vec3 half_, out vec3 shade, out float tall, out float wide)
 * which says whether a clump grows at `foot` and in what paint. Each blade is one flick of the brush from its foot.
 */
export function makeTufts(shared, { head = '', tuft, per = 5, n = 96, cell0 = 0.45, levels = 4 }) {
  const body = /* glsl */ `
    ${tuft}
    void makeDab(inout Dab d) {
      vec2 cell; float sub;
      if (!ringCell(40.0, false, cell, sub)) { d.alive = 0.0; return; }
      vec4 r = hash4(cell, 40.0);
      vec4 q = hash4(cell + 17.3, 51.0);
      vec4 f = hash4(cell + sub * 7.7 + 3.1, sub * 13.0 + 3.0);
      vec2 foot = (cell + r.xy) * uCell0;
      float lod;
      d.alive = ringGrow(distance(foot, cameraPosition.xz), lod);
      if (d.alive <= 0.0) return;
      vec4 m = texture(tLand, landUv(foot));
      vec3 L, M, S; float tall, wide;
      if (!tuftAt(foot, m, q, L, M, S, tall, wide)) { d.alive = 0.0; return; }
      float big = min(pow(lod, 0.6), 2.2);
      float a = (sub + f.x) / ${per}.0 * TAU + r.z * TAU;
      vec2 fan = vec2(cos(a), sin(a));
      vec2 xz = foot + fan * 0.06 * big;
      vec3 P = vec3(xz.x, heightAt(xz), xz.y);
      float gust = gustAt(xz);
      float lit = sunAt(P + vec3(0.0, 0.3, 0.0));
      vec3 c = jitter(paint3(L, M, S, lit, f.w), f.zwx, 0.5);
      float sway = sin(uTime * (1.6 + f.z) + f.w * 40.0) * (0.04 + 0.1 * gust);
      vec2 lean = fan * (0.2 + 0.5 * f.y) + uWind.xy * (0.08 + 0.6 * gust + sway);
      d.dir = normalize(vec3(lean.x, 1.0, lean.y));
      d.pos = P - vec3(0.0, 0.02, 0.0);
      d.size = vec2(wide * big * (0.8 + 0.5 * f.x), tall * (0.7 + 0.6 * f.z));
      d.cell = floor(f.y * 2.99);
      d.c1 = hazed(c, P);
      d.c2 = hazed(jitter(c * 1.2, f.xzy, 0.7), P);
      d.seed = dot(cell, vec2(1.0, 57.0)) + sub * 0.37 + 0.5;
      d.base = 1.0;
      d.lift = 0.25;
    }`;
  return groundRings(shared, { head, body, per, n, cell0, levels, minPx: [2.5, 12], maxPx: [60, 420], cells: [0, 4] });
}
