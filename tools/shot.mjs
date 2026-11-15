// Stills of the built game, headless: serves dist/, opens the page with ?capture (no clock; window.lab.step moves it),
// runs a little script against window.lab, and saves a PNG.
//   node tools/shot.mjs --query "realm=forest&hero=rama" --out shots/work/forest.png [--size 1280x720] [--eval "lab.step(1/30, 20)"] [--live 4]
// --live n: without ?capture, let the real clock run n seconds first (to test the page as a player gets it)
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = resolve(fileURLToPath(import.meta.url), '..', '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const out = resolve(here, flag('out', 'shots/work/shot.png'));
mkdirSync(dirname(out), { recursive: true });
const [width, height] = flag('size', '1280x720').split('x').map(Number);
const live = flag('live') ? Number(flag('live')) : 0;
const root = resolve(here, flag('dist', 'dist'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/?${live ? '' : 'capture&'}nopad&${flag('query', '')}`;
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !/GPU stall|swiftshader|Automatic fallback/i.test(m.text()))) problems.push(`${m.type()}: ${m.text().slice(0, 1200)}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}\n${(e.stack ?? '').slice(0, 800)}`));
page.on('requestfailed', (r) => problems.push(`failed: ${r.url()}`));
const t0 = Date.now();
await page.goto(url);
let code = 0;
try {
  const waitFor = flag('wait-for', 'window.lab?.ready');
  await page.waitForFunction(waitFor, null, { timeout: Number(flag('timeout', 240000)) });
  console.log(`ready in ${Date.now() - t0} ms`);
  if (live) await page.waitForTimeout(live * 1000);
  const js = flag('eval');
  if (js) { const r = await page.evaluate(`(async () => { const lab = window.lab; ${js} })()`); if (r !== undefined) console.log('eval:', JSON.stringify(r)); }
  if (args.includes('--dom')) await page.screenshot({ path: out, timeout: 180000 });
  else {
    // the canvas itself, read in the same task as a frame is drawn (the page keeps no drawing buffer)
    const data = await page.evaluate(() => { window.lab.step(1 / 60, 1); return window.lab.renderer.domElement.toDataURL('image/jpeg', 0.9); });
    writeFileSync(out.replace(/\.png$/, '.jpg'), Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('saved', out);
} catch (e) {
  console.log('FAILED', e.message.slice(0, 600));
  code = 1;
}
if (problems.length) console.log(problems.join('\n'));
await browser.close(); server.close(); process.exit(code);
