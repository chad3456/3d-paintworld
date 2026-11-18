// The five pictures of the page. Each is a world of its own with a camera, and `update(time, progress, pointer)`
// moves it: `progress` runs 0..1 while its part of the page scrolls past, `pointer` is where the mouse is (-1..1).
import * as THREE from 'three';
import * as P from './paint.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------------------------------------------
// a sky of the hour: a wash from deep blue overhead to pale near the horizon, clouds, and the wind's streaks
// ---------------------------------------------------------------------------------------------------------------
export function skyDome(top, horizon, { sun = null } = {}) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color(...top) }, uHorizon: { value: new THREE.Color(...horizon) }, uSun: { value: sun ?? V(0, -1, 0) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSun; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y * 1.3 + 0.08, 0.0, 1.0);
        vec3 c = mix(uHorizon, uTop, pow(h, 0.65));
        c += vec3(1.0, 0.9, 0.7) * pow(max(dot(vDir, normalize(uSun)), 0.0), 18.0) * 0.4;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), m);
  dome.renderOrder = -10;
  return dome;
}

export function clouds(scene, { count = 14, seed = 2, ring = 160, low = -10, high = 60, scale = 1 } = {}) {
  const r = P.rng(seed);
  const textures = [0, 1, 2, 3].map((i) => P.texture(P.cloud({ seed: seed * 10 + i })));
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: textures[i % 4], transparent: true, depthWrite: false, fog: false }));
    const a = r() * Math.PI * 2, d = ring * (0.7 + 0.5 * r());
    const s = (60 + 90 * r()) * scale;
    m.scale.set(s, s, 1);
    m.position.set(Math.cos(a) * d, low + (high - low) * Math.pow(r(), 1.6), Math.sin(a) * d);
    m.lookAt(0, m.position.y, 0);
    m.userData.drift = 0.6 + r();
    group.add(m);
  }
  scene.add(group);
  return group;
}

export function windStreaks(scene, { at = V(0, 30, -120), size = 260, seed = 3 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size / 2), new THREE.MeshBasicMaterial({ map: P.texture(P.streaks({ seed })), transparent: true, depthWrite: false, opacity: 0.8 }));
  m.position.copy(at);
  scene.add(m);
  return m;
}

/** Leaves blown through the air in front of the camera: an instanced swarm that wraps round a box. */
export function swarm(scene, { count = 220, textures, box = V(40, 24, 30), centre = V(0, 4, -6), size = [0.25, 0.6], wind = V(-3, -1.2, 0.4), seed = 7 }) {
  const r = P.rng(seed);
  const groups = textures.map((t) => {
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1.5), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide }), Math.ceil(count / textures.length));
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  });
  const items = Array.from({ length: count }, (_, i) => ({ mesh: groups[i % groups.length], index: Math.floor(i / groups.length), p: V((r() - 0.5) * box.x, (r() - 0.5) * box.y, (r() - 0.5) * box.z), s: size[0] + (size[1] - size[0]) * r(), spin: V(r() * 3, r() * 3, r() * 3), phase: r() * 10, speed: 0.6 + 0.8 * r() }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = V(1, 1, 1), at = V(0, 0, 0);
  return {
    groups,
    update(time, gust = 1) {
      for (const it of items) {
        const t = time * it.speed + it.phase;
        at.set(it.p.x + wind.x * time * it.speed * gust + Math.sin(t * 1.3) * 0.8, it.p.y + wind.y * time * it.speed + Math.sin(t * 0.9) * 0.6, it.p.z + wind.z * time + Math.cos(t * 1.1) * 0.5);
        at.x = ((((at.x + box.x / 2) % box.x) + box.x) % box.x) - box.x / 2 + centre.x;
        at.y = ((((at.y + box.y / 2) % box.y) + box.y) % box.y) - box.y / 2 + centre.y;
        at.z = ((((at.z + box.z / 2) % box.z) + box.z) % box.z) - box.z / 2 + centre.z;
        q.setFromEuler(e.set(it.spin.x * t, it.spin.y * t, it.spin.z * t));
        sc.setScalar(it.s);
        it.mesh.setMatrixAt(it.index, m4.compose(at, q, sc));
      }
      for (const g of groups) g.instanceMatrix.needsUpdate = true;
    },
  };
}

export const ASHOKA = [
  [[255, 196, 72], [242, 116, 32], [168, 44, 22]],
  [[255, 150, 60], [226, 64, 30], [140, 24, 24]],
  [[250, 92, 52], [200, 34, 34], [110, 14, 26]],
  [[255, 220, 110], [240, 150, 40], [176, 74, 20]],
];

// ---------------------------------------------------------------------------------------------------------------
// I. The ashoka tree on its hill, in full flower
// ---------------------------------------------------------------------------------------------------------------
export function treeScene({ palette = ASHOKA, sky = [[0.08, 0.34, 0.86], [0.62, 0.84, 1.0]], ground: groundBase = [214, 110, 40], bark: barkColor = 0x6e4a36, light: [skyLight, groundLight] = [0xe4f0ff, 0xd08040], blade = ['#e9a046', '#c76a26', '#f5c46a', '#9c4a1e'], grassTint = 0xffe0b0 } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
  scene.add(skyDome(sky[0], sky[1], { sun: V(0.6, 0.5, -0.6) }));
  const cloudGroup = clouds(scene, { seed: 4, low: -14, high: 50 });
  windStreaks(scene, { at: V(40, 40, -150), size: 300 });
  scene.add(new THREE.HemisphereLight(skyLight, groundLight, 2.4));
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
  sun.position.set(8, 12, 6);
  scene.add(sun);

  // the hill: a broad slope rising to the left, carpeted with fallen blossom
  const hillGeo = new THREE.PlaneGeometry(90, 60, 120, 80);
  hillGeo.rotateX(-Math.PI / 2);
  const hp = hillGeo.attributes.position;
  const hillY = (x, z) => -0.11 * x - 0.018 * z * z * 0.08 + 0.6 * Math.sin(x * 0.18) * Math.cos(z * 0.21) - 2.2;
  for (let i = 0; i < hp.count; i++) hp.setY(i, hillY(hp.getX(i), hp.getZ(i)));
  hillGeo.computeVertexNormals();
  const ground = P.texture(P.litter({ seed: 11, base: groundBase, palette }), { repeat: true });
  ground.repeat.set(9, 6);
  const hill = new THREE.Mesh(hillGeo, new THREE.MeshLambertMaterial({ map: ground }));
  hill.position.z = -6;
  scene.add(hill);
  const groundAt = (x, z) => hillY(x, z + 6);

  // stones half sunk in the leaves
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0xf0dcbc });
  const r = P.rng(31);
  for (const [x, z, s] of [[-6.5, -2, 0.9], [-1.5, 0.5, 0.6], [2.5, 2.2, 0.7], [-3, 3.5, 0.8], [4.6, -1, 0.5], [1, -4, 0.55]]) {
    const g = new THREE.IcosahedronGeometry(1, 4);
    const p = g.attributes.position;
    const [sx, sy, sz] = [1.3 + 0.3 * r(), 0.45 + 0.1 * r(), 1 + 0.3 * r()], seed = r() * 10;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.08 * Math.sin(x * 3 + seed) * Math.cos(z * 2.6 + seed) + 0.05 * Math.sin(y * 4 + seed); p.setXYZ(i, x * sx * k, y * sy * k, z * sz * k); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, stoneMat);
    m.scale.setScalar(s);
    m.position.set(x, groundAt(x, z) + 0.05, z);
    m.rotation.y = r() * 3;
    scene.add(m);
  }

  // grass blades along the brow of the hill
  const bladeCanvas = document.createElement('canvas');
  bladeCanvas.width = 64; bladeCanvas.height = 256;
  {
    const g = bladeCanvas.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 8 + Math.random() * 48;
      g.strokeStyle = blade[i % 4];
      g.lineWidth = 3 + Math.random() * 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(32, 256); g.quadraticCurveTo(x, 140, x + (Math.random() - 0.5) * 30, 20 + Math.random() * 80); g.stroke();
    }
  }
  const grass = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.6, 1.4), new THREE.MeshBasicMaterial({ map: P.texture(bladeCanvas), alphaTest: 0.5, side: THREE.DoubleSide, color: grassTint }), 900);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < 900; i++) {
      const x = -18 + r() * 36, z = -2 + r() * 8;
      q.setFromAxisAngle(V(0, 1, 0), r() * 3);
      const s = 0.35 + 0.45 * r();
      grass.setMatrixAt(i, m4.compose(V(x, groundAt(x, z) + 0.55 * s, z), q, V(s, s, s)));
    }
  }
  scene.add(grass);

  // the tree: a few limbs, and the crown as thousands of flower clusters and leaves gathered into lobes
  const TREE = V(-7.5, 0, -5);
  TREE.y = groundAt(TREE.x, TREE.z);
  const bark = new THREE.MeshLambertMaterial({ color: barkColor });
  const limb = (pts, rad) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => p.clone().add(TREE)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, rad, 8), bark);
    const pos = m.geometry.attributes.position;
    const n = pos.count;
    // taper toward the tips
    for (let i = 0; i < n; i++) {
      const t = Math.floor(i / 9) / 20;
      const c = curve.getPoint(Math.min(1, t));
      const k = 1 - 0.75 * t;
      pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k, c.y + (pos.getY(i) - c.y) * k, c.z + (pos.getZ(i) - c.z) * k);
    }
    m.geometry.computeVertexNormals();
    scene.add(m);
  };
  limb([V(0, -0.5, 0), V(0.2, 2, 0), V(0.1, 3.6, 0.2), V(-0.6, 5, 0)], 0.62);
  limb([V(0.1, 3.0, 0), V(1.6, 4.4, 0.3), V(3.4, 5.4, 0.6)], 0.32);
  limb([V(0.0, 3.4, 0), V(-1.6, 4.6, -0.2), V(-3.2, 5.6, 0.2)], 0.3);
  limb([V(0.0, 3.8, 0), V(0.6, 5.4, -0.8), V(1.2, 6.6, -0.6)], 0.26);
  limb([V(0, 0.4, 0), V(-0.9, 0.1, 0.5), V(-1.6, -0.3, 0.8)], 0.22);
  const lobes = [[0, 6.6, 0, 3.4], [3.2, 5.8, 0.4, 2.8], [-3.2, 5.9, 0, 2.8], [1.2, 7.8, -0.6, 2.6], [-1.6, 7.6, 0.5, 2.5], [4.8, 4.9, 0.6, 2.0], [-4.6, 5.1, 0.2, 2.1], [0.4, 5, 1.6, 2.4], [2.4, 4.6, -1.4, 2.2], [-2.2, 4.8, -1.2, 2.2], [6.2, 5.6, 0.2, 1.6], [3.0, 7.4, 0.8, 2.0]];
  const leafTex = palette.map((cols, i) => P.texture(P.leaf({ w: 128, h: 192, shape: i === 1 ? 'maple' : 'ashoka', colors: cols, seed: 70 + i, veins: false })));
  const crowns = leafTex.map((t) => new THREE.InstancedMesh(new THREE.PlaneGeometry(0.62, 0.92), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide }), 1500));
  const counts = crowns.map(() => 0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  const light = V(0.6, 0.7, 0.4).normalize();
  for (const [lx, ly, lz, lr] of lobes) {
    const n = Math.round(lr * lr * 120);
    for (let i = 0; i < n; i++) {
      const d = V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
      const reach = lr * Math.cbrt(0.35 + 0.65 * r());
      const p = V(lx, ly, lz).addScaledVector(d, reach);
      if (p.y < 3.5) continue;
      const k = Math.floor(r() * crowns.length);
      if (counts[k] >= 1500) continue;
      q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6));
      crowns[k].setMatrixAt(counts[k], m4.compose(p.clone().add(TREE), q, V(1, 1, 1).multiplyScalar(0.8 + 0.6 * r())));
      // lit on the side that faces the sun and toward the outside of the crown; deep inside, dark crimson
      const lit = 0.72 + 0.5 * Math.max(0, d.dot(light)) * (reach / lr) + 0.12 * (p.y - 4) / 4;
      crowns[k].setColorAt(counts[k], col.setRGB(lit * 1.18, lit * (0.92 + 0.25 * lit), lit * (0.88 + 0.2 * lit)));
      counts[k]++;
    }
  }
  crowns.forEach((c, k) => { c.count = counts[k]; c.instanceColor.needsUpdate = true; scene.add(c); });

  const petals = swarm(scene, { textures: leafTex, count: 180, centre: V(2, 4, -4), box: V(46, 22, 18), size: [0.22, 0.5], wind: V(2.6, -1.0, 0.3) });
  return {
    scene, camera,
    update(time, progress, pointer) {
      camera.position.set(1.8 + pointer.x * 0.35 - progress * 1.5, 1.3 + pointer.y * 0.2 + progress * 1.6, 12.5 - progress * 2.5);
      camera.lookAt(-0.5 - progress * 0.6, 4.2 + progress * 1.6, -5);
      cloudGroup.children.forEach((c) => { c.position.x += c.userData.drift * 0.01; if (c.position.x > 220) c.position.x = -220; });
      for (const c of crowns) c.rotation.z = Math.sin(time * 0.7) * 0.002;
      petals.update(time, 1 + progress);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// II. A peepal leaf high in the wind, with Rama's vow written on it
// ---------------------------------------------------------------------------------------------------------------
export function leafScene({ words }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  scene.add(skyDome([0.04, 0.3, 0.86], [0.55, 0.82, 1.0]));
  const cloudGroup = clouds(scene, { seed: 9, count: 20, ring: 120, low: -60, high: 30, scale: 1.2 });
  windStreaks(scene, { at: V(-20, 10, -120), size: 320, seed: 8 });
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.2);
  sun.position.set(4, 6, 8);
  scene.add(sun);

  const tex = P.texture(P.leaf({
    w: 1024, h: 1400, shape: 'peepal', seed: 21, colors: [[255, 168, 56], [236, 74, 30], [150, 22, 20]],
    text(g, w, h) {
      // the words painted on the leaf, a little rough at the edge, like paint that has dried
      g.save();
      g.translate(w * 0.5, h * 0.55);
      g.rotate(-0.12);
      g.textAlign = 'center';
      g.fillStyle = '#fff6e8';
      g.shadowColor = 'rgba(80,10,0,0.35)'; g.shadowBlur = 10; g.shadowOffsetY = 6;
      const size = w * 0.11;
      g.font = `${size}px "Young Serif", Georgia, serif`;
      words.forEach((line, i) => g.fillText(line, 0, (i - (words.length - 1) / 2) * size * 1.08));
      g.restore();
    },
  }));
  const geo = new THREE.PlaneGeometry(6, 8.2, 40, 50);
  const base = geo.attributes.position.array.slice();
  const big = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
  scene.add(big);

  const small = [[[255, 170, 60], [230, 70, 30], [150, 22, 22]], [[255, 120, 70], [210, 30, 40], [120, 10, 26]], [[255, 210, 90], [245, 140, 40], [170, 70, 20]]];
  const swarmTex = small.map((c, i) => P.texture(P.leaf({ w: 128, h: 192, shape: i === 2 ? 'peepal' : 'ashoka', colors: c, seed: 90 + i })));
  const flock = swarm(scene, { textures: swarmTex, count: 160, centre: V(0, 0, -6), box: V(40, 26, 24), size: [0.3, 0.8], wind: V(-2.2, 1.4, 0.6), seed: 13 });
  return {
    scene, camera,
    update(time, progress, pointer) {
      camera.position.set(pointer.x * 0.4, pointer.y * 0.3, 11);
      camera.lookAt(0, 0, 0);
      // the leaf turns over as it falls: the page's scroll is its fall
      const t = progress;
      big.position.set(-1.6 + Math.sin(t * 3.0) * 1.4, 2.5 - t * 4.5 + Math.sin(time * 0.8) * 0.15, 0);
      big.rotation.set(-0.35 + Math.sin(t * 4.2 + time * 0.3) * 0.25, Math.sin(t * 2.6) * 0.55, -0.55 + t * 0.9 + Math.sin(time * 0.6) * 0.05);
      // and it flexes in the wind, a ripple running from stem to tip
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        p.setZ(i, 0.28 * Math.sin(y * 0.7 + time * 2.3) + 0.12 * x * x + 0.08 * Math.sin(x * 1.3 + time * 1.7));
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
      cloudGroup.rotation.y = time * 0.004 + progress * 0.4;
      cloudGroup.position.y = progress * 20;
      flock.update(time, 1.5);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// III. The lotus pond at Pampa: water that answers the hand, words under the surface, koi and flowers above
// ---------------------------------------------------------------------------------------------------------------
export function pondScene(renderer, { words, fallen = [[[250, 70, 60], [206, 20, 30], [120, 6, 20]], [[255, 160, 150], [230, 90, 100], [150, 40, 60]]] }) {
  const SIM = 256;
  const make = () => new THREE.WebGLRenderTarget(SIM, SIM, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  let a = make(), b = make();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const simScene = new THREE.Scene();
  simScene.add(quad);
  const simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // a wave equation: each point remembers where it was and is pulled toward its neighbours
  const sim = new THREE.ShaderMaterial({
    uniforms: { tPrev: { value: null }, uDrop: { value: new THREE.Vector4(0, 0, 0, 0) }, uRain: { value: new THREE.Vector4(0, 0, 0, 0) }, uTexel: { value: 1 / SIM } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tPrev; uniform vec4 uDrop; uniform vec4 uRain; uniform float uTexel; varying vec2 vUv;
      void main(){
        vec4 s = texture2D(tPrev, vUv);
        float h = s.r, hPrev = s.g;
        float n = texture2D(tPrev, vUv + vec2(uTexel, 0.0)).r + texture2D(tPrev, vUv - vec2(uTexel, 0.0)).r + texture2D(tPrev, vUv + vec2(0.0, uTexel)).r + texture2D(tPrev, vUv - vec2(0.0, uTexel)).r;
        float next = (n * 0.5 - hPrev) * 0.985;
        float d = distance(vUv, uDrop.xy);
        next += uDrop.w * (1.0 - smoothstep(0.0, uDrop.z, d));
        next += uRain.w * (1.0 - smoothstep(0.0, uRain.z, distance(vUv, uRain.xy)));
        gl_FragColor = vec4(next, h, 0.0, 1.0);
      }`,
  });
  quad.material = sim;

  const wordCanvas = document.createElement('canvas');
  wordCanvas.width = 2048; wordCanvas.height = 1024;
  {
    const g = wordCanvas.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 2048, 1024);
    g.textAlign = 'left'; g.fillStyle = '#fff';
    g.font = '170px "Young Serif", Georgia, serif';
    words.forEach((line, i) => g.fillText(line, 190, 450 + i * 178));
  }
  const wordTex = P.texture(wordCanvas, { srgb: false });

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { tHeight: { value: null }, tWords: { value: wordTex }, uTime: { value: 0 }, uAspect: { value: 1 }, uTexel: { value: 1 / SIM }, uWords: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tHeight; uniform sampler2D tWords; uniform float uTime; uniform float uAspect; uniform float uTexel; uniform float uWords;
      varying vec2 vUv;
      vec2 hash2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
      // light gathered on the pond's floor: the edges of a slowly moving net of cells
      float caustic(vec2 p){
        vec2 i = floor(p), f = fract(p);
        float d1 = 9.0, d2 = 9.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
          vec2 g = vec2(float(x), float(y));
          vec2 o = hash2(i + g);
          o = 0.5 + 0.45 * sin(uTime * 0.5 + 6.2831 * o);
          float d = length(g + o - f);
          if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        return 1.0 - smoothstep(0.0, 0.11, d2 - d1);
      }
      void main(){
        vec2 uv = vUv;
        float h = texture2D(tHeight, uv).r;
        vec2 slope = vec2(texture2D(tHeight, uv + vec2(uTexel, 0.0)).r - texture2D(tHeight, uv - vec2(uTexel, 0.0)).r, texture2D(tHeight, uv + vec2(0.0, uTexel)).r - texture2D(tHeight, uv - vec2(0.0, uTexel)).r);
        vec2 bent = uv + slope * 0.6;
        vec2 p = vec2(bent.x * uAspect, bent.y) * 7.0;
        p += 0.25 * vec2(sin(p.y * 1.3 + uTime * 0.4), cos(p.x * 1.1 + uTime * 0.3));
        float patchy = smoothstep(0.25, 0.75, sin(p.x * 0.31 + uTime * 0.05) * 0.5 + sin(p.y * 0.27 - 1.3) * 0.5 + 0.5);
        float net = (caustic(p) * 0.7 + caustic(p * 1.9 + 3.1) * 0.3) * (0.25 + 0.75 * patchy);
        vec3 deep = vec3(0.03, 0.22, 0.17), mid = vec3(0.06, 0.38, 0.26);
        float floorShade = smoothstep(0.2, 0.9, hash2(floor(p * 0.6)).x);
        vec3 c = mix(deep, mid, floorShade * 0.6);
        c += vec3(0.5, 0.95, 0.3) * net * 0.5;
        // the words lie under the water: bent by it, tinted by it, the light running over them
        // the words keep their own proportions whatever the screen's: as wide as fits, up to twice the height
        float tw = min(uAspect * 0.96, 2.0);
        vec2 wuv = vec2(((bent.x + slope.x * 1.2) * uAspect - (uAspect - tw) * 0.5) / tw, ((bent.y + slope.y * 1.2) - (1.0 - tw * 0.5) * 0.5) / (tw * 0.5));
        float inside = step(0.0, wuv.x) * step(wuv.x, 1.0) * step(0.0, wuv.y) * step(wuv.y, 1.0);
        float w = texture2D(tWords, wuv).r * uWords * inside;
        c = mix(c, vec3(0.25, 0.86, 0.58) + net * 0.2, w * 0.85);
        // the light on the surface where it is sloped
        c += vec3(0.8, 1.0, 0.85) * clamp(dot(slope, vec2(-0.7, 0.7)) * 9.0, 0.0, 0.5);
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  water.renderOrder = -5;
  scene.add(water);

  // what floats: lotus pads and flowers, fallen leaves and white jasmine; and the koi beneath
  const floaters = [];
  const r = P.rng(55);
  const padTex = [0, 1].map((i) => P.texture(P.pad({ seed: 3 + i })));
  const lotusTex = P.texture(P.lotus({}));
  const jasmine = P.texture(P.flower({}));
  const redLeaf = fallen.map((colors, k) => P.texture(P.leaf({ w: 256, h: 384, colors, seed: 5 + k })));
  const add = (texture, size, x, y, z, spin = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * (texture.image.height / texture.image.width)), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    m.position.set(x, y, z);
    m.rotation.z = r() * 6.28;
    m.userData = { x, y, spin, phase: r() * 6 };
    scene.add(m);
    floaters.push(m);
    return m;
  };
  // pads keep to the right and the edges, so the words under the water stay clear
  for (const [x, y, s] of [[1.15, 0.55, 0.42], [1.35, -0.35, 0.36], [0.95, -0.75, 0.3], [1.5, 0.05, 0.26], [-1.45, -0.8, 0.34], [-1.25, 0.82, 0.28], [0.7, 0.85, 0.24]]) add(padTex[Math.round(x * 3) % 2 ? 0 : 1], s, x / 1.78, y, 1);
  for (const [x, y] of [[1.05, 0.42], [1.42, -0.48], [-1.3, 0.72], [0.62, -0.62]]) add(lotusTex, 0.15 + 0.06 * r(), x / 1.78, y, 2);
  for (let i = 0; i < 9; i++) add(jasmine, 0.06 + 0.03 * r(), -1.4 + 2.8 * r(), -0.9 + 1.8 * r(), 3, 0.2);
  for (let i = 0; i < 8; i++) add(redLeaf[i % 2], 0.16 + 0.14 * r(), -1.4 + 2.8 * r(), -0.9 + 1.8 * r(), 2.5, 0.1);
  const fish = [[[250, 245, 235], [235, 90, 40]], [[255, 140, 60], [250, 250, 245]], [[245, 245, 245], [30, 30, 30]], [[250, 236, 220], [220, 60, 30]]].map(([body, patch], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.175), new THREE.MeshBasicMaterial({ map: P.texture(P.koi({ body, patch, seed: 40 + i })), transparent: true, opacity: 0.85, depthWrite: false }));
    m.position.z = 0.5;
    m.userData = { r: 0.35 + 0.35 * r(), speed: (0.08 + 0.08 * r()) * (i % 2 ? 1 : -1), phase: r() * 6, cx: (r() - 0.5) * 0.8, cy: (r() - 0.5) * 0.6 };
    scene.add(m);
    return m;
  });

  let last = -1, aspect = 1, rainIn = 0;
  const uvOf = (pt) => [(pt.x + 1) / 2, (pt.y + 1) / 2];
  return {
    scene, camera, overlayWater: water,
    resize(w, h) { aspect = w / h; camera.left = -aspect; camera.right = aspect; camera.updateProjectionMatrix(); water.material.uniforms.uAspect.value = aspect; },
    update(time, progress, pointer, dt) {
      const steps = 2;
      for (let s = 0; s < steps; s++) {
        sim.uniforms.tPrev.value = a.texture;
        const [ux, uy] = uvOf(pointer);
        const moved = pointer.moved ? 1 : 0;
        sim.uniforms.uDrop.value.set(ux, uy, 0.022, s === 0 ? 0.012 * moved : 0);
        rainIn -= dt / steps;
        if (rainIn <= 0) { rainIn = 0.35 + Math.random() * 0.8; sim.uniforms.uRain.value.set(Math.random(), Math.random(), 0.012, 0.03); } else sim.uniforms.uRain.value.w = 0;
        renderer.setRenderTarget(b);
        renderer.render(simScene, simCam);
        [a, b] = [b, a];
      }
      renderer.setRenderTarget(null);
      pointer.moved = false;
      water.material.uniforms.tHeight.value = a.texture;
      water.material.uniforms.uTime.value = time;
      water.material.uniforms.uWords.value = smooth(0.08, 0.3, progress) * (1 - smooth(0.85, 1, progress));
      for (const f of floaters) {
        const u = f.userData;
        f.position.x = (u.x * aspect) + Math.sin(time * 0.2 + u.phase) * 0.02 + progress * 0.15 * (f.position.z - 1.5);
        f.position.y = u.y + Math.cos(time * 0.17 + u.phase) * 0.02;
        f.rotation.z += u.spin * dt;
      }
      for (const k of fish) {
        const u = k.userData, t = time * u.speed + u.phase;
        const x = u.cx * aspect + Math.cos(t) * u.r * aspect * 0.8, y = u.cy + Math.sin(t * 1.3) * u.r * 0.7;
        const dx = x - k.position.x, dy = y - k.position.y;
        if (dx * dx + dy * dy > 1e-8) k.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
        k.position.x = x; k.position.y = y;
        k.scale.x = 1 + 0.06 * Math.sin(time * 8 + u.phase);
      }
      void last;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// IV. Hanuman's message, a written leaf lying on the floor of the Ashoka grove beside a stream
// ---------------------------------------------------------------------------------------------------------------
export function letterScene({ title, date, paragraphs, palette = [...ASHOKA, [[255, 230, 120], [240, 190, 50], [170, 110, 20]]], base = [130, 46, 22], water = null }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a1a10);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a3018, 1.7));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
  sun.position.set(-4, 10, 5);
  scene.add(sun);

  // the floor: red and gold ashoka litter, a stream of green water down the left, its sandy bank
  const floorTex = P.texture(P.litter({ seed: 17, base, palette }), { repeat: true });
  floorTex.repeat.set(4, 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShaderMaterial({
    uniforms: { tLeaves: { value: floorTex }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tLeaves; uniform float uTime; varying vec2 vUv; varying vec3 vP;
      float n(vec2 p){ return sin(p.x * 1.3 + sin(p.y * 0.7)) * 0.5 + sin(p.y * 0.9 + p.x * 0.4) * 0.5; }
      void main(){
        vec3 leaves = texture2D(tLeaves, vUv * 4.0).rgb;
        // the stream's edge wanders down the picture
        float edge = vP.x + 3.4 + 0.6 * n(vP.xy * 0.6) + 0.25 * sin(vP.y * 2.1);
        float bank = smoothstep(-0.2, 0.15, edge) - smoothstep(0.7, 1.1, edge);
        vec3 sand = vec3(0.86, 0.82, 0.55);
        float pools = smoothstep(0.1, 0.3, n(vP.xy * 1.7 + vec2(0.0, uTime * 0.05)) + n(vP.yx * 2.3) * 0.5);
        vec3 water = mix(vec3(0.1, 0.42, 0.22), vec3(0.62, 0.84, 0.48), pools * 0.6);
        vec3 c = edge < 0.0 ? water : mix(leaves, sand, bank * 0.9);
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // the written leaf itself, curling a little at its corners
  const page = P.texture(P.paper({
    seed: 5,
    draw(g, w, h) {
      g.fillStyle = '#2a1a10';
      g.font = `600 ${w * 0.072}px "Literata", Georgia, serif`;
      g.fillText(title, w * 0.1, h * 0.12);
      g.font = `italic ${w * 0.034}px "Literata", Georgia, serif`;
      g.fillStyle = '#5a3a22';
      g.fillText(date, w * 0.1, h * 0.165);
      g.fillStyle = '#2e1e14';
      g.font = `${w * 0.039}px "Literata", Georgia, serif`;
      let y = h * 0.25;
      for (const para of paragraphs) {
        const words = para.split(' ');
        let line = '';
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (g.measureText(test).width > w * 0.78) { g.fillText(line, w * 0.1, y); y += w * 0.055; line = word; } else line = test;
        }
        g.fillText(line, w * 0.1, y);
        y += w * 0.09;
      }
      // a pressed ashoka leaf sketched in the margin
      g.strokeStyle = 'rgba(120,80,40,0.45)'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(w * 0.78, h * 0.86, w * 0.06, w * 0.14, 0.5, 0, 6.28); g.stroke();
      g.beginPath(); g.moveTo(w * 0.72, h * 0.96); g.lineTo(w * 0.84, h * 0.76); g.stroke();
    },
  }));
  const pg = new THREE.PlaneGeometry(4.2, 5.74, 40, 50);
  const pp = pg.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), y = pp.getY(i);
    pp.setZ(i, 0.08 * Math.pow(Math.abs(x) / 2.1, 3) * 3 + 0.05 * Math.sin(y * 1.4 + x) + (y > 2.4 ? 0.3 * Math.pow((y - 2.4) / 0.47, 2) : 0) + (x > 1.8 && y < -2.2 ? 0.25 : 0) * Math.pow(Math.min(1, (x - 1.8) / 0.3 * ((-2.2 - y) / 0.67)), 2));
  }
  pg.computeVertexNormals();
  const paperMesh = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ map: page, alphaTest: 0.5, side: THREE.DoubleSide }));
  paperMesh.rotation.x = -Math.PI / 2;
  paperMesh.rotation.z = 0.12;
  paperMesh.position.set(0.4, 0.06, 0);
  scene.add(paperMesh);

  const r = P.rng(77);
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0xd8dce2 });
  for (const [x, z, s] of [[-1.8, -3.1, 0.55], [2.8, -2.2, 0.6], [3.3, 1.7, 0.7], [-2.6, -1.6, 0.36], [1.6, 3.6, 0.6], [-3.3, -3.8, 0.25], [4.6, -0.2, 0.4]]) {
    const g = new THREE.IcosahedronGeometry(1, 4);
    const p = g.attributes.position;
    const [sx, sy, sz] = [1.2 + 0.3 * r(), 0.62 + 0.15 * r(), 1 + 0.25 * r()], seed = r() * 10;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.08 * Math.sin(x * 3 + seed) * Math.cos(z * 2.6 + seed) + 0.05 * Math.sin(y * 4 + seed); p.setXYZ(i, x * sx * k, y * sy * k, z * sz * k); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, stoneMat);
    m.scale.setScalar(s); m.position.set(x, s * 0.3, z); m.rotation.y = r() * 3;
    scene.add(m);
  }
  const loose = palette.map((c, i) => P.texture(P.leaf({ w: 128, h: 192, shape: i % 2 ? 'maple' : 'ashoka', colors: c, seed: 120 + i })));
  const jasmine = P.texture(P.flower({}));
  for (let i = 0; i < 46; i++) {
    const t = i < 8 ? jasmine : loose[i % loose.length];
    const s = i < 8 ? 0.4 : 0.45 + 0.4 * r();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * (i < 8 ? 1 : 1.5)), new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide }));
    m.rotation.set(-Math.PI / 2 + (r() - 0.5) * 0.5, 0, r() * 6);
    const x = -5 + 10 * r(), z = -4.5 + 9 * r();
    // nothing lies on the written page itself
    if (Math.abs(x - 0.4) < 2.4 && Math.abs(z) < 3.1) continue;
    m.position.set(x, 0.12 + 0.1 * r() + (Math.abs(x - 0.4) < 2.1 && Math.abs(z) < 2.9 ? 0.15 : 0), z);
    scene.add(m);
  }
  return {
    scene, camera,
    update(time, progress, pointer) {
      const a = -0.5 + progress * 0.7 + pointer.x * 0.05;
      camera.position.set(Math.sin(a) * 3.2 + 0.3, 7.6 - progress * 1.2, Math.cos(a) * 3.6 + 2.2);
      camera.lookAt(0.4 + progress * 0.2, 0, 0.1);
      floor.material.uniforms.uTime.value = time;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// V. Ayodhya on the night of the return: domes against the stars, and rows of clay lamps on every step
// ---------------------------------------------------------------------------------------------------------------
export function lampScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);
  scene.add(skyDome([0.01, 0.015, 0.06], [0.16, 0.07, 0.12]));
  scene.fog = new THREE.Fog(0x1a0c12, 30, 120);
  // stars
  {
    const n = 900, pos = new Float32Array(n * 3), r = P.rng(3);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, y = 0.08 + 0.92 * r(), d = 300;
      pos.set([Math.cos(a) * Math.sqrt(1 - y * y) * d, y * d, Math.sin(a) * Math.sqrt(1 - y * y) * d], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff4dc, size: 1.6, sizeAttenuation: false, fog: false })));
  }
  scene.add(new THREE.HemisphereLight(0x405080, 0x200810, 0.6));
  const warm = new THREE.PointLight(0xffa040, 60, 40, 1.2);
  warm.position.set(0, 3, 0);
  scene.add(warm);
  const stone = new THREE.MeshLambertMaterial({ color: 0x8a5644, emissive: 0x120604 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x241018 });
  // the ghats: wide steps going up to the city
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(60, 0.4, 2.2), stone);
    m.position.set(0, i * 0.4, -i * 1.4);
    scene.add(m);
  }
  // the city: domes and spires against the sky
  const r = P.rng(12);
  for (let i = 0; i < 22; i++) {
    const x = -40 + 80 * r(), z = -22 - 25 * r(), w = 3 + 5 * r(), h = 4 + 10 * r();
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), dark);
    block.position.set(x, 3.6 + h / 2, z);
    scene.add(block);
    if (r() < 0.6) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(w * 0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
      dome.scale.y = 1.25;
      dome.position.set(x, 3.6 + h, z);
      scene.add(dome);
    } else {
      const spire = new THREE.Mesh(new THREE.ConeGeometry(w * 0.4, h * 0.9, 8), dark);
      spire.position.set(x, 3.6 + h + h * 0.45, z);
      scene.add(spire);
    }
  }
  // the lamps: a clay bowl, its wick, a flame and the glow round it, on every step
  const bowlGeo = new THREE.LatheGeometry([[0, 0], [0.13, 0.01], [0.2, 0.06], [0.22, 0.1], [0.2, 0.11], [0.12, 0.07], [0, 0.06]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
  const lamps = [];
  for (let i = 0; i < 9; i++) for (let k = 0; k < 26; k++) {
    if (r() < 0.12) continue;
    lamps.push(V(-24 + k * 1.9 + (r() - 0.5) * 0.6, i * 0.4 + 0.2, -i * 1.4 + 0.4 + (r() - 0.5) * 0.3));
  }
  const bowls = new THREE.InstancedMesh(bowlGeo, new THREE.MeshLambertMaterial({ color: 0xb05a2a, emissive: 0x401000 }), lamps.length);
  const flames = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.3), new THREE.MeshBasicMaterial({ map: P.texture(P.flame({})), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), lamps.length);
  const glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: P.texture(P.glow({})), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false }), lamps.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1);
  lamps.forEach((p, i) => bowls.setMatrixAt(i, m4.compose(p, q, one)));
  scene.add(bowls, flames, glows);
  return {
    scene, camera,
    update(time, progress, pointer) {
      camera.position.set(pointer.x * 0.6, 1.6 + progress * 2.4, 9.5 - progress * 2);
      camera.lookAt(0, 2.4 + progress * 3.4, -12);
      camera.updateMatrixWorld();
      // each flame lights in turn as the page comes on, and every one of them breathes
      const facing = camera.quaternion;
      lamps.forEach((p, i) => {
        const lit = smooth(i / lamps.length * 0.7, i / lamps.length * 0.7 + 0.08, progress * 1.4 + 0.08);
        const flick = 0.85 + 0.15 * Math.sin(time * (8 + (i % 7)) + i);
        flames.setMatrixAt(i, m4.compose(V(p.x, p.y + 0.22, p.z), facing, V(lit * flick, lit * flick, 1)));
        glows.setMatrixAt(i, m4.compose(V(p.x, p.y + 0.2, p.z), facing, V(lit * flick, lit * flick, 1)));
      });
      flames.instanceMatrix.needsUpdate = true;
      glows.instanceMatrix.needsUpdate = true;
      warm.intensity = 55 * smooth(0, 0.4, progress) * (0.9 + 0.1 * Math.sin(time * 6));
    },
  };
}
