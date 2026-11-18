// Pictures painted in code onto canvases, for use as textures: leaves, petals, clouds, the paper of a letter, a
// lotus, a koi, a lamp's flame. Each is drawn once, in layers of soft dabs, the way a background painter would.
import * as THREE from 'three';

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function texture(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** A leaf's outline as a path: `shape` 'peepal' (heart with a long drip tip), 'ashoka' (long, narrow) or 'maple'. */
function leafPath(g, w, h, shape) {
  g.beginPath();
  if (shape === 'peepal') {
    g.moveTo(w * 0.5, h * 0.97);
    g.bezierCurveTo(w * 0.12, h * 0.86, -w * 0.04, h * 0.5, w * 0.16, h * 0.28);
    g.bezierCurveTo(w * 0.28, h * 0.12, w * 0.44, h * 0.16, w * 0.5, h * 0.24);
    g.bezierCurveTo(w * 0.56, h * 0.16, w * 0.72, h * 0.12, w * 0.84, h * 0.28);
    g.bezierCurveTo(w * 1.04, h * 0.5, w * 0.88, h * 0.86, w * 0.5, h * 0.97);
  } else if (shape === 'maple') {
    const pts = [[0.5, 0.02], [0.6, 0.22], [0.86, 0.12], [0.76, 0.36], [0.98, 0.44], [0.74, 0.56], [0.82, 0.74], [0.56, 0.66], [0.52, 0.98], [0.48, 0.66], [0.18, 0.74], [0.26, 0.56], [0.02, 0.44], [0.24, 0.36], [0.14, 0.12], [0.4, 0.22]];
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)));
  } else {
    g.moveTo(w * 0.5, h * 0.02);
    g.bezierCurveTo(w * 0.9, h * 0.3, w * 0.86, h * 0.7, w * 0.5, h * 0.98);
    g.bezierCurveTo(w * 0.14, h * 0.7, w * 0.1, h * 0.3, w * 0.5, h * 0.02);
  }
  g.closePath();
}

/**
 * A painted leaf. colors: [light, middle, dark] as [r, g, b]. The light falls from the upper left; the leaf is laid
 * in with long strokes along its veins, then the veins drawn over it. Returns a canvas.
 */
export function leaf({ w = 256, h = 384, shape = 'ashoka', colors, seed = 1, veins = true, text = null }) {
  const [c, g] = canvas(w, h);
  const r = rng(seed);
  const [L, M, D] = colors;
  leafPath(g, w, h, shape);
  g.save();
  g.clip();
  // underpainting: dark at the edge and the stem, light where the sun falls
  const grad = g.createLinearGradient(w * 0.15, h * 0.1, w * 0.85, h * 0.9);
  grad.addColorStop(0, rgb(L)); grad.addColorStop(0.45, rgb(M)); grad.addColorStop(1, rgb(D));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // strokes along the veins, out from the midrib
  for (let i = 0; i < 260; i++) {
    const y = r() * h, side = r() < 0.5 ? -1 : 1;
    const len = w * (0.1 + 0.25 * r());
    const t = r();
    const col = mix(mix(L, D, t), M, 0.3 + 0.4 * r());
    g.strokeStyle = rgb(col, 0.35 + 0.4 * r());
    g.lineWidth = 3 + 9 * r();
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w * 0.5, y);
    g.quadraticCurveTo(w * 0.5 + side * len * 0.5, y - h * 0.05, w * 0.5 + side * len, y - h * 0.09 - r() * h * 0.05);
    g.stroke();
  }
  // big flat shapes of shade, as a cel painter would lay them
  for (let i = 0; i < 6; i++) {
    g.fillStyle = rgb(D, 0.18 + 0.15 * r());
    g.beginPath();
    const x = w * (0.5 + (r() - 0.3) * 0.7), y = h * (0.3 + r() * 0.6);
    g.ellipse(x, y, w * (0.08 + 0.18 * r()), h * (0.05 + 0.12 * r()), r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  if (veins) {
    g.strokeStyle = rgb(mix(D, [40, 10, 5], 0.4), 0.7);
    g.lineWidth = Math.max(2, w * 0.012);
    g.beginPath(); g.moveTo(w * 0.5, h * 0.99); g.lineTo(w * 0.5, h * (shape === 'peepal' ? 0.24 : 0.04)); g.stroke();
    g.lineWidth = Math.max(1, w * 0.005);
    g.strokeStyle = rgb(mix(D, [60, 20, 10], 0.3), 0.5);
    for (let i = 1; i < 9; i++) {
      const y = h * (0.9 - i * 0.085);
      for (const side of [-1, 1]) {
        g.beginPath(); g.moveTo(w * 0.5, y);
        g.quadraticCurveTo(w * 0.5 + side * w * 0.2, y - h * 0.04, w * 0.5 + side * w * (0.36 - i * 0.012), y - h * 0.12);
        g.stroke();
      }
    }
  }
  if (text) text(g, w, h);
  g.restore();
  // a darker edge, a little uneven
  leafPath(g, w, h, shape);
  g.strokeStyle = rgb(D, 0.55);
  g.lineWidth = Math.max(2, w * 0.01);
  g.stroke();
  // the stem
  g.strokeStyle = rgb(D);
  g.lineWidth = Math.max(2, w * 0.018);
  g.beginPath(); g.moveTo(w * 0.5, h * 0.97); g.lineTo(w * 0.5, h); g.stroke();
  return c;
}

/** A soft cumulus, lit from above: piled lobes, white tops, a lavender-blue shade beneath. */
export function cloud({ w = 512, h = 256, seed = 1 }) {
  const [c, g] = canvas(w, h);
  const r = rng(seed);
  const lobes = [];
  for (let i = 0; i < 26; i++) {
    const x = w * (0.12 + 0.76 * r()), base = h * 0.82;
    const rad = h * (0.1 + 0.22 * r()) * (1 - Math.abs(x / w - 0.5) * 0.9);
    lobes.push([x, base - rad * (0.4 + r() * 1.3), rad]);
  }
  lobes.sort((a, b) => a[1] - b[1]);
  // shade first, a little lower, then the lit lobes over it
  for (const [x, y, rad] of lobes) {
    const sh = g.createRadialGradient(x, y + rad * 0.3, rad * 0.2, x, y + rad * 0.25, rad);
    sh.addColorStop(0, 'rgba(160,178,226,0.85)'); sh.addColorStop(1, 'rgba(170,186,230,0)');
    g.fillStyle = sh;
    g.beginPath(); g.arc(x, y + rad * 0.25, rad, 0, Math.PI * 2); g.fill();
  }
  for (const [x, y, rad] of lobes) {
    const grad = g.createRadialGradient(x - rad * 0.3, y - rad * 0.45, rad * 0.1, x, y, rad);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.65, 'rgba(244,248,255,0.97)');
    grad.addColorStop(1, 'rgba(200,214,240,0.0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  // flat underside
  g.globalCompositeOperation = 'destination-out';
  const fade = g.createLinearGradient(0, h * 0.78, 0, h);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fade; g.fillRect(0, h * 0.78, w, h * 0.22);
  return c;
}

/** Long white brushy streaks, the wind drawn across an anime sky. */
export function streaks({ w = 1024, h = 512, seed = 3, count = 30 }) {
  const [c, g] = canvas(w, h);
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * w, y = r() * h, len = w * (0.08 + 0.25 * r()), a = -0.5 + (r() - 0.5) * 0.25;
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = `rgba(255,255,255,${0.12 + 0.3 * r()})`;
      g.lineWidth = 1 + 5 * r();
      g.lineCap = 'round';
      g.beginPath();
      const o = (r() - 0.5) * 14;
      g.moveTo(x, y + o);
      g.lineTo(x + Math.cos(a) * len * (0.5 + 0.5 * r()), y + o + Math.sin(a) * len * (0.5 + 0.5 * r()));
      g.stroke();
    }
  }
  return c;
}

/** A ground strewn with fallen leaves and blossoms, seen from above; tiles. */
export function litter({ size = 1024, seed = 5, palette, base }) {
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  g.fillStyle = rgb(base);
  g.fillRect(0, 0, size, size);
  const stamps = palette.map((cols, i) => leaf({ w: 64, h: 96, shape: i % 3 === 2 ? 'maple' : 'ashoka', colors: cols, seed: seed + i, veins: false }));
  for (let i = 0; i < 2600; i++) {
    const s = stamps[Math.floor(r() * stamps.length)];
    const x = r() * size, y = r() * size, k = 0.35 + 0.6 * r();
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      if (x + dx < -80 || x + dx > size + 80 || y + dy < -80 || y + dy > size + 80) continue;
      g.save();
      g.translate(x + dx, y + dy); g.rotate(r() * 6.283); g.scale(k, k);
      g.globalAlpha = 0.85 + 0.15 * r();
      g.drawImage(s, -32, -48);
      g.restore();
    }
  }
  // the shade between leaves, deepening the pile
  g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(110,40,30,${0.05 + 0.08 * r()})`;
    g.beginPath(); g.arc(r() * size, r() * size, 20 + 60 * r(), 0, 6.283); g.fill();
  }
  return c;
}

/** A sheet of old paper with torn edges and stains, with `draw(g, w, h)` writing on it. */
export function paper({ w = 1024, h = 1400, seed = 9, draw }) {
  const [c, g] = canvas(w, h);
  const r = rng(seed);
  g.beginPath();
  const edge = [];
  const step = 18;
  for (let x = 0; x <= w; x += step) edge.push([x, 10 + r() * 14]);
  for (let y = 0; y <= h; y += step) edge.push([w - 10 - r() * 14, y]);
  for (let x = w; x >= 0; x -= step) edge.push([x, h - 10 - r() * 18]);
  for (let y = h; y >= 0; y -= step) edge.push([10 + r() * 14, y]);
  edge.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.save();
  g.clip();
  const grad = g.createRadialGradient(w * 0.45, h * 0.4, w * 0.1, w * 0.5, h * 0.5, w * 0.9);
  grad.addColorStop(0, '#fbf3dc'); grad.addColorStop(0.7, '#f1dfae'); grad.addColorStop(1, '#d9b36f');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${170 + r() * 40},${120 + r() * 30},${50 + r() * 30},${0.04 + 0.08 * r()})`;
    g.beginPath(); g.ellipse(r() * w, r() * h, 30 + 120 * r(), 20 + 90 * r(), r() * 3, 0, 6.283); g.fill();
  }
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = `rgba(150,100,40,${0.12 + 0.1 * r()})`;
    g.lineWidth = 2 + 3 * r();
    g.beginPath(); g.arc(r() * w, r() * h, 40 + 80 * r(), 0, 6.283 * (0.5 + 0.5 * r())); g.stroke();
  }
  draw?.(g, w, h, r);
  g.restore();
  return c;
}

/** A lotus flower seen from above and a little to the side: rings of pink petals round a golden heart. */
export function lotus({ size = 256, seed = 4 }) {
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  const cx = size / 2, cy = size / 2;
  for (const [ring, n, len, col] of [[0, 8, 0.46, [236, 120, 160]], [1, 8, 0.38, [246, 160, 190]], [2, 6, 0.28, [255, 205, 220]]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + ring * 0.4 + r() * 0.2;
      g.save();
      g.translate(cx, cy); g.rotate(a);
      const grad = g.createLinearGradient(0, 0, 0, -size * len);
      grad.addColorStop(0, rgb(mix(col, [255, 255, 240], 0.5)));
      grad.addColorStop(1, rgb(col));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(size * 0.13, -size * len * 0.55, 0, -size * len);
      g.quadraticCurveTo(-size * 0.13, -size * len * 0.55, 0, 0);
      g.fill();
      g.strokeStyle = rgb(mix(col, [150, 40, 80], 0.4), 0.5);
      g.lineWidth = 2; g.stroke();
      g.restore();
    }
  }
  g.fillStyle = '#f6c84a';
  g.beginPath(); g.arc(cx, cy, size * 0.07, 0, 6.283); g.fill();
  g.fillStyle = '#c98a1c';
  for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(cx + Math.cos(i) * size * 0.04, cy + Math.sin(i * 1.7) * size * 0.04, 2, 0, 6.283); g.fill(); }
  return c;
}

/** A lotus pad: a round green leaf with its notch, veins running out from the middle. */
export function pad({ size = 256, seed = 2 }) {
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  const cx = size / 2, cy = size / 2, R = size * 0.47;
  g.beginPath();
  g.moveTo(cx, cy);
  g.arc(cx, cy, R, -1.4, 4.75);
  g.closePath();
  const grad = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
  grad.addColorStop(0, '#9fdc6c'); grad.addColorStop(0.7, '#4f9e3d'); grad.addColorStop(1, '#2d6b2e');
  g.fillStyle = grad;
  g.fill();
  g.save(); g.clip();
  g.strokeStyle = 'rgba(210,255,170,0.45)';
  g.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const a = -1.4 + (i / 17) * 6.15;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
  }
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(30,80,30,${0.08 + 0.1 * r()})`;
    g.beginPath(); g.arc(cx + (r() - 0.5) * R * 1.6, cy + (r() - 0.5) * R * 1.6, 8 + 20 * r(), 0, 6.283); g.fill();
  }
  g.restore();
  g.strokeStyle = '#2a5a26'; g.lineWidth = 3;
  g.beginPath(); g.arc(cx, cy, R, -1.4, 4.75); g.stroke();
  return c;
}

/** A koi from above: `colors` the body and its patches. */
export function koi({ w = 128, h = 320, seed = 3, body = [250, 245, 235], patch = [235, 90, 40] }) {
  const [c, g] = canvas(w, h);
  const r = rng(seed);
  const outline = () => {
    g.beginPath();
    g.moveTo(w * 0.5, h * 0.02);
    g.bezierCurveTo(w * 0.86, h * 0.1, w * 0.78, h * 0.5, w * 0.56, h * 0.72);
    g.lineTo(w * 0.5, h * 0.78);
    g.lineTo(w * 0.44, h * 0.72);
    g.bezierCurveTo(w * 0.22, h * 0.5, w * 0.14, h * 0.1, w * 0.5, h * 0.02);
    g.closePath();
  };
  // the tail and fins, thin and pale
  g.fillStyle = rgb(mix(body, [255, 255, 255], 0.3), 0.75);
  g.beginPath(); g.moveTo(w * 0.5, h * 0.74); g.quadraticCurveTo(w * 0.95, h * 0.9, w * 0.8, h * 0.99); g.quadraticCurveTo(w * 0.5, h * 0.86, w * 0.2, h * 0.99); g.quadraticCurveTo(w * 0.05, h * 0.9, w * 0.5, h * 0.74); g.fill();
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(w * (0.5 + s * 0.3), h * 0.26, w * 0.16, h * 0.06, s * 0.8, 0, 6.283); g.fill(); }
  outline();
  g.fillStyle = rgb(body); g.fill();
  g.save(); outline(); g.clip();
  for (let i = 0; i < 4; i++) {
    g.fillStyle = rgb(patch, 0.95);
    g.beginPath(); g.ellipse(w * (0.35 + 0.3 * r()), h * (0.08 + 0.55 * r()), w * (0.14 + 0.16 * r()), h * (0.05 + 0.08 * r()), r() * 2, 0, 6.283); g.fill();
  }
  const shade = g.createLinearGradient(0, 0, w, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.18)'); shade.addColorStop(0.5, 'rgba(255,255,255,0.1)'); shade.addColorStop(1, 'rgba(0,0,0,0.2)');
  g.fillStyle = shade; g.fillRect(0, 0, w, h);
  g.restore();
  return c;
}

/** A small white jasmine (or frangipani) flower, five petals and a yellow eye. */
export function flower({ size = 128, petals = 5, color = [255, 252, 244], eye = [250, 200, 60] }) {
  const [c, g] = canvas(size, size);
  const cx = size / 2;
  for (let i = 0; i < petals; i++) {
    g.save(); g.translate(cx, cx); g.rotate((i / petals) * 6.283);
    const grad = g.createLinearGradient(0, 0, 0, -size * 0.45);
    grad.addColorStop(0, rgb(eye)); grad.addColorStop(0.3, rgb(color)); grad.addColorStop(1, rgb(mix(color, [230, 225, 240], 0.4)));
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(size * 0.06, -size * 0.24, size * 0.13, size * 0.22, 0.35, 0, 6.283); g.fill();
    g.restore();
  }
  return c;
}

/** A soft round glow, for flames and lamps. */
export function glow({ size = 128, color = [255, 180, 80] }) {
  const [c, g] = canvas(size, size);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, rgb([255, 250, 230], 1)); grad.addColorStop(0.18, rgb(color, 0.9)); grad.addColorStop(0.5, rgb(color, 0.25)); grad.addColorStop(1, rgb(color, 0));
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  return c;
}

/** A flame: a teardrop of light, white at its root. */
export function flame({ w = 64, h = 128 }) {
  const [c, g] = canvas(w, h);
  const grad = g.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,235,1)'); grad.addColorStop(0.35, 'rgba(255,214,110,1)'); grad.addColorStop(0.75, 'rgba(255,120,30,0.9)'); grad.addColorStop(1, 'rgba(255,60,10,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(w / 2, 0);
  g.bezierCurveTo(w * 0.95, h * 0.5, w * 0.9, h * 0.95, w / 2, h);
  g.bezierCurveTo(w * 0.1, h * 0.95, w * 0.05, h * 0.5, w / 2, 0);
  g.fill();
  return c;
}
