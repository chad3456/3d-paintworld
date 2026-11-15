// The page as a player gets it, headless: the chapter's card, the button, then the realm with its writing over it.
//   node tools/flow.mjs "realm=ayodhya&hero=sita" shots/work/flow
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = resolve(fileURLToPath(import.meta.url), '..', '..');
const root = resolve(here, 'dist');
const [query = '', out = 'shots/work/flow'] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 500)); });
page.on('pageerror', (e) => problems.push(`${e.message}\n${(e.stack ?? '').slice(0, 500)}`));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${server.address().port}/?nopad&quality=low&${query}`);
await page.waitForSelector('.card', { timeout: 60000 });
console.log('card shown after', Date.now() - t0, 'ms');
await page.waitForFunction('window.lab?.ready', null, { timeout: 600000 });
const card = await page.evaluate(() => ({ heading: document.querySelector('.card h1')?.textContent, sub: document.querySelector('.card-sub')?.textContent, art: document.querySelector('.card-art img')?.naturalWidth, credit: document.querySelector('.card-credit')?.textContent, button: document.querySelector('.card-go')?.textContent, disabled: document.querySelector('.card-go')?.disabled }));
console.log('ready after', Date.now() - t0, 'ms', JSON.stringify(card));
await page.evaluate(() => document.querySelector('.card-go').click());
const t1 = await page.evaluate(() => window.lab.game.time);
await page.waitForFunction((t) => window.lab.game.time > t + 0.3, t1, { timeout: 600000 });
console.log('playing', JSON.stringify(await page.evaluate(() => ({ ...window.lab.state(), cardGone: !document.querySelector('.card:not(.gone)'), title: document.querySelector('.hud-title-name')?.textContent, name: document.querySelector('.hud-name')?.textContent, moves: [...document.querySelectorAll('.hud-move-name')].map((e) => e.textContent), line: document.querySelector('.hud-line')?.textContent, time: +window.lab.game.time.toFixed(2) }))));
if (problems.length) console.log('PROBLEMS\n' + problems.join('\n'));
await browser.close(); server.close();
