// Choosing who to be. The four heroes stand on a palace terrace at sunrise, painted like everything else; the eye
// goes to whichever is chosen, and a panel says who they are and what they can do. Then the tale begins (or is
// taken up again at any chapter).
import * as THREE from 'three';
import { patchBlock } from 'patch-block';
import recipe from '../../recipe.json';
import { createShade } from '../oilpaint/shade.js';
import { createCanvas, makeAir, capture } from './stage.js';
import { loadRigs } from './rigs.js';
import { createNpc } from './npc.js';
import { HEROES, HERO_ORDER } from './cast.js';
import { story, CHAPTERS } from './story.js';
import * as studio from '../realms/studio.js';

const el = (tag, cls, parent, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  parent?.appendChild(e);
  return e;
};
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
const GAP = 2.7;

export async function chooseHero() {
  let shown = true, loaded = false;
  const block = patchBlock({ ...recipe.block, onSet() {}, onTrigger() {}, onVisible(visible) { shown = visible; if (loaded) run(); } });
  const wait = el('div', 'card', document.body);
  const note = el('div', 'card-note', wait, 'Mixing paint');
  note.style.cssText = 'font-size:15px;letter-spacing:0.2em;text-transform:uppercase;color:#f2c56b';
  const say = (v, label) => { block.progress(v, label); note.textContent = label; };

  const canvas = createCanvas({ far: 2500 });
  const { renderer, shared, scene, camera } = canvas;
  const rigsComing = loadRigs({ onProgress: (done) => say(0.1 + 0.4 * done, 'Fetching the heroes') });
  const realm = await studio.build({ shared, q: new URLSearchParams(), say: (v) => say(0.5 + 0.3 * v, 'Laying the terrace'), turn });
  scene.add(...realm.add);
  const shade = createShade(renderer, shared, realm.shade.scene, realm.shade.options);
  const rigs = await rigsComing;
  say(0.85, 'Mixing paint');
  await turn();
  const frame = canvas.makeFrame();
  frame.uniforms.uShafts.value = 0;

  const npcs = HERO_ORDER.map((id, i) => createNpc({ shared, rigs, scene, light: (p) => p }, HEROES[id], { x: (i - 1.5) * GAP, y: 0, z: 0, yaw: 0, detail: 1 }));
  let chosen = Math.max(0, HERO_ORDER.indexOf(story.save.hero ?? 'rama'));
  let time = 0;
  const ctx = { air: makeAir(() => time, 0.7), ground: realm.heightAt, aim: null, eye: camera.position };
  const look = new THREE.Vector3((chosen - 1.5) * GAP, 1.0, 0), focus = new THREE.Vector3();

  // --- the panel ---
  const pick = el('div', 'pick', document.body);
  const top = el('div', 'pick-top', pick);
  el('h1', null, top, 'Ramayana');
  el('div', null, top, 'The painted epic');
  const panel = el('div', 'pick-panel', pick);
  const row = el('div', 'pick-row', panel);
  const tabs = HERO_ORDER.map((id, i) => {
    const t = el('button', 'pick-tab', row, HEROES[id].name);
    t.addEventListener('click', () => choose(i));
    return t;
  });
  const bodyEl = el('div', 'pick-body', panel);
  const about = el('div', 'pick-about', bodyEl);
  const name = el('h2', null, about), title = el('div', 'pick-title', about), lore = el('p', null, about);
  const moves = el('div', 'pick-moves', bodyEl);
  const go = el('div', 'pick-go', panel);
  const chapter = el('select', null, go);
  chapter.setAttribute('aria-label', 'Chapter');
  CHAPTERS.forEach((c, i) => { const o = el('option', null, chapter, `${i + 1}. ${c.name}: ${c.subtitle}`); o.value = c.id; });
  if (story.save.at && CHAPTERS.some((c) => c.id === story.save.at)) chapter.value = story.save.at;
  const begin = el('button', 'card-go', go, 'Begin');
  function choose(i) {
    chosen = (i + HERO_ORDER.length) % HERO_ORDER.length;
    const h = HEROES[HERO_ORDER[chosen]];
    tabs.forEach((t, k) => t.classList.toggle('on', k === chosen));
    name.textContent = h.name; title.textContent = h.title; lore.textContent = h.lore;
    moves.textContent = '';
    for (const [key, m] of [['Click / J', h.primary], ['E / right click', h.special]]) {
      const d = el('div', null, moves);
      el('b', null, d, key);
      d.append(` ${m.name}`);
    }
    el('div', null, moves, h.hint);
    begin.textContent = `Begin as ${h.name}`;
  }
  choose(chosen);
  const start = () => { const id = HERO_ORDER[chosen]; story.choose(id); story.go(chapter.value, id); };
  begin.addEventListener('click', start);
  addEventListener('keydown', (e) => {
    if (e.target === chapter) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') choose(chosen - 1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') choose(chosen + 1);
    if (e.code === 'Enter') start();
  });

  function tick(dt) {
    dt = Math.min(dt, 1 / 20);
    time += dt;
    const x = (chosen - 1.5) * GAP;
    look.x += (x - look.x) * (1 - Math.exp(-4 * dt));
    // the eye stands a little to one side of the chosen one, low, so the panel leaves them clear
    const narrow = innerWidth < 760;
    camera.position.set(look.x + 0.5, narrow ? 1.5 : 1.3, narrow ? 6.6 : 5.7);
    camera.lookAt(look.x, narrow ? 0.5 : 0.34, 0);
    npcs.forEach((n, i) => {
      n.turn(i === chosen ? 0.12 * Math.sin(time * 0.5) : (chosen - i) * 0.35);
      n.update(dt, ctx);
    });
    realm.follow(camera.position.x, camera.position.z);
    focus.set(look.x, 0, 0);
    shade.update(scene, focus);
    canvas.paint(time, focus);
  }

  window.lab = { renderer, camera, choose, step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) tick(dt); } };
  if (!capture) { renderer.debug.checkShaderErrors = false; await renderer.compileAsync(scene, camera); }
  tick(1 / 60);
  if (!capture) await canvas.gpuDone();
  let running = false, last = 0;
  function run() {
    const want = shown && !capture;
    if (want === running) return;
    running = want;
    last = performance.now();
    renderer.setAnimationLoop(want ? () => { const now = performance.now(); tick((now - last) / 1000); last = now; } : null);
  }
  canvas.fit();
  loaded = true;
  run();
  wait.remove();
  block.ready();
  window.lab.ready = true;
  window.__block = { ready: true, block, set() {} };
}
