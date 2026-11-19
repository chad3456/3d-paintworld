// A kokeshi, made the way a turner makes one: a body turned on the lathe, a round head set on it, the face and robe
// painted, the turned red and green rings at the shoulder and the foot. On top of that go the few things that make
// a doll someone: beard, hair, hat, collar, spectacles, something held.
//
// Measures are in "doll units": the body is 1.16 tall and the head's radius 0.5. Front is +z, up is +y. Export
// scales the whole doll to about 16 cm (see EXPORT_SCALE).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const BODY_H = 1.16;
export const HEAD = { y: 1.64, r: 0.5 };
export const EXPORT_SCALE = 0.075; // doll units to metres: about 16 cm tall

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

function rng(seed) {
  let s = 0;
  for (const c of String(seed)) s = (Math.imul(s, 31) + c.charCodeAt(0)) >>> 0;
  s ||= 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
function tex(c, { wrap = false, offset = 0 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.userData.mimeType = 'image/jpeg'; // smaller files when exported
  if (wrap) { t.wrapS = THREE.RepeatWrapping; t.offset.x = offset; }
  return t;
}
const shade = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return `#${c.getHexString()}`; };

/** A point on the head: `a` round from the front (+ toward the doll's left, the viewer's right), `e` up from the middle. */
export function onHead(a, e, out = 1) {
  const r = HEAD.r * out;
  return V(Math.sin(a) * Math.cos(e) * r, HEAD.y + Math.sin(e) * r, Math.cos(a) * Math.cos(e) * r);
}

// --------------------------------------------------------------------------------------------------------------
// paint: the head
// --------------------------------------------------------------------------------------------------------------
const HW = 2048, HH = 1024;
// where on the head's picture a direction lands (the sphere's own mapping puts the front at a quarter of the way)
const hx = (a) => ((0.25 + a / TAU) % 1 + 1) % 1 * HW;
const hy = (e) => (0.5 - e / Math.PI) * HH;
const EYE_E = -0.07, EYE_A = 0.29;

function hairline(style, a) {
  const t = Math.min(1, Math.abs(a) / Math.PI);
  const [f, s, b] = { receding: [1.0, 0.25, -0.32], wig: [0.55, -0.05, -0.4], long: [0.6, 0.05, -0.5], ringlets: [0.6, -0.05, -0.45], swept: [0.66, 0.1, -0.4] }[style] ?? [0.62, 0.12, -0.35];
  return t < 0.3 ? f + (s - f) * (t / 0.3) : s + (b - s) * ((t - 0.3) / 0.7);
}

function paintHead(d) {
  const [c, g] = canvas(HW, HH);
  const r = rng(d.id + 'head');
  // the wood of the head, lightly varnished: the skin colour with a soft grain
  g.fillStyle = d.skin; g.fillRect(0, 0, HW, HH);
  for (let i = 0; i < 160; i++) {
    g.strokeStyle = `rgba(120,70,30,${0.02 + 0.03 * r()})`; g.lineWidth = 2 + 6 * r();
    const y = r() * HH; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(HW * 0.3, y + 20 * (r() - 0.5), HW * 0.7, y - 20 * (r() - 0.5), HW, y); g.stroke();
  }
  const hair = d.hair;
  const strands = (x0, x1, yTop, yBot, col) => {
    for (let i = 0; i < (x1 - x0) / 3; i++) {
      const x = x0 + r() * (x1 - x0);
      g.strokeStyle = r() < 0.5 ? shade(col, 0.08) : shade(col, -0.08);
      g.globalAlpha = 0.5; g.lineWidth = 2 + 2 * r();
      g.beginPath(); g.moveTo(x, yTop); g.lineTo(x + (r() - 0.5) * 20, yBot); g.stroke();
    }
    g.globalAlpha = 1;
  };
  // the hair, painted solid as on any kokeshi, column by column round the head
  if (!['bald', 'none', 'bald-sides'].includes(hair.style)) {
    g.fillStyle = hair.color;
    g.beginPath(); g.moveTo(0, 0);
    for (let x = 0; x <= HW; x += 4) {
      const a = (x / HW - 0.25) * TAU;
      const aa = Math.atan2(Math.sin(a), Math.cos(a));
      g.lineTo(x, hy(hairline(hair.style, aa)) + Math.sin(x * 0.09) * 4);
    }
    g.lineTo(HW, 0); g.closePath(); g.fill();
    // the strands are kept to the hair: the face is not painted over
    g.save(); g.clip();
    strands(0, HW, 0, hy(-0.6), hair.color);
    g.restore();
    if (hair.style === 'part') { g.strokeStyle = shade(d.skin, -0.05); g.lineWidth = 7; g.beginPath(); g.moveTo(hx(0), hy(Math.PI / 2)); g.lineTo(hx(0), hy(0.6)); g.stroke(); }
    if (hair.style === 'ringlets') { g.strokeStyle = shade(d.skin, -0.1); g.lineWidth = 5; g.beginPath(); g.moveTo(hx(0), hy(Math.PI / 2)); g.lineTo(hx(0), hy(0.58)); g.stroke(); }
    if (hair.style === 'wig') for (let k = 0; k < 6; k++) { g.strokeStyle = 'rgba(160,150,140,0.5)'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, hy(1.2 - k * 0.22)); g.lineTo(HW, hy(1.2 - k * 0.22)); g.stroke(); }
    if (hair.style === 'swept') for (let k = 0; k < 40; k++) { const x = hx(-0.5 + r()); g.strokeStyle = shade(hair.color, 0.12); g.lineWidth = 3; g.beginPath(); g.moveTo(x, hy(0.62)); g.quadraticCurveTo(x + 10, hy(1.0), x + (r() - 0.5) * 30, hy(1.5)); g.stroke(); }
  } else if (hair.style === 'bald-sides') {
    // a bald crown: hair only round the sides and the back, below the line of the temples
    g.fillStyle = hair.color;
    for (let x = 0; x < HW; x += 4) {
      const a = Math.atan2(Math.sin((x / HW - 0.25) * TAU), Math.cos((x / HW - 0.25) * TAU));
      if (Math.abs(a) < 0.95) continue;
      const top = hy(0.2 + 0.06 * Math.sin(x * 0.05)), bottom = hy(-0.42 - 0.05 * Math.sin(x * 0.07));
      g.fillRect(x, top, 4, bottom - top);
    }
    g.save(); g.beginPath(); g.rect(hx(0.95) , hy(0.26), HW * (1 - 1.9 / TAU), hy(-0.47) - hy(0.26)); g.clip();
    strands(0, HW, hy(0.26), hy(-0.47), hair.color);
    g.restore();
  }
  // the face: brows, eyes, nose, a small red mouth, and cheeks
  const browCol = d.brows === 'white-long' ? '#f4f2ec' : shade(hair.style === 'bald' || hair.style === 'none' ? (d.beard?.color ?? '#3a2a20') : hair.color, -0.15);
  for (const side of [-1, 1]) {
    const x = hx(side * EYE_A), y = hy(EYE_E + 0.16);
    g.strokeStyle = browCol; g.lineCap = 'round';
    const thick = { bushy: 22, heavy: 26, long: 14, 'white-long': 16, thin: 7, normal: 11 }[d.brows] ?? 11;
    g.lineWidth = thick;
    g.beginPath();
    if (d.brows === 'long' || d.brows === 'white-long') { g.moveTo(x - side * 46, y + 4); g.quadraticCurveTo(x + side * 20, y - 18, x + side * 120, y + 60); }
    else { g.moveTo(x - side * 44, y + 8); g.quadraticCurveTo(x, y - 14, x + side * 50, y + 6); }
    g.stroke();
    if (d.brows === 'bushy' || d.brows === 'heavy') for (let k = 0; k < 18; k++) { g.lineWidth = 3; g.beginPath(); const px = x + (r() - 0.5) * 90; g.moveTo(px, y + 8); g.lineTo(px + side * 10, y - 12); g.stroke(); }
    // eyes
    const ey = hy(EYE_E);
    g.fillStyle = '#1b1514'; g.strokeStyle = '#1b1514';
    if (d.eyes === 'arc') { g.lineWidth = 9; g.beginPath(); g.arc(x, ey - 20, 34, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); }
    else {
      g.beginPath(); g.ellipse(x, ey, 26, 16, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + side * 6 - 4, ey - 5, 5, 0, TAU); g.fill();
      g.lineWidth = 6; g.beginPath(); g.moveTo(x - 34, ey - 10); g.quadraticCurveTo(x, ey - 30, x + 34, ey - 10); g.stroke();
    }
    // cheeks
    const grad = g.createRadialGradient(hx(side * 0.47), hy(-0.27), 0, hx(side * 0.47), hy(-0.27), 70);
    grad.addColorStop(0, 'rgba(232,110,110,0.45)'); grad.addColorStop(1, 'rgba(232,110,110,0)');
    g.fillStyle = grad; g.fillRect(hx(side * 0.47) - 80, hy(-0.27) - 80, 160, 160);
  }
  g.strokeStyle = shade(d.skin, -0.28); g.lineWidth = 7; g.lineCap = 'round';
  const nx = hx(0), ny = hy(-0.2);
  g.beginPath();
  if (d.nose === 'snub') { g.arc(nx, ny, 22, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); g.fillStyle = shade(d.skin, -0.3); for (const s of [-1, 1]) { g.beginPath(); g.arc(nx + s * 12, ny + 14, 5, 0, TAU); g.fill(); } }
  else if (d.nose === 'long' || d.nose === 'straight') { g.moveTo(nx - 6, hy(-0.03)); g.lineTo(nx - 8, ny + 10); g.quadraticCurveTo(nx, ny + 22, nx + 14, ny + 10); g.stroke(); }
  else { g.arc(nx, ny + 6, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  g.fillStyle = '#c4362e';
  g.beginPath(); g.ellipse(hx(0), hy(-0.34), 20, 9, 0, 0, TAU); g.fill();
  g.fillStyle = '#e05a4c'; g.beginPath(); g.ellipse(hx(0), hy(-0.345), 9, 4, 0, 0, TAU); g.fill();
  if (d.soulPatch) { g.fillStyle = d.moustache.color; g.beginPath(); g.ellipse(hx(0), hy(-0.45), 12, 18, 0, 0, TAU); g.fill(); }
  return tex(c);
}

// --------------------------------------------------------------------------------------------------------------
// paint: the robe, all round the body. The front is the middle of the picture.
// --------------------------------------------------------------------------------------------------------------
const RW = 2048, RH = 1024;
const COATS = new Set(['doublet', 'grid', 'stars', 'notes', 'peaks', 'atoms', 'lightning', 'swirls', 'punchcards']);

const PATTERNS = {
  meander(g, d) {
    for (const y0 of [RH * 0.74, RH * 0.12]) {
      g.strokeStyle = d.robe.accent; g.lineWidth = 9;
      for (let x = 0; x < RW; x += 64) {
        g.beginPath(); g.moveTo(x, y0 + 48); g.lineTo(x, y0); g.lineTo(x + 48, y0); g.lineTo(x + 48, y0 + 32); g.lineTo(x + 16, y0 + 32); g.lineTo(x + 16, y0 + 16); g.lineTo(x + 32, y0 + 16); g.stroke();
      }
    }
    // folds of the cloth, falling from the left shoulder
    g.strokeStyle = 'rgba(120,100,70,0.22)'; g.lineWidth = 10;
    for (let k = 0; k < 14; k++) { const x = RW * 0.3 + k * 90; g.beginPath(); g.moveTo(x, RH * 0.18); g.quadraticCurveTo(x + 120, RH * 0.45, x + 40, RH * 0.72); g.stroke(); }
  },
  clouds(g, d, r) {
    g.strokeStyle = d.robe.accent; g.fillStyle = d.robe.accent; g.lineWidth = 7;
    for (let i = 0; i < 26; i++) {
      const x = r() * RW, y = RH * (0.18 + 0.58 * r()), s = 22 + 18 * r();
      for (const [dx, dy, k] of [[0, 0, 1], [s * 1.3, -s * 0.4, 0.8], [s * 2.4, 0, 0.9]]) { g.beginPath(); g.arc(x + dx, y + dy, s * k, Math.PI, TAU * 0.98); g.stroke(); g.beginPath(); g.arc(x + dx, y + dy, s * k * 0.45, 0, TAU); g.stroke(); }
      g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s * 3.4, y); g.stroke();
    }
  },
  taiji(g, d) {
    const x = RW / 2, y = RH * 0.62, R = 95;
    g.fillStyle = '#f6efe0'; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
    g.fillStyle = d.robe.accent; g.beginPath(); g.arc(x, y, R, -Math.PI / 2, Math.PI / 2); g.arc(x, y + R / 2, R / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(x, y - R / 2, R / 2, Math.PI / 2, -Math.PI / 2); g.fill();
    g.fillStyle = '#f6efe0'; g.beginPath(); g.arc(x, y + R / 2, R / 7, 0, TAU); g.fill();
    g.fillStyle = d.robe.accent; g.beginPath(); g.arc(x, y - R / 2, R / 7, 0, TAU); g.fill();
    g.strokeStyle = d.robe.accent; g.lineWidth = 5; g.beginPath(); g.arc(x, y, R, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(80,50,20,0.5)'; g.lineWidth = 6;
    for (let k = 0; k < 4; k++) { g.beginPath(); for (let px = 0; px <= RW; px += 16) g.lineTo(px, RH * (0.78 + k * 0.02) + Math.sin(px * 0.02 + k) * 10); g.stroke(); }
  },
  laurel(g, d) {
    g.fillStyle = d.robe.accent; g.strokeStyle = d.robe.accent; g.lineWidth = 5;
    for (const y0 of [RH * 0.77, RH * 0.15]) g.fillRect(0, y0, RW, 14);
    for (let k = 0; k < 7; k++) {
      const cx = (k + 0.5) * RW / 7, cy = RH * 0.62;
      for (const s of [-1, 1]) for (let j = 0; j < 6; j++) { const a = -Math.PI / 2 + s * (0.3 + j * 0.32); g.beginPath(); g.ellipse(cx + Math.cos(a) * 48, cy + Math.sin(a) * 48, 14, 6, a + Math.PI / 2, 0, TAU); g.fill(); }
    }
  },
  whirl(g, d) {
    g.strokeStyle = d.robe.accent; g.lineWidth = 5;
    for (let k = 0; k < 9; k++) { g.globalAlpha = 0.6; g.beginPath(); for (let px = 0; px <= RW; px += 12) g.lineTo(px, RH * (0.2 + k * 0.07) + Math.sin(px * 0.006 + k * 0.7) * 26); g.stroke(); }
    g.globalAlpha = 1; g.fillStyle = d.robe.accent;
    for (let i = 0; i < 16; i++) { const x = (i + 0.5) * RW / 16, y = RH * 0.78; star(g, x, y, 14, 6); }
  },
  sketches(g, d) {
    g.strokeStyle = d.robe.accent; g.lineWidth = 4; g.globalAlpha = 0.85;
    const x = RW / 2, y = RH * 0.52, R = 120;
    g.beginPath(); g.arc(x, y, R, 0, TAU); g.stroke(); g.strokeRect(x - R * 0.8, y - R * 0.95, R * 1.6, R * 1.75);
    g.beginPath(); g.arc(x, y - R * 0.72, 18, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(x, y - R * 0.55); g.lineTo(x, y + R * 0.2); g.moveTo(x - R, y - R * 0.3); g.lineTo(x + R, y - R * 0.3); g.moveTo(x - R * 0.85, y - R * 0.55); g.lineTo(x + R * 0.85, y - R * 0.05); g.moveTo(x, y + R * 0.2); g.lineTo(x - R * 0.5, y + R * 0.78); g.moveTo(x, y + R * 0.2); g.lineTo(x + R * 0.5, y + R * 0.78); g.moveTo(x, y + R * 0.2); g.lineTo(x - R * 0.2, y + R * 0.8); g.moveTo(x, y + R * 0.2); g.lineTo(x + R * 0.2, y + R * 0.8); g.stroke();
    for (const gx of [RW * 0.2, RW * 0.8]) { gear(g, gx, RH * 0.45, 60, 12); gear(g, gx + 90, RH * 0.6, 38, 9); }
    g.font = 'italic 34px Georgia, serif'; g.fillStyle = d.robe.accent;
    for (let k = 0; k < 5; k++) { g.save(); g.translate(RW * 0.05, RH * (0.22 + k * 0.1)); g.scale(-1, 1); g.fillText('saper vedere · del moto e del peso', -RW * 0.3, 0); g.restore(); }
    g.globalAlpha = 1;
  },
  doublet(g, d) {
    g.fillStyle = d.robe.accent;
    for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(RW / 2, RH * (0.2 + k * 0.065), 11, 0, TAU); g.fill(); }
    g.strokeStyle = shade(d.robe.base, 0.12); g.lineWidth = 6;
    for (let k = 0; k < 30; k++) { const x = (k + 0.5) * RW / 30; if (Math.abs(x - RW / 2) < 80) continue; g.beginPath(); g.moveTo(x, RH * 0.2); g.lineTo(x, RH * 0.5); g.stroke(); }
  },
  grid(g, d) {
    g.strokeStyle = 'rgba(233,227,212,0.35)'; g.lineWidth = 2;
    for (let x = 0; x < RW; x += 48) { g.beginPath(); g.moveTo(x, RH * 0.12); g.lineTo(x, RH * 0.84); g.stroke(); }
    for (let y = RH * 0.12; y < RH * 0.84; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(RW, y); g.stroke(); }
    const ox = RW / 2 + 96, oy = RH * 0.62;
    g.strokeStyle = d.robe.accent; g.lineWidth = 6;
    g.beginPath(); g.moveTo(ox - 260, oy); g.lineTo(ox + 260, oy); g.moveTo(ox, oy + 200); g.lineTo(ox, oy - 300); g.stroke();
    g.strokeStyle = '#e8a34a'; g.lineWidth = 7; g.beginPath();
    for (let t = -240; t <= 240; t += 6) g.lineTo(ox + t, oy - (t * t) / 220 + 120);
    g.stroke();
    g.fillStyle = d.robe.accent; g.font = 'italic 40px Georgia, serif'; g.fillText('x', ox + 268, oy + 12); g.fillText('y', ox + 10, oy - 300);
    g.font = 'italic 44px Georgia, serif'; g.fillText('cogito, ergo sum', RW * 0.08, RH * 0.3);
  },
  stars(g, d, r) {
    g.fillStyle = d.robe.accent;
    for (let i = 0; i < 90; i++) star(g, r() * RW, RH * (0.12 + 0.7 * r()), 4 + 10 * r() * r(), 5);
    g.strokeStyle = 'rgba(241,210,122,0.5)'; g.lineWidth = 3;
    g.beginPath(); const pts = [[0.58, 0.3], [0.64, 0.36], [0.7, 0.33], [0.76, 0.42], [0.72, 0.5]]; pts.forEach(([x, y], i) => (i ? g.lineTo(x * RW, y * RH) : g.moveTo(x * RW, y * RH))); g.stroke();
    buttons(g, d);
  },
  notes(g, d, r) {
    g.strokeStyle = d.robe.accent; g.lineWidth = 3;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(0, RH * 0.66 + k * 14); g.lineTo(RW, RH * 0.66 + k * 14); g.stroke(); }
    g.fillStyle = d.robe.accent;
    for (let x = 60; x < RW; x += 70 + 40 * r()) { const y = RH * 0.66 + Math.floor(r() * 6) * 7; g.beginPath(); g.ellipse(x, y, 11, 8, -0.4, 0, TAU); g.fill(); g.fillRect(x + 8, y - 54, 4, 54); if (r() < 0.4) g.fillRect(x + 8, y - 54, 26, 7); }
    for (let k = 0; k < 2; k++) { g.lineWidth = 6; g.beginPath(); for (let px = 0; px <= RW; px += 10) g.lineTo(px, RH * (0.16 + k * 0.62) + Math.sin(px * 0.05) * 10); g.stroke(); }
    buttons(g, d);
  },
  peaks(g, d) {
    g.fillStyle = 'rgba(240,230,204,0.85)';
    g.beginPath(); g.moveTo(0, RH * 0.8);
    const tops = [[0.05, 0.6], [0.14, 0.45], [0.25, 0.62], [0.36, 0.4], [0.46, 0.58], [0.55, 0.36], [0.66, 0.6], [0.78, 0.42], [0.9, 0.6], [1, 0.5]];
    for (const [x, y] of tops) g.lineTo(x * RW, y * RH);
    g.lineTo(RW, RH * 0.8); g.closePath(); g.fill();
    g.fillStyle = d.robe.base;
    for (const [x, y] of tops) { g.beginPath(); g.moveTo(x * RW - 40, y * RH + 60); g.lineTo(x * RW, y * RH + 18); g.lineTo(x * RW + 40, y * RH + 60); g.lineTo(x * RW, y * RH + 45); g.fill(); }
    g.fillStyle = '#e9b44c'; g.beginPath(); g.arc(RW * 0.42, RH * 0.28, 40, 0, TAU); g.fill();
    buttons(g, d);
  },
  atoms(g, d, r) {
    g.strokeStyle = d.robe.accent; g.lineWidth = 4; g.shadowColor = d.robe.accent; g.shadowBlur = 18;
    for (const [x, y, s] of [[RW * 0.62, RH * 0.45, 1], [RW * 0.3, RH * 0.62, 0.7], [RW * 0.85, RH * 0.66, 0.6], [RW * 0.1, RH * 0.35, 0.55]]) {
      for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x, y, 110 * s, 36 * s, k * Math.PI / 3, 0, TAU); g.stroke(); }
      g.fillStyle = d.robe.accent; g.beginPath(); g.arc(x, y, 12 * s, 0, TAU); g.fill();
    }
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(156,255,154,0.6)'; g.font = '40px Georgia, serif'; g.fillText('Po  Ra', RW * 0.15, RH * 0.78);
    void r;
  },
  lightning(g, d, r) {
    g.strokeStyle = d.robe.accent; g.shadowColor = d.robe.accent; g.shadowBlur = 16; g.lineWidth = 5;
    for (let k = 0; k < 7; k++) {
      let x = (k + 0.3) * RW / 7, y = RH * 0.15; g.beginPath(); g.moveTo(x, y);
      while (y < RH * 0.75) { x += (r() - 0.5) * 90; y += 30 + 40 * r(); g.lineTo(x, y); }
      g.stroke();
    }
    g.shadowBlur = 0; buttons(g, d);
  },
  swirls(g, d, r) {
    // a night sky laid on in short thick strokes: blue on blue, then yellow stars with halos
    for (let i = 0; i < 2600; i++) {
      const x = r() * RW, y = RH * (0.1 + 0.75 * r());
      const a = Math.sin(x * 0.006 + y * 0.004) * 2 + y * 0.004;
      g.strokeStyle = ['#3a64b8', '#1e3a7a', '#7fa8e0', '#2c4a8a', '#a8c8f0'][Math.floor(r() * 5)];
      g.lineWidth = 5 + 4 * r(); g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); g.stroke();
    }
    for (const [x, y, s] of [[0.4, 0.3, 46], [0.6, 0.5, 34], [0.8, 0.28, 40], [0.15, 0.55, 30], [0.95, 0.6, 26], [0.27, 0.22, 24]]) {
      for (let k = 6; k > 0; k--) { g.strokeStyle = k % 2 ? '#f1c84a' : '#f7e9a8'; g.lineWidth = 6; g.beginPath(); g.arc(x * RW, y * RH, s + k * 7, 0, TAU); g.stroke(); }
      g.fillStyle = '#fff1b0'; g.beginPath(); g.arc(x * RW, y * RH, s, 0, TAU); g.fill();
    }
  },
  charkha(g, d) {
    g.strokeStyle = d.robe.accent; g.lineWidth = 6;
    const x = RW / 2 - 60, y = RH * 0.55, R = 90;
    g.beginPath(); g.arc(x, y, R, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, y, 14, 0, TAU); g.stroke();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 8; g.beginPath(); g.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R); g.lineTo(x - Math.cos(a) * R, y - Math.sin(a) * R); g.stroke(); }
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 220, y - 30); g.stroke(); g.beginPath(); g.arc(x + 230, y - 30, 18, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(x - 120, y + R + 20); g.lineTo(x + 280, y + R + 20); g.stroke();
    // the khadi's woven border
    for (const [y0, col] of [[RH * 0.79, '#b5562c'], [RH * 0.81, '#2c6a3a'], [RH * 0.83, '#b5562c']]) { g.fillStyle = col; g.fillRect(0, y0, RW, 10); }
    // the shawl's drape over the left shoulder
    g.strokeStyle = 'rgba(140,120,80,0.25)'; g.lineWidth = 12;
    for (let k = 0; k < 10; k++) { g.beginPath(); g.moveTo(RW * 0.15 + k * 70, RH * 0.12); g.quadraticCurveTo(RW * 0.35 + k * 60, RH * 0.3, RW * 0.55 + k * 40, RH * 0.48); g.stroke(); }
  },
  punchcards(g, d, r) {
    g.fillStyle = 'rgba(240,230,200,0.9)';
    for (let k = 0; k < 7; k++) {
      const x = (k + 0.15) * RW / 7, y = RH * (0.4 + 0.12 * (k % 2));
      g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.2);
      g.fillStyle = '#f0e6c8'; g.fillRect(0, 0, 170, 90);
      g.fillStyle = d.robe.base;
      for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) if (r() < 0.45) { g.beginPath(); g.arc(14 + i * 18, 14 + j * 20, 5, 0, TAU); g.fill(); }
      g.restore();
    }
    g.strokeStyle = '#e9d27a'; g.lineWidth = 5; gear(g, RW * 0.5, RH * 0.24, 62, 14);
    for (let k = 0; k < 2; k++) { g.fillStyle = '#e8e1f4'; g.fillRect(0, RH * (0.76 + k * 0.03), RW, 8); }
  },
};
function star(g, x, y, R, n) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU - Math.PI / 2, rr = i % 2 ? R * 0.42 : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
function gear(g, x, y, R, teeth) {
  g.beginPath();
  for (let i = 0; i <= teeth * 4; i++) { const a = (i / (teeth * 4)) * TAU, rr = i % 4 < 2 ? R : R * 0.82; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.stroke(); g.beginPath(); g.arc(x, y, R * 0.3, 0, TAU); g.stroke();
}
function buttons(g, d) {
  g.fillStyle = d.robe.band;
  for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(RW / 2 + 54, RH * (0.36 + k * 0.07), 10, 0, TAU); g.fill(); }
}

function paintRobe(d) {
  const [c, g] = canvas(RW, RH);
  const r = rng(d.id + 'robe');
  const R = d.robe;
  g.fillStyle = R.base; g.fillRect(0, 0, RW, RH);
  // a little life in the lacquer: the paint is laid on by hand
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.02 + 0.03 * r()})`; g.beginPath(); g.ellipse(r() * RW, r() * RH * 0.9, 20 + 60 * r(), 6 + 12 * r(), 0, 0, TAU); g.fill(); }
  PATTERNS[R.pattern]?.(g, d, r);
  const coat = COATS.has(R.pattern);
  // the collar: two lapels crossing at the front, the left over the right
  g.lineCap = 'butt';
  if (!coat) {
    g.strokeStyle = R.collar; g.lineWidth = 46;
    g.beginPath(); g.moveTo(RW / 2 - 180, RH * 0.02); g.lineTo(RW / 2 + 40, RH * 0.42); g.stroke();
    g.beginPath(); g.moveTo(RW / 2 + 180, RH * 0.02); g.lineTo(RW / 2 - 40, RH * 0.42); g.stroke();
    g.fillStyle = R.band; g.fillRect(0, RH * 0.42, RW, RH * 0.07);
    g.fillStyle = shade(R.band, 0.1); g.fillRect(0, RH * 0.445, RW, RH * 0.012);
  } else {
    g.strokeStyle = R.collar; g.lineWidth = 34;
    g.beginPath(); g.moveTo(RW / 2 - 130, RH * 0.02); g.lineTo(RW / 2, RH * 0.2); g.lineTo(RW / 2 + 130, RH * 0.02); g.stroke();
    g.strokeStyle = shade(R.base, -0.08); g.lineWidth = 8;
    g.beginPath(); g.moveTo(RW / 2 + 30, RH * 0.2); g.lineTo(RW / 2 + 30, RH * 0.86); g.stroke();
  }
  // the hem
  g.fillStyle = R.band; g.fillRect(0, RH * 0.84, RW, RH * 0.04);
  // turned rings: the lathe's red and green, at the shoulder and the foot, and bare wood beneath
  const wood = (y0, y1) => {
    g.fillStyle = '#e6c49a'; g.fillRect(0, y0, RW, y1 - y0);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(150,95,45,${0.1 + 0.15 * r()})`; g.lineWidth = 2; const y = y0 + r() * (y1 - y0); g.beginPath(); g.moveTo(0, y); g.lineTo(RW, y + (r() - 0.5) * 6); g.stroke(); }
  };
  wood(RH * 0.88, RH);
  for (const [y, col, h] of [[0.9, '#c8312a', 0.014], [0.925, '#2f7a3e', 0.01], [0.95, '#c8312a', 0.008]]) { g.fillStyle = col; g.fillRect(0, RH * y, RW, RH * h); }
  for (const [y, col, h] of [[0.0, '#c8312a', 0.012], [0.02, '#2f7a3e', 0.008]]) { g.fillStyle = col; g.fillRect(0, RH * y, RW, RH * h); }
  return tex(c, { wrap: true, offset: 0.5 });
}

// --------------------------------------------------------------------------------------------------------------
// shapes
// --------------------------------------------------------------------------------------------------------------
function lacquer(map, { color = 0xffffff, rough = 0.42, coat = 0.6 } = {}) {
  return new THREE.MeshPhysicalMaterial({ map, color, roughness: rough, clearcoat: coat, clearcoatRoughness: 0.35 });
}
const matte = (color, rough = 0.75, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

/** Strands of hair on a texture, for beards and moustaches. */
function strandMap(color, seed) {
  const [c, g] = canvas(256, 256);
  const r = rng(seed);
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) { g.strokeStyle = r() < 0.5 ? shade(color, 0.12) : shade(color, -0.12); g.lineWidth = 1 + 2 * r(); const x = r() * 256; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 10, 80, x - 10, 170, x + (r() - 0.5) * 20, 256); g.stroke(); }
  return tex(c);
}

/** A tube along points with a thickness that tapers to its ends: moustaches, coils, a queue. */
function taperTube(points, radius, { segments = 40, radial = 10, ends = 0.25, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  const g = new THREE.TubeGeometry(curve, segments, 1, radial, closed);
  const pos = g.attributes.position, centre = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, centre);
    const k = closed ? 1 : ends + (1 - ends) * Math.pow(Math.sin(Math.PI * t), 0.6);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      const p = V(pos.getX(idx), pos.getY(idx), pos.getZ(idx)).sub(centre).multiplyScalar(radius * k).add(centre);
      pos.setXYZ(idx, p.x, p.y, p.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

function beard(d) {
  const b = d.beard;
  if (!b || b.style === 'none') return null;
  const map = strandMap(b.color, d.id + 'beard');
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.85, side: THREE.DoubleSide });
  if (b.style === 'goatee') {
    const g = new THREE.ConeGeometry(0.075, 0.28 * (b.length / 0.3), 16);
    g.rotateX(Math.PI);
    const m = new THREE.Mesh(g, mat);
    m.position.copy(onHead(0, -0.72, 1.0)).add(V(0, -0.1, 0.02));
    m.rotation.x = 0.35;
    return m;
  }
  // a shell over the jaw and cheeks, standing off the face, drawn down into a beard as long as the doll asks
  const thin = !!b.narrow;
  const thetaStart = thin ? 2.12 : 1.92, thetaLen = thin ? 0.85 : 1.0, phiLen = thin ? 1.1 : 2.5;
  const g = new THREE.SphereGeometry(HEAD.r * 1.02, 48, 24, Math.PI / 2 - phiLen / 2, phiLen, thetaStart, thetaLen);
  const pos = g.attributes.position;
  const L = b.length;
  for (let i = 0; i < pos.count; i++) {
    const p = V(pos.getX(i), pos.getY(i), pos.getZ(i));
    const n = p.clone().normalize();
    const theta = Math.acos(Math.max(-1, Math.min(1, p.y / (HEAD.r * 1.02))));
    const s = Math.max(0, (theta - thetaStart) / thetaLen); // 0 at the cheeks, 1 under the chin
    const side = Math.min(1, Math.abs(Math.atan2(p.x, p.z)) / (phiLen / 2)); // 0 at the front, 1 at the edge
    p.addScaledVector(n, 0.04 + 0.05 * s * (1 - side));
    // the lower part falls: down, a little forward, narrowing for a long beard
    // the cheeks stay put; under the chin it falls, toward the middle, and a little forward over the chest
    const fall = Math.pow(s, 1.5) * Math.pow(1 - side, 1.4);
    p.y -= L * fall;
    p.z += (0.06 + 0.12 * Math.min(1, L)) * fall;
    p.x *= 1 - (thin ? 0.8 : L > 0.7 ? 0.6 : 0.35) * Math.pow(s, 1.2);
    p.z -= 0.05 * side * s;
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.translate(0, HEAD.y, 0);
  g.computeVertexNormals();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(g, mat));
  if (b.style === 'curly') {
    // curls: small balls over the beard, packed close
    const r = rng(d.id + 'curls');
    const ball = new THREE.IcosahedronGeometry(1, 1);
    const parts = [];
    for (let i = 0; i < 46; i++) {
      const k = Math.floor(r() * pos.count);
      if (pos.getY(k) < HEAD.y - HEAD.r - b.length * 0.55) { i--; continue; }
      const q = V(pos.getX(k), pos.getY(k), pos.getZ(k));
      const s = 0.04 + 0.022 * r();
      parts.push(ball.clone().scale(s, s * 0.85, s).translate(q.x, q.y, q.z));
    }
    group.add(new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ map, roughness: 0.85 })));
  }
  return group;
}

function moustache(d) {
  const m = d.moustache;
  if (!m || m.style === 'none') return null;
  const spec = {
    full: { w: 0.4, e: -0.27, droop: 0.1, r: 0.04 }, droop: { w: 0.36, e: -0.28, droop: 0.42, r: 0.022 }, thin: { w: 0.24, e: -0.27, droop: 0.04, r: 0.016 },
    trim: { w: 0.24, e: -0.27, droop: 0.05, r: 0.028 }, walrus: { w: 0.46, e: -0.29, droop: 0.24, r: 0.068 },
  }[m.style];
  const mat = new THREE.MeshStandardMaterial({ map: strandMap(m.color, d.id + 'mo'), roughness: 0.85 });
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(onHead(side * (0.02 + spec.w * t), spec.e - spec.droop * t * t, 1.03 + spec.r * 0.6));
    }
    group.add(new THREE.Mesh(taperTube(pts, spec.r, { ends: 0.35 }), mat));
  }
  return group;
}

function hair3d(d) {
  const h = d.hair, group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: strandMap(h.color, d.id + 'hair'), roughness: 0.8, side: THREE.DoubleSide });
  const r = rng(d.id + 'hair3d');
  const ball = new THREE.IcosahedronGeometry(1, 1);
  const curls = (test, count, size) => {
    const parts = [];
    for (let tries = 0; parts.length < count && tries < count * 20; tries++) {
      const a = (r() * 2 - 1) * Math.PI, e = -0.5 + r() * 2.0;
      if (!test(a, e)) continue;
      const p = onHead(a, e, 1.0);
      const s = size * (0.8 + 0.5 * r());
      parts.push(ball.clone().scale(s, s, s).translate(p.x, p.y, p.z));
    }
    if (parts.length) group.add(new THREE.Mesh(mergeGeometries(parts), mat));
  };
  if (h.style === 'curly') curls((a, e) => e > hairline('curly', a) - 0.05, 150, 0.07);
  if (h.style === 'bald-sides') curls((a, e) => Math.abs(a) > 1.05 && e < 0.2 && e > -0.4, 70, 0.065);
  if (h.style === 'long') {
    // hair that falls behind and beside the face to the shoulders, in waves
    const g = new THREE.CylinderGeometry(HEAD.r * 1.03, 0.45, 0.62, 48, 10, true, 1.05, TAU - 2.1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(x, z);
      const k = 1 + 0.035 * Math.sin(a * 14 + y * 6) * (0.5 - y);
      pos.setXYZ(i, x * k, y, z * k);
    }
    g.computeVertexNormals();
    g.translate(0, HEAD.y - 0.31, 0);
    group.add(new THREE.Mesh(g, mat));
  }
  if (h.style === 'wig') {
    // two rolls each side, and the queue tied at the back
    const roll = new THREE.CapsuleGeometry(0.075, 0.26, 6, 14);
    roll.rotateX(Math.PI / 2);
    for (const side of [-1, 1]) for (const [dy, dz] of [[-0.02, -0.02], [-0.18, -0.05]]) {
      const m = new THREE.Mesh(roll, mat);
      m.position.set(side * HEAD.r * 0.98, HEAD.y + dy, dz);
      group.add(m);
    }
    const queue = new THREE.Mesh(taperTube([V(0, HEAD.y - 0.15, -HEAD.r * 0.92), V(0, HEAD.y - 0.42, -HEAD.r * 0.86), V(0, HEAD.y - 0.62, -0.36)], 0.06, { ends: 0.6 }), mat);
    group.add(queue);
    const bowMat = matte(d.queue ?? '#222222', 0.6);
    for (const side of [-1, 1]) {
      const bow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 10), bowMat);
      bow.scale.set(1.3, 0.7, 0.35);
      bow.position.set(side * 0.09, HEAD.y - 0.3, -HEAD.r * 0.93);
      bow.rotation.z = side * 0.4;
      group.add(bow);
    }
  }
  if (h.style === 'bun') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), mat);
    bun.position.copy(onHead(Math.PI, 0.72, 1.05));
    group.add(bun);
  }
  if (h.style === 'ringlets') {
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let i = 0; i <= 30; i++) { const t = i / 30; const a = t * TAU * 2.5; pts.push(V(side * (HEAD.r * 0.86 - k * 0.02) + Math.cos(a) * 0.035, HEAD.y - 0.02 - t * 0.38, -0.05 - k * 0.1 + Math.sin(a) * 0.035)); }
      group.add(new THREE.Mesh(taperTube(pts, 0.03, { ends: 0.6, segments: 80, radial: 8 }), mat));
    }
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), mat);
    bun.position.copy(onHead(Math.PI, 0.25, 1.05));
    group.add(bun);
  }
  return group;
}

function hat(d) {
  const group = new THREE.Group();
  const top = HEAD.y + HEAD.r;
  if (d.hat === 'scholar') {
    const black = matte('#151313', 0.5);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.24, 28), black);
    cap.position.set(0, top + 0.06, -0.06);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 28), matte('#2a2520', 0.6));
    band.position.set(0, top - 0.04, -0.06);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.6, 10), matte('#d8b54a', 0.3, { metalness: 0.8 }));
    pin.rotation.z = Math.PI / 2; pin.position.set(0, top + 0.07, -0.06);
    group.add(cap, band, pin);
  }
  if (d.hat === 'sikke') {
    const felt = matte('#b08758', 0.95);
    const g = new THREE.CylinderGeometry(0.27, 0.36, 0.95, 40, 4);
    const cone = new THREE.Mesh(g, felt);
    cone.position.set(0, top + 0.3, -0.03);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.27, 30, 12, 0, TAU, 0, Math.PI / 2), felt);
    crown.position.set(0, top + 0.775, -0.03);
    group.add(cone, crown);
    group.rotation.x = -0.06;
  }
  if (d.hat === 'laurel') {
    const leaf = new THREE.SphereGeometry(1, 10, 6);
    const parts = [];
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * TAU;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.18) continue; // the two branches meet over the brow
      const p = onHead(a, 0.42 + (i % 2) * 0.07, 1.05);
      parts.push(leaf.clone().scale(0.075, 0.03, 0.022).rotateZ(i % 2 ? 0.6 : -0.6).rotateY(a).translate(p.x, p.y, p.z));
    }
    group.add(new THREE.Mesh(mergeGeometries(parts), matte('#5f8a3a', 0.55)));
  }
  if (d.hat === 'beret') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.56, 40, 20), matte('#6b1f1c', 0.9));
    m.scale.set(1, 0.32, 1);
    m.position.set(0.03, top - 0.06, -0.04);
    m.rotation.z = -0.12;
    group.add(m);
  }
  if (d.hat === 'straw') {
    const [c, g] = canvas(512, 128);
    g.fillStyle = '#e4c068'; g.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 400; i++) { g.strokeStyle = Math.random() < 0.5 ? '#c9a24a' : '#f3dc92'; g.lineWidth = 2; const x = Math.random() * 512; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, 128); g.stroke(); }
    const straw = new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.9, side: THREE.DoubleSide });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.92, 0.035, 48), straw);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.3, 40), straw);
    crown.position.y = 0.16;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.07, 40), matte('#2c4a8a', 0.6));
    band.position.y = 0.05;
    group.add(brim, crown, band);
    group.position.set(0, top - 0.2, -0.02);
    group.rotation.set(-0.12, 0, 0.06);
  }
  return group;
}

function extras(d) {
  const group = new THREE.Group();
  if (d.glasses) {
    const metal = matte('#cfcac0', 0.25, { metalness: 0.9 });
    const lensGeo = new THREE.TorusGeometry(0.085, 0.009, 8, 32);
    for (const side of [-1, 1]) {
      const p = onHead(side * EYE_A, EYE_E, 1.07);
      const ring = new THREE.Mesh(lensGeo, metal);
      ring.position.copy(p);
      ring.lookAt(p.clone().multiplyScalar(2).sub(V(0, HEAD.y, 0)));
      group.add(ring);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 6), metal);
      const from = onHead(side * (EYE_A + 0.25), EYE_E + 0.02, 1.06), to = onHead(side * 1.45, EYE_E + 0.05, 1.03);
      arm.position.copy(from).lerp(to, 0.5);
      arm.lookAt(to); arm.rotateX(Math.PI / 2);
      arm.scale.y = from.distanceTo(to) / 0.4;
      group.add(arm);
    }
    const bridge = new THREE.Mesh(taperTube([onHead(-0.2, EYE_E + 0.03, 1.08), onHead(0, EYE_E + 0.06, 1.1), onHead(0.2, EYE_E + 0.03, 1.08)], 0.008, { ends: 1 }), metal);
    group.add(bridge);
  }
  if (d.ears) {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), lacquer(null, { color: d.skin, coat: 0.2 }));
      ear.scale.set(0.05, 0.13, 0.09);
      ear.position.copy(onHead(side * Math.PI / 2, -0.1, 1.0));
      group.add(ear);
    }
  }
  if (d.earring) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 20), matte('#d9b24a', 0.25, { metalness: 1 }));
    ring.position.copy(onHead(-1.5, -0.32, 1.02));
    ring.rotation.y = Math.PI / 2;
    group.add(ring);
  }
  if (d.collar === 'band') {
    const g = new THREE.CylinderGeometry(0.17, 0.35, 0.07, 40, 1, true, 0.5, TAU - 1.0);
    const m = new THREE.Mesh(g, matte(d.robe.collar, 0.6, { side: THREE.DoubleSide }));
    m.position.y = BODY_H - 0.015;
    group.add(m);
  }
  if (d.collar === 'jabot') {
    const lace = matte('#f7f4ee', 0.7);
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), lace);
      m.scale.set(0.12 - k * 0.014, 0.045, 0.055);
      m.position.set(0, BODY_H - 0.04 - k * 0.07, 0.34 - k * 0.012 + 0.04);
      m.rotation.x = -0.3;
      group.add(m);
    }
  }
  return group;
}

function prop(d) {
  const group = new THREE.Group();
  const at = (y, x = 0.08) => V(x, y, 0.4);
  if (d.prop === 'scroll') {
    const paper = matte('#e9dcb8', 0.8);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 20), paper);
    roll.rotation.z = Math.PI / 2 - 0.25; roll.position.copy(at(0.58, 0));
    const rods = [-1, 1].map((s) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 10), matte('#5a3a22', 0.5)); m.rotation.z = Math.PI / 2 - 0.25; m.position.copy(at(0.58, 0)).add(V(Math.cos(-0.25) * 0.29 * s, Math.sin(-0.25) * 0.29 * s, 0)); return m; });
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.01, 6, 20), matte('#b0302a', 0.6));
    tie.rotation.y = Math.PI / 2; tie.rotation.z = -0.25; tie.position.copy(at(0.58, 0));
    group.add(roll, ...rods, tie);
  }
  if (d.prop === 'quill') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.5, 8), matte('#efe6d0', 0.4));
    const vane = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), matte('#f5f1e8', 0.7, { side: THREE.DoubleSide }));
    vane.scale.set(0.055, 0.2, 0.008); vane.position.y = 0.06;
    const q = new THREE.Group(); q.add(shaft, vane);
    q.position.copy(at(0.66, 0.12)); q.rotation.z = -0.55; q.rotation.x = 0.15;
    group.add(q);
  }
  if (d.prop === 'vial') {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 24), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0.9, thickness: 0.05, transparent: true, opacity: 0.45 }));
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.14, 20), new THREE.MeshStandardMaterial({ color: '#7dff8a', emissive: '#5cff74', emissiveIntensity: 2.2 }));
    glow.position.y = -0.04;
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.05, 16), matte('#a87a4a', 0.9));
    cork.position.y = 0.14;
    const v = new THREE.Group(); v.add(glass, glow, cork); v.position.copy(at(0.55, 0.1)).add(V(0, 0, 0.04)); v.rotation.z = -0.15;
    group.add(v);
  }
  if (d.prop === 'coil') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.05, 24), matte('#2a2420', 0.5));
    const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push(V(Math.cos(t * TAU * 10) * 0.045, 0.03 + t * 0.26, Math.sin(t * TAU * 10) * 0.045)); }
    const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.007, 6), matte('#c9773a', 0.3, { metalness: 0.9 }));
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 12, 30), matte('#d8dde4', 0.2, { metalness: 1 }));
    torus.rotation.x = Math.PI / 2; torus.position.y = 0.33;
    const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 1), new THREE.MeshStandardMaterial({ color: '#cfe8ff', emissive: '#9fd8ff', emissiveIntensity: 3 }));
    spark.position.set(0.1, 0.36, 0);
    const t = new THREE.Group(); t.add(base, coil, torus, spark); t.position.copy(at(0.38, 0.12)).add(V(0, 0, 0.06));
    group.add(t);
  }
  if (d.prop === 'sunflower') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.75, 8), matte('#4f7a2e', 0.7));
    stem.position.y = -0.36;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 28), matte('#5a3a1e', 0.9));
    head.rotation.x = Math.PI / 2;
    const petal = new THREE.SphereGeometry(1, 10, 6);
    const parts = [];
    for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU; parts.push(petal.clone().scale(0.03, 0.09, 0.012).translate(0, 0.14, 0).rotateZ(a)); }
    const petals = new THREE.Mesh(mergeGeometries(parts), matte('#f1c22e', 0.6));
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), matte('#5d8a34', 0.7));
    leaf.scale.set(0.1, 0.04, 0.012); leaf.position.set(0.07, -0.42, 0); leaf.rotation.z = 0.5;
    const f = new THREE.Group(); f.add(stem, head, petals, leaf); f.position.copy(at(0.82, 0.15)).add(V(0, 0, 0.05)); f.rotation.set(0.15, 0, -0.25);
    group.add(f);
  }
  if (d.prop === 'staff') {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.7, 12), matte('#7a5532', 0.75));
    staff.position.set(0.5, 0.85, 0.12);
    group.add(staff);
  }
  return group;
}

/** The whole doll, standing on y = 0, facing +z. */
export function buildDoll(d) {
  const root = new THREE.Group();
  root.name = d.name;
  // the body, as turned: foot, waist, shoulder; texture laid on by height
  const profile = [[0, 0], [0.4, 0], [0.43, 0.025], [0.425, 0.07], [0.385, 0.11], [0.36, 0.3], [0.362, 0.6], [0.375, 0.9], [0.37, 1.02], [0.34, 1.09], [0.26, 1.135], [0.14, 1.155], [0, 1.16]].map(([x, y]) => new THREE.Vector2(x, y));
  const bodyGeo = new THREE.LatheGeometry(profile, 72);
  const uv = bodyGeo.attributes.uv, pos = bodyGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setY(i, pos.getY(i) / BODY_H);
  const body = new THREE.Mesh(bodyGeo, lacquer(paintRobe(d)));
  body.name = 'body';
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.12, 32), lacquer(null, { color: '#e2c49c', coat: 0.3 }));
  neck.position.y = BODY_H + 0.03;
  const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD.r, 72, 44), lacquer(paintHead(d), { rough: 0.38, coat: 0.5 }));
  head.position.y = HEAD.y;
  head.name = 'head';
  root.add(body, neck, head);
  for (const part of [hair3d(d), beard(d), moustache(d), hat(d), extras(d), prop(d)]) if (part) root.add(part);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}
