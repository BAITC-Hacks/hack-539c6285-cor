/** Вершины меша из GLB в bind-позе (мир), без three/GLTFLoader — для замеров в node. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './rig.mjs';

export function readMeshPositions(file, meshName) {
  const buf = fs.readFileSync(path.resolve(ROOT, file));
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const mesh = json.meshes.find((m) => m.name === meshName) ?? json.meshes[0];
  const out = [];
  for (const prim of mesh.primitives) {
    const acc = json.accessors[prim.attributes.POSITION];
    const view = json.bufferViews[acc.bufferView];
    const off = binStart + (view.byteOffset || 0) + (acc.byteOffset || 0);
    const stride = view.byteStride || 12;
    for (let i = 0; i < acc.count; i++) {
      const o = off + i * stride;
      out.push([buf.readFloatLE(o), buf.readFloatLE(o + 4), buf.readFloatLE(o + 8)]);
    }
  }
  return out;
}
