// For hosts that serve pages but no .glb files: writes each model of the built game again as JSON
// ({ "base64": ... }) beside where it would be, which src/game/rigs.js falls back to, and the game's page without
// the <html>, <head> and <body> a framing host adds itself.   node tools/frame-pack.mjs <out folder>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const dist = path.join(here, 'dist');
const out = path.resolve(process.argv[2] ?? path.join(here, 'dist-frame'));
fs.mkdirSync(path.join(out, 'figure'), { recursive: true });
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const js = html.match(/src="(\.\/assets\/index-[^"]+\.js)"/)[1], css = html.match(/href="(\.\/assets\/index-[^"]+\.css)"/)[1];
fs.writeFileSync(path.join(out, 'ramayana-paintworld.html'), `<title>Ramayana Paintworld</title>
<style>
  /* one look, by firelight: the game paints its own picture and the page only frames it */
  :root { color-scheme: dark; --ground: #14100e; --ink: #f6e8c8; --gold: #f2c56b; }
  html, body { margin: 0; height: 100%; background: var(--ground); color: var(--ink); }
  #loading { position: fixed; inset: 0; display: grid; place-items: center; color: var(--gold); font: 15px/1.4 Georgia, serif; letter-spacing: 0.2em; text-transform: uppercase; }
</style>
<link rel="stylesheet" href="${css}">
<div id="view"></div>
<div id="loading">Mixing paint</div>
<div id="hint" class="off"><b>Click</b> to look · <b>WASD</b> move · <b>Shift</b> sprint · <b>Space</b> jump<br><b>Click / J</b> strike · <b>E / right click</b> special · <b>wheel</b> step back · <b>H</b> hide this</div>
<script type="module" src="${js}"></script>
`);
const files = {};
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name), rel = path.relative(dist, p);
    if (e.isDirectory()) walk(p);
    else if (rel === 'index.html') continue;
    else if (rel.endsWith('.glb')) {
      fs.writeFileSync(path.join(out, `${rel}.json`), JSON.stringify({ base64: fs.readFileSync(p).toString('base64') }));
      files[`${rel}.json`] = path.join(out, `${rel}.json`);
    } else files[rel] = p;
  }
};
walk(dist);
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(files));
console.log(`${Object.keys(files).length} files; page ${path.join(out, 'ramayana-paintworld.html')}`);
