// Builds the game into dist/ (index.html at the top) with the files it loads and their licences, and beside it
// the Ramayana site (dist/ramayana) and the portfolio (dist/portfolio):
// `npm install`, then `npm run build`.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
execSync(`node "${path.join(here, 'node_modules/vite/bin/vite.js')}" build --config vite.config.mjs`, { cwd: here, stdio: 'inherit' });
// the other pages ride along with the game: the Ramayana site at /ramayana/, the portfolio at /portfolio/ and the
// kokeshi collection at /kokeshi/ (its models are made beforehand by `npm run kokeshi:export` and kept in the repo)
for (const [config, at] of [['site/vite.config.mjs', 'ramayana'], ['portfolio/vite.config.mjs', 'portfolio'], ['kokeshi/vite.config.mjs', 'kokeshi']]) {
  execSync(`node "${path.join(here, 'node_modules/vite/bin/vite.js')}" build --config ${config} --outDir "${path.join(dist, at)}" --emptyOutDir`, { cwd: here, stdio: 'inherit' });
}

const put = (from, to) => fs.cpSync(path.join(here, from), path.join(dist, to), { recursive: true });
put('LICENSE', 'LICENSE.txt');
put('LICENCE-NOTES.md', 'LICENCE-NOTES.md');



let bytes = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else bytes += fs.statSync(p).size;
  }
};
walk(dist);
console.log(`dist: ${(bytes / 1048576).toFixed(1)} MB`);
