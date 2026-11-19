// Stills of the kokeshi page, headless: `node tools/kokeshi-shots.mjs [out] [id,id...]`. Saves the page with each doll
// on the stand, the shelf once every picture is painted, and a close look at each doll asked for.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = resolve(fileURLToPath(import.meta.url), '..', '..');
const root = resolve(here, 'kokeshi/dist');
const out = resolve(here, process.argv[2] ?? 'shots/work/kokeshi');
const ids = process.argv[3]?.split(',') ?? [];
mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer((req, res) => { let f = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html'); if (!f.startsWith(root) || !existsSync(f)) return void res.writeHead(404).end(); res.writeHead(200, { 'Content-Type': types[extname(f)] ?? 'application/octet-stream' }); createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/models\/index\.json|404/.test(m.text())) problems.push(m.text().slice(0, 300)); });
await page.goto(`http://127.0.0.1:${server.address().port}/?capture`, { timeout: 300000 });
await page.waitForFunction('window.kokeshi?.ready', null, { timeout: 600000 });
await page.screenshot({ path: join(out, 'page.jpg'), quality: 85, fullPage: true, timeout: 120000 });
console.log('saved page');
for (const id of ids) {
  await page.evaluate((id) => { const k = window.kokeshi; k.show(k.DOLLS.findIndex((d) => d.id === id)); window.scrollTo(0, 0); k.frame(); }, id);
  await page.locator('#stage').screenshot({ path: join(out, `${id}.jpg`), quality: 88, timeout: 120000 });
  console.log('saved', id);
}
if (problems.length) console.log('PROBLEMS\n' + [...new Set(problems)].join('\n'));
await browser.close(); server.close();
