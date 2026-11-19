// Builds the site into dist/: the kokeshi collection at the top (dist/index.html), the Ramayana site at
// dist/ramayana and the portfolio at dist/portfolio. `npm install`, then `npm run build`.
// The collection's models are made beforehand by `npm run kokeshi:export` and kept in kokeshi/public/models.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
const vite = path.join(here, 'node_modules/vite/bin/vite.js');
for (const [config, at] of [['kokeshi/vite.config.mjs', ''], ['site/vite.config.mjs', 'ramayana'], ['portfolio/vite.config.mjs', 'portfolio']]) {
  execSync(`node "${vite}" build --config ${config} --outDir "${path.join(dist, at)}" --emptyOutDir`, { cwd: here, stdio: 'inherit' });
}
fs.cpSync(path.join(here, 'LICENSE'), path.join(dist, 'LICENSE.txt'));
let bytes = 0;
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else bytes += fs.statSync(p).size; } };
walk(dist);
console.log(`dist: ${(bytes / 1048576).toFixed(1)} MB`);
