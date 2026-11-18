// Stills of the built Ramayana site, headless: scrolls to each place, draws one frame, saves the page as seen.
//   node tools/site-shots.mjs [out folder] [w x h]
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = resolve(fileURLToPath(import.meta.url), '..', '..');
const root = resolve(here, 'site/dist');
const out = resolve(here, process.argv[2] ?? 'shots/work/site');
const [W, H] = (process.argv[3] ?? '1280x720').split('x').map(Number);
const only = process.argv[4]?.split(',');
mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => problems.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/?capture`);
await page.waitForFunction('window.lab?.ready', null, { timeout: 300000 });
await page.waitForTimeout(1200);
// [name, section index, progress through it, pointer x, y]
const VIEWS = [['hero', 0, 0.0], ['hero-late', 0, 0.5], ['gust', 0, 0.93], ['leaf', 1, 0.35], ['leaf-late', 1, 0.7], ['pond', 2, 0.4], ['letter', 3, 0.35], ['lamps', 4, 0.6], ['footer', 5, 0]];
for (const [name, i, p] of VIEWS) {
  if (only && !only.includes(name)) continue;
  await page.evaluate(({ i, p }) => {
    const s = document.querySelectorAll('section[data-scene]');
    const y = i >= s.length ? document.body.scrollHeight : s[i].offsetTop + (s[i].offsetHeight - innerHeight) * p;
    scrollTo(0, y);
    // stir the pond a little, so its rings show
    for (let k = 0; k < 40; k++) { dispatchEvent(new PointerEvent('pointermove', { clientX: innerWidth * (0.3 + k * 0.01), clientY: innerHeight * (0.55 + 0.1 * Math.sin(k / 4)) })); window.lab.frame(1 / 60); }
  }, { i, p });
  await page.screenshot({ path: join(out, `${name}.jpg`), quality: 85, timeout: 120000 });
  console.log('saved', name);
}
if (problems.length) console.log('PROBLEMS\n' + [...new Set(problems)].join('\n'));
await browser.close(); server.close();
