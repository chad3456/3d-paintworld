// Plays the built game headless and checks its rules: that each hero moves, jumps and can fight, that foes come
// on and strike, and that each realm's tale can be walked from its start to its end. Nothing is painted (lab.fast),
// so it is quick.   node tools/test.mjs [name...]
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = resolve(fileURLToPath(import.meta.url), '..', '..');
const root = resolve(here, 'dist');
const only = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });

// each test: [name, query, script run in the page with `lab`; it returns { ok, ... }]
const HEROES = ['rama', 'sita', 'lakshmana', 'hanuman'];
const tests = [
  ...HEROES.map((hero) => [`moves:${hero}`, `realm=studio&hero=${hero}`, `
    lab.fast = true;
    const a = lab.player.feet.clone();
    lab.walk(120);
    const walked = lab.player.feet.distanceTo(a);
    const y0 = lab.player.feet.y;
    for (let i = 0; i < 200 && lab.player.mode !== 'jump'; i++) lab.jump();
    let top = 0; for (let i = 0; i < 240; i++) { lab.step(1 / 60, 1); top = Math.max(top, lab.player.feet.y - y0); }
    return { ok: walked > 4 && top > 0.5 && lab.player.grounded, walked: +walked.toFixed(1), top: +top.toFixed(2), mode: lab.player.mode };`]),
  ...HEROES.map((hero) => [`fight:${hero}`, `realm=studio&hero=${hero}&dummy`, `
    lab.fast = true;
    const foes = lab.foes, far = ${hero === 'rama' || hero === 'sita' ? 9 : 2.0};
    // a rakshasa stood straight ahead of the hero (who faces -z from z = 6)
    const foe = lab.game.spawnFoe(window.__cast.FOES.rakshasa(0), 0, 6 - far, { aggro: 0 });
    lab.step(1 / 60, 20);
    const h0 = foe.health;
    lab.primary(); lab.step(1 / 60, 90);
    const afterPrimary = foe.health;
    // for the special it stands a few steps off, stilled
    foe.health = 500; const h1 = foe.health; foe.pos.set(0, 0, lab.player.feet.z - 3.5); foe.push.set(0, 0, 0); foe.stun = 5; foe.awake = false;
    lab.step(1 / 60, 2);
    lab.special(); lab.step(1 / 60, 220);
    const afterSpecial = foe.health;
    // now it is let loose on the hero
    foe.health = 80; foe.awake = true; foe.aggro = 50; foe.stun = 0;
    const hp = lab.game.health;
    for (let i = 0; i < 900 && lab.game.health >= hp; i++) lab.step(1 / 60, 1);
    const struck = lab.game.health < hp;
    foes.hurt(foe, 999, lab.player.feet); lab.step(1 / 60, 120);
    return { ok: afterPrimary < h0 && afterSpecial < h1 && struck && foes.list.length === 0, primary: h0 - afterPrimary, special: h1 - afterSpecial, struck, left: foes.list.length };`]),
  ['tale:ayodhya', 'realm=ayodhya&hero=sita', `
    lab.fast = true;
    for (const [x, z] of [[-17, -12], [17, -12], [-24, 26], [24, 26], [0, 50]]) { lab.teleport(x + 1.2, z + 1.2); lab.step(1 / 60, 5); }
    const lit = lab.state().objective;
    lab.teleport(0, 70, 0, 90); lab.walk(200);
    return { ok: /gate/.test(lit) && lab.player.feet.z > 79, lit, z: +lab.player.feet.z.toFixed(1), done: lab.game.story.save.done };`],
  ['tale:forest', 'realm=forest&hero=rama', `
    lab.fast = true;
    const seen = [];
    // run after the deer down the way, as a player would
    for (let i = 0; i < 4000 && lab.foes.list.length < 4; i++) {
      const d = lab.realm.deerAt();
      const p = lab.player.feet, yaw = Math.atan2(d.x - p.x, d.z - p.z);
      lab.follow.yaw = yaw;
      lab.setInput(() => ({ move: { x: 0, y: 1 }, walk: false, sprint: false, strafe: false, jump: false, look: { x: 0, y: 0 }, zoom: 0, device: 'keyboard' }));
      lab.step(1 / 30, 1);
      if (i % 400 === 0) seen.push([+p.x.toFixed(0), +p.z.toFixed(0), lab.foes.list.length]);
      for (const f of lab.foes.alive()) if (lab.foes.list.length < 4) lab.foes.hurt(f, 999, p);
    }
    const ambushed = lab.foes.list.length;
    for (const f of lab.foes.alive()) lab.foes.hurt(f, 9999, lab.player.feet);
    lab.setInput(() => ({ move: { x: 0, y: 0 }, walk: false, sprint: false, strafe: false, jump: false, look: { x: 0, y: 0 }, zoom: 0, device: 'keyboard' }));
    lab.step(1 / 30, 80);
    const home = lab.state().objective;
    return { ok: ambushed >= 4 && /hermitage/.test(home), ambushed, home, seen };`],
  ['tale:himalaya', 'realm=himalaya&hero=hanuman', `
    lab.fast = true;
    const X = (z) => 30 * Math.sin(z / 140) + 12 * Math.sin(z / 47 + 1);
    for (const [z, off] of [[262, 5], [206, -6], [146, 7], [84, -5], [22, 6]]) { lab.teleport(X(z) + off + 0.8, z + 0.8); lab.step(1 / 60, 5); }
    const got = lab.state().objective, foes = lab.foes.list.length;
    return { ok: /hut/.test(got) && foes >= 3, got, foes };`],
  ['tale:lanka', 'realm=lanka&hero=lakshmana', `
    lab.fast = true;
    const start = lab.state();
    lab.walk(240, 1, 0, true);
    const climbed = lab.player.feet.z;
    for (const f of lab.foes.alive()) if (!f.boss) lab.foes.hurt(f, 9999, lab.player.feet);
    lab.step(1 / 60, 120);
    lab.teleport(0, 30, 0, -40); lab.step(1 / 60, 10);
    lab.teleport(0, -12, 0, -40); lab.step(1 / 60, 30);
    const facing = lab.state().objective;
    const boss = lab.foes.list.find((f) => f.boss);
    lab.foes.hurt(boss, boss.maxHealth * 0.55, lab.player.feet); lab.step(1 / 60, 60);
    const guard = lab.foes.list.length;
    for (const f of lab.foes.alive()) lab.foes.hurt(f, 99999, lab.player.feet);
    lab.step(1 / 60, 150);
    return { ok: start.foes === 11 && climbed < 100 && /Ravana/.test(facing) && guard === 4 && lab.foes.list.length === 0, foes: start.foes, climbed: +climbed.toFixed(0), facing, guard, left: lab.foes.list.length };`],
].filter(([name]) => !only.length || only.some((o) => name.includes(o)));

let failed = 0;
for (const [name, query, script] of tests) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 400)); });
  page.on('pageerror', (e) => problems.push(`${e.message}\n${(e.stack ?? '').slice(0, 500)}`));
  try {
    await page.goto(`${base}?capture&nopad&${query}`);
    await page.waitForFunction('window.lab?.ready', null, { timeout: 240000 });
    const out = await page.evaluate(`(async () => { const lab = window.lab; ${script} })()`);
    if (!out.ok || problems.length) failed++;
    console.log(out.ok && !problems.length ? 'PASS' : 'FAIL', name, JSON.stringify(out), problems.join(' | '));
  } catch (e) {
    failed++;
    console.log('FAIL', name, e.message.slice(0, 500), problems.join(' | '));
  }
  await page.close();
}
await browser.close(); server.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
