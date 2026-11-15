// Makes the two character files this game adds to Patch's starter man, from their public sources:
//
//   public/figure/epic-clips.glb   fighting, falling and demon clips from Quaternius' Universal Animation Library 2
//                                  (CC0), cut down to the clips named below. The library's rig has the starter man's
//                                  bone names and resting turns, so only joint turns are kept, with the hips' travel
//                                  scaled to his height: the same shape as the clips in starter-man-clips.glb.
//   public/figure/woman.glb        Patch's "Young woman with a braid in a knit sweater and a long skirt" (mpfb:human-0027,
//                                  a MakeHuman figure, CC0) with its pictures taken out, since the game paints her.
//
//   node tools/make-assets.mjs <UAL2_Standard.glb> <human-0027.glb>
// Sources: https://opengameart.org/content/universal-animation-library-2 (Unreal-Godot/UAL2_Standard.glb) and
// https://patch.gg/api/v1/assets/mpfb:human-0027 (sha256 b82effbc7778ab12246e3b92afd5d731c0218a820efbb15adf83ead1f3417e54).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlb, accessorBytes, writeGlb } from './glb.mjs';

const here = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const [ualFile, womanFile] = process.argv.slice(2);

const CLIPS = ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Melee_Hook', 'OverhandThrow', 'Hit_Knockback', 'LayToIdle',
  'Zombie_Idle_Loop', 'Zombie_Walk_Fwd_Loop', 'Zombie_Scratch', 'Sword_Block', 'Idle_FoldArms_Loop', 'Yes'];
const HIPS = 0.9829094448034329 / 0.916700005531311; // the starter man's hips over the library mannequin's

if (ualFile) {
  const src = readGlb(ualFile);
  const { json } = src;
  const accessors = [];
  const put = (index, scale = 1) => {
    const a = json.accessors[index];
    let data = accessorBytes(src, index);
    if (scale !== 1) { data = Buffer.from(data); for (let i = 0; i < data.length; i += 4) data.writeFloatLE(data.readFloatLE(i) * scale, i); }
    const { min, max, ...rest } = a;
    accessors.push({ ...rest, ...(a.type === 'SCALAR' ? { min, max } : {}), data });
    return accessors.length - 1;
  };
  const animations = [];
  for (const name of CLIPS) {
    const an = json.animations.find((a) => a.name === name);
    if (!an) throw new Error(`no clip ${name}`);
    const samplers = [], channels = [];
    for (const ch of an.channels) {
      const bone = json.nodes[ch.target.node].name, what = ch.target.path;
      const keep = what === 'rotation' || (what === 'translation' && (bone === 'pelvis' || bone === 'root'));
      if (!keep) continue;
      const s = an.samplers[ch.sampler];
      samplers.push({ input: put(s.input), output: put(s.output, what === 'translation' ? HIPS : 1), interpolation: s.interpolation ?? 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: ch.target });
    }
    animations.push({ name, samplers, channels });
  }
  // the nodes stay as they are (the clips name them), without the mannequin's mesh or skin
  const nodes = json.nodes.map(({ mesh, skin, ...n }) => n);
  const out = { asset: { version: '2.0', generator: 'ramayana-paintworld tools/make-assets.mjs', copyright: 'Quaternius, Universal Animation Library 2, CC0 1.0' }, scene: 0, scenes: json.scenes, nodes, animations };
  const bytes = writeGlb(path.join(here, 'public/figure/epic-clips.glb'), out, accessors);
  console.log(`epic-clips.glb: ${CLIPS.length} clips, ${(bytes / 1e6).toFixed(2)} MB`);
}

if (womanFile) {
  const src = readGlb(womanFile);
  const { json } = src;
  const accessors = [], map = new Map();
  const put = (index, target) => {
    if (index == null) return undefined;
    if (!map.has(index)) { accessors.push({ ...json.accessors[index], data: accessorBytes(src, index), target }); map.set(index, accessors.length - 1); }
    return map.get(index);
  };
  const meshes = json.meshes.map((m) => ({
    name: m.name,
    primitives: m.primitives.map((p) => {
      const attributes = {};
      for (const key of ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0']) if (p.attributes[key] != null) attributes[key] = put(p.attributes[key], 34962);
      return { attributes, indices: put(p.indices, 34963), material: p.material, mode: p.mode };
    }),
  }));
  const skins = json.skins.map((s) => ({ ...s, inverseBindMatrices: put(s.inverseBindMatrices) }));
  const materials = json.materials.map((m) => ({ name: m.name }));
  const out = { asset: { ...json.asset, generator: 'ramayana-paintworld tools/make-assets.mjs' }, scene: json.scene ?? 0, scenes: json.scenes, nodes: json.nodes, meshes, skins, materials };
  const bytes = writeGlb(path.join(here, 'public/figure/woman.glb'), out, accessors);
  console.log(`woman.glb: ${meshes.length} meshes, ${(bytes / 1e6).toFixed(2)} MB`);
}
