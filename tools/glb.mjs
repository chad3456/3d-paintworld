// A small reader and re-packer for .glb files, enough to cut one down to the parts a game uses.
import fs from 'node:fs';

export function readGlb(file) {
  const b = fs.readFileSync(file);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString());
  const binStart = 20 + jsonLen + 8;
  const bin = b.subarray(binStart, binStart + b.readUInt32LE(20 + jsonLen));
  return { json, bin };
}

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

/** The bytes of one accessor, tightly packed (a copy). */
export function accessorBytes({ json, bin }, index) {
  const a = json.accessors[index], view = json.bufferViews[a.bufferView];
  const size = COMPONENTS[a.type] * BYTES[a.componentType];
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = view.byteStride ?? size;
  const out = Buffer.alloc(a.count * size);
  for (let i = 0; i < a.count; i++) bin.copy(out, i * size, start + i * stride, start + i * stride + size);
  return out;
}

/**
 * Writes a .glb from `json` whose accessors are given as { ...accessor fields, data: Buffer }: each gets a buffer
 * view of its own, and equal data is stored once.
 */
export function writeGlb(file, json, accessors) {
  const chunks = [], views = [], seen = new Map();
  let offset = 0;
  json.accessors = accessors.map(({ data, target, ...rest }) => {
    const key = data.toString('base64') + (target ?? '');
    let view = seen.get(key);
    if (view === undefined) {
      const pad = (4 - (offset % 4)) % 4;
      if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
      view = views.length;
      views.push({ buffer: 0, byteOffset: offset, byteLength: data.length, ...(target ? { target } : {}) });
      chunks.push(data); offset += data.length;
      seen.set(key, view);
    }
    const { bufferView, byteOffset, sparse, ...keep } = rest;
    return { ...keep, bufferView: view };
  });
  json.bufferViews = views;
  const pad = (4 - (offset % 4)) % 4;
  if (pad) chunks.push(Buffer.alloc(pad));
  const bin = Buffer.concat(chunks);
  json.buffers = [{ byteLength: bin.length }];
  let text = Buffer.from(JSON.stringify(json));
  if (text.length % 4) text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), 0x20)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(text.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, jh, text, bh, bin]));
  return 12 + 8 + text.length + 8 + bin.length;
}
