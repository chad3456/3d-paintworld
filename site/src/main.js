// The page: one canvas behind everything, five painted scenes, and the scroll deciding which is shown. Between two
// scenes a gust of leaves blows across and carries one picture away to show the next. Over the finished picture a
// light painterly filter evens colour into strokes, the way a background painter flattens a photograph.
import * as THREE from 'three';
import { treeScene, leafScene, pondScene, letterScene, lampScene } from './scenes.js';
import { CHAPTERS, LETTER } from './story.js';

const q = new URLSearchParams(location.search);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);

// --- the loader: a lotus turning, and what is being done ---
const loader = $('#loader'), status = $('#loader-status');
const steps = ['Planting the ashoka', 'Gathering leaves', 'Filling the pond', 'Writing the message', 'Lighting the lamps'];
let stepIndex = 0;
const say = (i) => { stepIndex = Math.max(stepIndex, i); status.textContent = `${steps[stepIndex]}…`; };
say(0);

await Promise.race([
  Promise.all(['400 40px "Young Serif"', '400 40px "Literata"', 'italic 400 40px "Literata"', '600 40px "Literata"'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 2500)),
]);
const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, q.has('capture') ? 1 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
$('#stage').appendChild(renderer.domElement);

const scenes = [];
scenes.push(treeScene()); say(1); await tick();
scenes.push(leafScene({ words: CHAPTERS[1].leaf })); say(2); await tick();
scenes.push(pondScene(renderer, { words: CHAPTERS[2].water })); say(3); await tick();
scenes.push(letterScene(LETTER)); say(4); await tick();
scenes.push(lampScene());

// --- composition: two pictures, a wind of leaves between them, then the paint ---
const size = new THREE.Vector2();
const rt = () => new THREE.WebGLRenderTarget(1, 1, { samples: 4, colorSpace: THREE.SRGBColorSpace });
const targets = [rt(), rt()];
const mixed = new THREE.WebGLRenderTarget(1, 1, { colorSpace: THREE.SRGBColorSpace });
const flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const pass = (fragmentShader, uniforms) => {
  const s = new THREE.Scene();
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader, depthTest: false, depthWrite: false });
  s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
  return { scene: s, uniforms };
};
const NOISE = /* glsl */ `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }`;
const blend = pass(/* glsl */ `
  uniform sampler2D tA; uniform sampler2D tB; uniform float uMix; uniform float uTime; uniform vec2 uSize;
  varying vec2 vUv;
  ${NOISE}
  void main(){
    vec4 a = texture2D(tA, vUv), b = texture2D(tB, vUv);
    if (uMix <= 0.0) { gl_FragColor = a; return; }
    if (uMix >= 1.0) { gl_FragColor = b; return; }
    // a gust from the lower left: a ragged front of leaves crossing the picture
    vec2 p = vec2(vUv.x * uSize.x / uSize.y, vUv.y);
    float front = (vUv.x * 0.7 + (1.0 - vUv.y) * 0.3) + (fbm(p * 5.0 + uTime * 0.3) - 0.5) * 0.45;
    float t = uMix * 1.5 - 0.25;
    float m = smoothstep(t - 0.03, t + 0.03, front);
    // leaves riding the front: bright orange and crimson dabs along its edge
    float edge = 1.0 - smoothstep(0.0, 0.09, abs(front - t));
    float cells = step(0.62, vnoise(p * 34.0 + vec2(uTime * 3.0, -uTime)));
    vec3 leafCol = mix(vec3(0.96, 0.42, 0.1), vec3(0.78, 0.08, 0.1), vnoise(p * 9.0));
    vec4 c = mix(b, a, m);
    c.rgb = mix(c.rgb, leafCol, edge * cells * 0.95);
    gl_FragColor = c;
  }`, { tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uTime: { value: 0 }, uSize: { value: size } });
const paint = pass(/* glsl */ `
  uniform sampler2D tColor; uniform vec2 uTexel; uniform float uStrength; uniform float uTime; varying vec2 vUv;
  ${NOISE}
  // a Kuwahara filter: of four little windows round each point, take the calmest one's average.
  // Detail gives way to flat touches of colour with clean edges between them, as in a painted background.
  void main(){
    vec3 m[4]; vec3 s[4];
    for (int k = 0; k < 4; k++){ m[k] = vec3(0.0); s[k] = vec3(0.0); }
    const int R = 2;
    for (int j = -R; j <= R; j++) for (int i = -R; i <= R; i++){
      vec3 c = texture2D(tColor, vUv + vec2(float(i), float(j)) * uTexel * uStrength).rgb;
      if (i <= 0 && j <= 0){ m[0] += c; s[0] += c * c; }
      if (i >= 0 && j <= 0){ m[1] += c; s[1] += c * c; }
      if (i <= 0 && j >= 0){ m[2] += c; s[2] += c * c; }
      if (i >= 0 && j >= 0){ m[3] += c; s[3] += c * c; }
    }
    float n = float((R + 1) * (R + 1));
    float best = 1e9; vec3 col = vec3(0.0);
    for (int k = 0; k < 4; k++){
      vec3 mean = m[k] / n; vec3 v = abs(s[k] / n - mean * mean);
      float sigma = v.r + v.g + v.b;
      if (sigma < best){ best = sigma; col = mean; }
    }
    if (uStrength <= 0.0) col = texture2D(tColor, vUv).rgb;
    // a little more colour, the paper's grain, and the corners settled
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, 1.08);
    col += (hash(vUv * 1000.0 + fract(uTime)) - 0.5) * 0.025;
    float v = smoothstep(1.25, 0.45, length(vUv - 0.5) * 1.6);
    col *= 0.88 + 0.12 * v;
    gl_FragColor = vec4(col, 1.0);
  }`, { tColor: { value: mixed.texture }, uTexel: { value: new THREE.Vector2() }, uStrength: { value: 1 }, uTime: { value: 0 } });

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  renderer.getDrawingBufferSize(size);
  for (const t of [...targets, mixed]) t.setSize(size.x, size.y);
  paint.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
  for (const s of scenes) {
    if (s.camera.isPerspectiveCamera) { s.camera.aspect = w / h; s.camera.updateProjectionMatrix(); }
    s.resize?.(w, h);
  }
}
addEventListener('resize', resize);
resize();

// --- where the page is: which scene, and how far through it ---
const sections = [...document.querySelectorAll('section[data-scene]')];
function place() {
  const y = scrollY, vh = innerHeight;
  for (let i = sections.length - 1; i >= 0; i--) {
    const s = sections[i], top = s.offsetTop, span = Math.max(1, s.offsetHeight - vh);
    if (y >= top - 1 || i === 0) return { index: i, progress: Math.min(1, Math.max(0, (y - top) / span)) };
  }
  return { index: 0, progress: 0 };
}
const pointer = { x: 0, y: 0, moved: false, tx: 0, ty: 0 };
addEventListener('pointermove', (e) => {
  pointer.tx = (e.clientX / innerWidth) * 2 - 1; pointer.ty = -((e.clientY / innerHeight) * 2 - 1);
  pointer.moved = true;
});

const dots = [...document.querySelectorAll('.rail button')];
dots.forEach((d, i) => d.addEventListener('click', () => scrollTo({ top: sections[i].offsetTop + (i ? innerHeight * 0.2 : 0), behavior: reduceMotion ? 'auto' : 'smooth' })));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

let time = 0, last = performance.now(), shownIndex = -1;
const BLEND_FROM = 0.86;
function frame(dt) {
  time += dt;
  pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
  pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
  const { index, progress } = place();
  const next = Math.min(scenes.length - 1, index + 1);
  const mixAmount = next !== index ? smooth(BLEND_FROM, 1, progress) : 0;
  // headline and chrome for the scene in view
  if (index !== shownIndex) {
    shownIndex = index;
    dots.forEach((d, i) => d.toggleAttribute('aria-current', i === index));
    document.body.dataset.scene = sections[index].dataset.scene;
  }
  for (const s of sections) {
    const i = sections.indexOf(s), local = i === index ? progress : i < index ? 1 : 0;
    s.style.setProperty('--p', local.toFixed(4));
  }
  const pt = { x: pointer.x, y: pointer.y, moved: pointer.moved };
  // draw the one in view, and, while a gust carries it away, the one after
  scenes[index].update(time, Math.min(1, progress / BLEND_FROM), pt, dt);
  renderer.setRenderTarget(targets[0]);
  renderer.render(scenes[index].scene, scenes[index].camera);
  if (mixAmount > 0) {
    const ptn = { ...pt };
    scenes[next].update(time, 0, ptn, dt);
    renderer.setRenderTarget(targets[1]);
    renderer.render(scenes[next].scene, scenes[next].camera);
  }
  pointer.moved = pt.moved;
  blend.uniforms.tA.value = targets[0].texture;
  blend.uniforms.tB.value = targets[1].texture;
  blend.uniforms.uMix.value = mixAmount;
  blend.uniforms.uTime.value = time;
  renderer.setRenderTarget(mixed);
  renderer.render(blend.scene, flat);
  paint.uniforms.uTime.value = time;
  paint.uniforms.uStrength.value = brush ? (scenes[index] === scenes[2] ? 0.8 : 1.15) : 0;
  renderer.setRenderTarget(null);
  renderer.render(paint.scene, flat);
}

let brush = !q.has('nobrush');
const brushButton = $('#brush');
brushButton?.addEventListener('click', () => { brush = !brush; brushButton.setAttribute('aria-pressed', String(brush)); });
brushButton?.setAttribute('aria-pressed', String(brush));

// --- the notes drawer: the tale behind the scene in view ---
const drawer = $('#notes'), drawerBody = $('#notes-body');
function openNotes(i = shownIndex) {
  const ch = CHAPTERS[Math.max(0, i)];
  drawerBody.innerHTML = ch.notes;
  drawer.hidden = false;
  requestAnimationFrame(() => drawer.classList.add('open'));
  document.body.classList.add('reading');
  $('#notes-close').focus();
}
function closeNotes() {
  drawer.classList.remove('open');
  document.body.classList.remove('reading');
  setTimeout(() => { drawer.hidden = true; }, 450);
}
document.querySelectorAll('[data-notes]').forEach((b) => b.addEventListener('click', () => openNotes(b.dataset.notes === 'here' ? shownIndex : +b.dataset.notes)));
$('#notes-close').addEventListener('click', closeNotes);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) closeNotes(); });

// --- the verse chip: copies the line ---
const chip = $('#verse-copy');
chip?.addEventListener('click', async () => {
  const text = $('#verse-text').textContent.trim();
  try { await navigator.clipboard.writeText(text); chip.dataset.done = '1'; chip.setAttribute('aria-label', 'Copied'); setTimeout(() => { delete chip.dataset.done; chip.setAttribute('aria-label', 'Copy the verse'); }, 1600); }
  catch { const range = document.createRange(); range.selectNodeContents($('#verse-text')); getSelection().removeAllRanges(); getSelection().addRange(range); }
});

// --- go ---
frame(1 / 60);
loader.classList.add('done');
document.body.classList.add('ready');
setTimeout(() => loader.remove(), 900);
window.lab = { ready: true, renderer, scenes, frame, place, setBrush: (v) => { brush = v; } };
if (!q.has('capture')) {
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    frame(Math.min(0.05, (now - last) / 1000));
    last = now;
  });
}
document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => scrollTo({ top: sections[+b.dataset.goto].offsetTop + innerHeight * 0.2, behavior: reduceMotion ? 'auto' : 'smooth' })));
