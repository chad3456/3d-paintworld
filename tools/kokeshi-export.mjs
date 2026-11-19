// Makes each doll's files from the built page, headless: GLB, USDZ and STL into kokeshi/public/models, and an
// index.json of their sizes for the page to show. `npm run kokeshi:build` first, then `npm run kokeshi:export`,
// then build again so the files go out with the page.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = resolve(fileURLToPath(import.meta.url), '..', '..');
const root = resolve(here, 'kokeshi/dist');
const out = resolve(here, 'kokeshi/public/models');
mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer((req, res) => { let f = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html'); if (!f.startsWith(root) || !existsSync(f)) return void res.writeHead(404).end(); res.writeHead(200, { 'Content-Type': types[extname(f)] ?? 'application/octet-stream' }); createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/?capture`, { timeout: 300000 });
await page.waitForFunction('window.kokeshi?.ready', null, { timeout: 900000 });
const ids = await page.evaluate(() => window.kokeshi.DOLLS.map((d) => d.id));
const only = process.argv.slice(2);
const sizes = {}, heights = {};
for (const id of ids) {
  if (only.length && !only.includes(id)) continue;
  for (const kind of ['glb', 'usdz', 'stl']) {
    const b64 = await page.evaluate(({ id, kind }) => window.kokeshi.export(id, kind), { id, kind });
    const bytes = Buffer.from(b64, 'base64');
    writeFileSync(join(out, `${id}.${kind}`), bytes);
    if (kind === 'glb') { const m = await page.evaluate((b) => window.kokeshi.measure(b), b64); if (m.size[1] < 0.12 || m.size[1] > 0.26 || m.meshes < 3) throw new Error(`${id}.glb measures ${JSON.stringify(m)}`); heights[id] = m.size[1]; }
    sizes[`${id}.${kind}`] = bytes.length;
  }
  console.log(id, ['glb', 'usdz', 'stl'].map((k) => `${k} ${(sizes[`${id}.${k}`] / 1048576).toFixed(2)}MB`).join(' '));
}
writeFileSync(join(out, "index.json"), JSON.stringify({ made: new Date().toISOString().slice(0, 10), scale: "GLB and USDZ in metres, STL in millimetres", heights, sizes }, null, 1));
await browser.close(); server.close();
