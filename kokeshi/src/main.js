// The collection page: one doll at a time on a turning stand, the whole shelf below as pictures, and each doll's
// files to take away. `window.kokeshi.export` is how tools/kokeshi-export.mjs makes those files.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildDoll, EXPORT_SCALE } from './kokeshi.js';
import { DOLLS } from './dolls.js';
import './style.css';

const $ = (s) => document.querySelector(s);
const q = new URLSearchParams(location.search);
const capture = q.has('capture');

function dispose(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of [].concat(o.material)) { for (const k of ['map']) m[k]?.dispose(); m.dispose(); }
  });
}

// --- the stage: a paper floor, a turned stand, soft light from a window ---
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: capture });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const key = new THREE.DirectionalLight(0xfff1e0, 2.2);
key.position.set(2.5, 5, 3.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: 0.5, far: 15 });
key.shadow.radius = 6;
scene.add(key, new THREE.HemisphereLight(0xfff8ee, 0xd8c4a8, 0.6));
const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.08, 64), new THREE.MeshStandardMaterial({ color: '#b98b5c', roughness: 0.55 }));
stand.position.y = -0.04;
stand.receiveShadow = true;
const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.08;
floor.receiveShadow = true;
scene.add(stand, floor);
const turntable = new THREE.Group();
scene.add(turntable);

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0.6, 1.5, 6.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.1, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2.4;
controls.maxDistance = 9;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.62;
controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
controls.autoRotateSpeed = 1.1;

function fit() {
  const el = $('#stage'), w = el.clientWidth, h = el.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', fit);

// --- the shelf of pictures: each doll drawn once, small, then let go ---
async function shelf() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(360, 480);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const s = new THREE.Scene();
  s.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
  s.environmentIntensity = 0.6;
  const l = new THREE.DirectionalLight(0xfff1e0, 2.2); l.position.set(2.5, 5, 3.5);
  s.add(l, new THREE.HemisphereLight(0xfff8ee, 0xd8c4a8, 0.6));
  const cam = new THREE.PerspectiveCamera(26, 360 / 480, 0.1, 50);
  cam.position.set(0.9, 1.6, 7.0); cam.lookAt(0, 1.08, 0);
  const grid = $('#shelf');
  for (const [i, d] of DOLLS.entries()) {
    const doll = buildDoll(d);
    doll.rotation.y = -0.35;
    s.add(doll);
    r.render(s, cam);
    const url = r.domElement.toDataURL('image/png');
    s.remove(doll); dispose(doll);
    const b = grid.children[i];
    b.querySelector('img').src = url;
    THUMBS[d.id] = url;
    if (i === current) $('#ar-img').src = url;
    $('#loading-note').textContent = `Painting ${i + 1} of ${DOLLS.length}`;
    await new Promise((res) => setTimeout(res, 0));
  }
  r.dispose();
  $('#loading-note').textContent = '';
}

// --- one doll on the stand ---
let current = -1, doll = null;
const THUMBS = {};
function show(i, { scroll = false } = {}) {
  i = (i + DOLLS.length) % DOLLS.length;
  if (i === current) return;
  current = i;
  const d = DOLLS[i];
  if (doll) { turntable.remove(doll); dispose(doll); }
  doll = buildDoll(d);
  turntable.add(doll);
  turntable.rotation.y = 0;
  // frame the whole doll, hat and all
  const box = new THREE.Box3().setFromObject(doll), size = box.getSize(new THREE.Vector3());
  const midY = (box.min.y + box.max.y) / 2;
  const dist = (Math.max(size.y, size.x * 1.1) / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.3 / Math.min(1, camera.aspect * 1.1);
  const dir = camera.position.clone().sub(controls.target).normalize();
  controls.target.set(0, midY, 0);
  camera.position.copy(controls.target).addScaledVector(dir, dist);
  $('#no').textContent = `No. ${String(i + 1).padStart(2, '0')} / ${DOLLS.length}`;
  $('#name').textContent = d.name;
  $('#when').textContent = `${d.years} · ${d.place}`;
  $('#known').textContent = d.known;
  $('#details').innerHTML = d.details.map((t) => `<li>${t}</li>`).join('');
  for (const [kind, label] of [['glb', 'GLB'], ['usdz', 'USDZ'], ['stl', 'STL']]) {
    const a = $(`#dl-${kind}`);
    a.href = `./models/${d.id}.${kind}`;
    a.setAttribute('download', `kokeshi-${d.id}.${kind}`);
    a.querySelector('.size').textContent = SIZES[`${d.id}.${kind}`] ? `${(SIZES[`${d.id}.${kind}`] / 1048576).toFixed(1)} MB` : label;
  }
  // Quick Look on iPhone opens the USDZ in AR when its link holds a picture
  if (THUMBS[d.id]) $('#ar-img').src = THUMBS[d.id];
  $('#tall').textContent = HEIGHTS[d.id] ? `${Math.round(HEIGHTS[d.id] * 100)} cm tall` : 'About 16 cm tall';
  document.querySelectorAll('#shelf button').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
  history.replaceState(null, '', `#${d.id}`);
  if (scroll) $('#viewer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// sizes of the ready-made files, if the list is there
let SIZES = {}, HEIGHTS = {};
fetch('./models/index.json').then((r) => (r.ok ? r.json() : {})).then((j) => { SIZES = j.sizes ?? {}; HEIGHTS = j.heights ?? {}; const k = current; current = -1; show(k); }).catch(() => {});

// --- the shelf's buttons, the arrows, the keys ---
$('#shelf').innerHTML = DOLLS.map((d) => `<li><button type="button"><img alt="Kokeshi of ${d.name}" width="180" height="240" /><span class="sname">${d.name}</span><span class="syears">${d.years}</span></button></li>`).join('');
document.querySelectorAll('#shelf button').forEach((b, i) => b.addEventListener('click', () => show(i, { scroll: true })));
$('#prev').addEventListener('click', () => show(current - 1));
$('#next').addEventListener('click', () => show(current + 1));
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowLeft') show(current - 1);
  if (e.key === 'ArrowRight') show(current + 1);
});

// --- making the files: GLB for the web and Blender, USDZ for AR on iPhone, STL in millimetres for printing ---
async function exportDoll(id, kind) {
  const d = DOLLS.find((x) => x.id === id);
  const model = buildDoll(d);
  const wrap = new THREE.Group();
  wrap.name = `Kokeshi — ${d.name}`;
  wrap.add(model);
  wrap.scale.setScalar(kind === 'stl' ? EXPORT_SCALE * 1000 : EXPORT_SCALE);
  wrap.updateMatrixWorld(true);
  let bytes;
  if (kind === 'glb') bytes = new Uint8Array(await new GLTFExporter().parseAsync(wrap, { binary: true, maxTextureSize: 2048 }));
  else if (kind === 'usdz') bytes = await new USDZExporter().parseAsync(wrap, { maxTextureSize: 512 });
  else { const dv = new STLExporter().parse(wrap, { binary: true }); bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength); }
  dispose(model);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

fit();
const start = Math.max(0, DOLLS.findIndex((d) => `#${d.id}` === location.hash));
show(start);
let last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  controls.update(dt);
  renderer.render(scene, camera);
}
/** Loads a GLB back (base64) and measures it: for checking the files. */
async function measure(b64) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
  let meshes = 0; gltf.scene.traverse((o) => { if (o.isMesh) meshes++; });
  return { size: size.toArray().map((v) => +v.toFixed(3)), meshes };
}
window.kokeshi = { DOLLS, export: exportDoll, show, frame, build: buildDoll, measure, ready: false };
if (!capture) renderer.setAnimationLoop(frame); else frame();
document.body.classList.add('ready');
await shelf();
window.kokeshi.ready = true;
