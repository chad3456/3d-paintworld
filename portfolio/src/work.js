// The work, floating in a pastel sky: each project a printed card (its wordmark, its mark, its colours) hanging in the
// wind with petals going past. Scrolling brings each card forward in turn.
import * as THREE from 'three';
import * as P from '../../site/src/paint.js';
import { skyDome, clouds, windStreaks, swarm } from '../../site/src/scenes.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** A project card, painted: background, its mark, the name set large, the palette in swatches, small print. */
function card(p, i) {
  const w = 900, h = 1200;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = P.rng(31 + i * 7);
  const R = 46;
  g.beginPath(); g.roundRect(0, 0, w, h, R); g.clip();
  g.fillStyle = p.bg; g.fillRect(0, 0, w, h);
  // grain, like a riso print
  for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + 0.04 * r()})`; g.fillRect(r() * w, r() * h, 2, 2); }
  // the mark
  const cx = w * 0.5, cy = h * 0.4, m = w * 0.26;
  g.fillStyle = p.accent; g.strokeStyle = p.ink; g.lineWidth = 10;
  if (p.mark === 'leaf') {
    g.save(); g.translate(cx, cy); g.rotate(-0.5);
    g.beginPath(); g.ellipse(0, 0, m * 0.55, m, 0, 0, 6.283); g.fillStyle = p.extra; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, m); g.lineTo(0, -m * 0.9); g.stroke();
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(0, k * m * 0.22); g.lineTo(Math.sign(k || 1) * m * 0.4, k * m * 0.22 - m * 0.2); g.stroke(); }
    g.restore();
    g.beginPath(); g.arc(cx + m * 0.75, cy - m * 0.7, m * 0.22, 0, 6.283); g.fillStyle = p.accent; g.fill();
  } else if (p.mark === 'moon') {
    g.beginPath(); g.arc(cx, cy, m * 0.9, 0, 6.283); g.fillStyle = p.accent; g.fill();
    g.beginPath(); g.arc(cx + m * 0.4, cy - m * 0.2, m * 0.8, 0, 6.283); g.fillStyle = p.bg; g.fill();
    for (let k = 0; k < 30; k++) { g.fillStyle = p.ink; g.beginPath(); g.arc(r() * w, r() * h * 0.6, 1.5 + 2.5 * r(), 0, 6.283); g.fill(); }
    g.fillStyle = p.extra;
    g.beginPath(); g.ellipse(cx - m * 0.5, cy + m * 0.1, m * 0.28, m * 0.14, 0.6, 0, 6.283); g.ellipse(cx - m * 0.2, cy + m * 0.1, m * 0.28, m * 0.14, -0.6, 0, 6.283); g.fill();
  } else if (p.mark === 'blob') {
    g.beginPath();
    for (let a = 0; a <= 6.3; a += 0.05) { const rr = m * (0.85 + 0.15 * Math.sin(a * 5 + 1) + 0.08 * Math.sin(a * 3)); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; a ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.fillStyle = p.accent; g.fill();
    for (const [dx, col] of [[-0.45, p.extra], [0.1, p.ink], [0.5, p.extra]]) { g.fillStyle = col; g.beginPath(); g.ellipse(cx + dx * m, cy + m * 0.85, m * 0.12, m * 0.32, 0, 0, 6.283); g.fill(); }
    g.fillStyle = p.ink; g.beginPath(); g.arc(cx - m * 0.3, cy - m * 0.15, m * 0.1, 0, 6.283); g.arc(cx + m * 0.3, cy - m * 0.15, m * 0.1, 0, 6.283); g.fill();
  } else {
    for (let k = 0; k < 6; k++) { g.fillStyle = [p.accent, p.extra, p.ink][k % 3]; g.fillRect(w * 0.1, cy - m + k * m * 0.36, w * 0.8, m * 0.22); }
    g.fillStyle = p.bg; g.beginPath(); g.arc(cx, cy, m * 0.55, 0, 6.283); g.fill();
    g.fillStyle = p.accent; g.beginPath(); g.arc(cx - m * 0.18, cy, m * 0.12, 0, 6.283); g.arc(cx + m * 0.18, cy, m * 0.12, 0, 6.283); g.fill();
  }
  // the wordmark
  g.fillStyle = p.ink;
  g.textAlign = 'center';
  let size = 150;
  g.font = `${size}px "Young Serif", Georgia, serif`;
  while (g.measureText(p.name).width > w * 0.84) { size -= 6; g.font = `${size}px "Young Serif", Georgia, serif`; }
  g.fillText(p.name, w / 2, h * 0.76);
  g.font = `500 34px "JetBrains Mono", monospace`;
  g.fillText(p.kind, w / 2, h * 0.82);
  // palette swatches and small print
  [p.bg, p.ink, p.accent, p.extra].forEach((col, k) => { g.fillStyle = col; g.strokeStyle = p.ink; g.lineWidth = 3; g.beginPath(); g.roundRect(w * 0.1 + k * 74, h * 0.89, 58, 58, 14); g.fill(); g.stroke(); });
  g.fillStyle = p.ink; g.textAlign = 'right';
  g.font = `500 28px "JetBrains Mono", monospace`;
  g.fillText(`sample work · ${p.year}`, w * 0.9, h * 0.935);
  return P.texture(c);
}

export function workScene({ work, palette }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
  scene.add(skyDome([0.42, 0.36, 0.86], [1.0, 0.8, 0.82]));
  const cloudGroup = clouds(scene, { seed: 31, count: 18, ring: 130, low: -50, high: 30, scale: 1.1 });
  windStreaks(scene, { at: V(-10, 14, -130), size: 320, seed: 6 });
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0e8, 1.8);
  sun.position.set(3, 5, 8);
  scene.add(sun);

  const cards = work.map((p, i) => {
    const geo = new THREE.PlaneGeometry(3, 4, 20, 26);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) pos.setZ(k, -0.06 * pos.getX(k) * pos.getX(k));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: card(p, i), transparent: true, side: THREE.DoubleSide }));
    scene.add(m);
    return m;
  });
  const petals = palette.map((c, i) => P.texture(P.leaf({ w: 128, h: 192, shape: i % 2 ? 'peepal' : 'ashoka', colors: c, seed: 200 + i })));
  const flock = swarm(scene, { textures: petals, count: 170, centre: V(0, 0, -5), box: V(40, 26, 24), size: [0.22, 0.55], wind: V(-2.4, 0.8, 0.5), seed: 21 });
  const n = work.length;
  return {
    scene, camera, count: n,
    /** Which card is in front for a given progress. */
    active: (progress) => Math.min(n - 1, Math.max(0, Math.round(progress * (n - 1)))),
    update(time, progress, pointer) {
      // on a narrow screen the eye stands back so a whole card fits, with room under it for its caption
      const narrow = camera.aspect < 1;
      camera.position.set(pointer.x * 0.35, pointer.y * 0.25 - (narrow ? 1.6 : 0), narrow ? 10 / Math.max(0.42, camera.aspect * 1.25) : 10);
      camera.lookAt(0, narrow ? -1.6 : 0, 0);
      const k = progress * (n - 1);
      cards.forEach((m, i) => {
        const d = i - k, a = Math.abs(d);
        m.position.set(d * 3.9 + (narrow ? 0 : 1.3 * Math.min(1, camera.aspect / 1.4)), Math.sin(time * 0.8 + i) * 0.12 - a * 0.25, -a * 2.4);
        m.rotation.set(Math.sin(time * 0.6 + i * 2) * 0.05, -d * 0.45 + pointer.x * 0.12, d * 0.08 + Math.sin(time * 0.5 + i) * 0.03);
        m.material.opacity = Math.max(0, Math.min(1, 1 - (a - 1.25) / 0.6));
        m.visible = m.material.opacity > 0.01;
      });
      cloudGroup.rotation.y = time * 0.004 + progress * 0.3;
      flock.update(time, 1.4);
    },
  };
}
