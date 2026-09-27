/**
 * Rename bones in avatar.glb from Tripo AI auto-rig names
 * to standard humanoid bone names for sign language animation.
 *
 * Usage: node scripts/rename-bones.mjs
 */
import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GLB_PATH = resolve(__dirname, '../public/avatar.glb');
const BACKUP_PATH = GLB_PATH + '.bak';

// Bone rename mapping: oldName -> newName
// Determined by analyzing the GLB hierarchy and finger bone lengths
const RENAME_MAP = {
  // Right hand
  'R_ForearmTwist02':     'R_Hand',
  'R_ForearmTwist02.005': 'R_Thumb1',
  'R_ForearmTwist02.014': 'R_Thumb2',   // child of .005 (right side)
  'R_ForearmTwist02.001': 'R_Index1',
  'R_ForearmTwist02.012': 'R_Index2',
  'R_ForearmTwist02.013': 'R_Index3',
  'R_ForearmTwist02.002': 'R_Middle1',
  'R_ForearmTwist02.010': 'R_Middle2',
  'R_ForearmTwist02.011': 'R_Middle3',
  'R_ForearmTwist02.003': 'R_Ring1',
  'R_ForearmTwist02.008': 'R_Ring2',
  'R_ForearmTwist02.009': 'R_Ring3',
  'R_ForearmTwist02.004': 'R_Pinky1',
  'R_ForearmTwist02.006': 'R_Pinky2',
  'R_ForearmTwist02.007': 'R_Pinky3',

  // Left hand
  'L_ForearmTwist02':     'L_Hand',
  'L_ForearmTwist02.007': 'L_Thumb1',
  'L_ForearmTwist02.014': 'L_Thumb2',   // child of .007 (left side)
  'L_ForearmTwist02.001': 'L_Index1',
  'L_ForearmTwist02.003': 'L_Index2',
  'L_ForearmTwist02.011': 'L_Index3',
  'L_ForearmTwist02.002': 'L_Middle1',
  'L_ForearmTwist02.004': 'L_Middle2',
  'L_ForearmTwist02.012': 'L_Middle3',
  'L_ForearmTwist02.005': 'L_Ring1',
  'L_ForearmTwist02.006': 'L_Ring2',
  'L_ForearmTwist02.010': 'L_Ring3',
  'L_ForearmTwist02.008': 'L_Pinky1',
  'L_ForearmTwist02.009': 'L_Pinky2',
  'L_ForearmTwist02.013': 'L_Pinky3',
};

// --- Read GLB ---
const buf = readFileSync(GLB_PATH);

// GLB header: magic(4) + version(4) + totalLength(4)
const magic = buf.readUInt32LE(0);
if (magic !== 0x46546C67) { // 'glTF'
  throw new Error('Not a valid GLB file');
}

const version = buf.readUInt32LE(4);
console.log(`GLB version: ${version}`);

// Chunk 0 (JSON)
const jsonChunkLen = buf.readUInt32LE(12);
const jsonChunkType = buf.readUInt32LE(16);
if (jsonChunkType !== 0x4E4F534A) { // 'JSON'
  throw new Error('First chunk is not JSON');
}
const jsonStr = buf.slice(20, 20 + jsonChunkLen).toString('utf8').replace(/\0+$/, '');
const gltf = JSON.parse(jsonStr);

// --- Rename nodes ---
let renamedCount = 0;
// Handle the ambiguous case: both L and R have a bone named "*.014"
// We need to resolve by parent context
// First pass: build parent map
const parentMap = new Map(); // childIdx -> parentIdx
for (let i = 0; i < gltf.nodes.length; i++) {
  const node = gltf.nodes[i];
  if (node.children) {
    for (const childIdx of node.children) {
      parentMap.set(childIdx, i);
    }
  }
}

// For the ambiguous ".014" bones, determine side by walking up to find R_ or L_ prefix
function getSide(nodeIdx) {
  let idx = nodeIdx;
  while (idx !== undefined) {
    const name = gltf.nodes[idx].name || '';
    if (name.startsWith('R_')) return 'R';
    if (name.startsWith('L_')) return 'L';
    idx = parentMap.get(idx);
  }
  return null;
}

for (let i = 0; i < gltf.nodes.length; i++) {
  const node = gltf.nodes[i];
  const oldName = node.name;
  if (!oldName) continue;

  // Handle ambiguous names (e.g., both sides have ".014")
  if (RENAME_MAP[oldName]) {
    // Check if this name appears in both L and R mappings
    // For ".014" specifically, we need to disambiguate
    if (oldName === 'R_ForearmTwist02.014' || oldName === 'L_ForearmTwist02.014') {
      // These are already side-specific, just rename
      node.name = RENAME_MAP[oldName];
      console.log(`  ${oldName} -> ${node.name}`);
      renamedCount++;
    } else {
      node.name = RENAME_MAP[oldName];
      console.log(`  ${oldName} -> ${node.name}`);
      renamedCount++;
    }
  }
}

console.log(`\nRenamed ${renamedCount} bones`);

// --- Rebuild GLB ---
// Re-serialize JSON, pad to 4-byte alignment
let newJsonStr = JSON.stringify(gltf);
while (newJsonStr.length % 4 !== 0) newJsonStr += ' '; // pad with spaces (valid for JSON chunk)

const newJsonBuf = Buffer.from(newJsonStr, 'utf8');
const newJsonChunkLen = newJsonBuf.length;

// Binary chunk (chunk 1) - copy as-is
const binChunkOffset = 20 + jsonChunkLen;
const binChunkLen = buf.readUInt32LE(binChunkOffset);
const binChunkType = buf.readUInt32LE(binChunkOffset + 4);
const binData = buf.slice(binChunkOffset + 8, binChunkOffset + 8 + binChunkLen);

// Build new GLB
const totalLength = 12 + (8 + newJsonChunkLen) + (8 + binChunkLen);
const newBuf = Buffer.alloc(totalLength);

// Header
newBuf.writeUInt32LE(0x46546C67, 0);  // magic
newBuf.writeUInt32LE(version, 4);      // version
newBuf.writeUInt32LE(totalLength, 8);  // total length

// JSON chunk
newBuf.writeUInt32LE(newJsonChunkLen, 12);
newBuf.writeUInt32LE(0x4E4F534A, 16);  // 'JSON'
newJsonBuf.copy(newBuf, 20);

// Binary chunk
const binOffset = 20 + newJsonChunkLen;
newBuf.writeUInt32LE(binChunkLen, binOffset);
newBuf.writeUInt32LE(binChunkType, binOffset + 4);
binData.copy(newBuf, binOffset + 8);

// --- Save ---
copyFileSync(GLB_PATH, BACKUP_PATH);
console.log(`\nBackup saved to: ${BACKUP_PATH}`);

writeFileSync(GLB_PATH, newBuf);
console.log(`Updated GLB saved to: ${GLB_PATH}`);
console.log(`File size: ${newBuf.length} bytes`);

// --- Verify ---
console.log('\n=== Verification ===');
const verifyBuf = readFileSync(GLB_PATH);
const vJsonLen = verifyBuf.readUInt32LE(12);
const vJsonStr = verifyBuf.slice(20, 20 + vJsonLen).toString('utf8').replace(/\0+$/, '');
const vGltf = JSON.parse(vJsonStr);
const handBones = vGltf.nodes.filter(n =>
  n.name && (n.name.includes('Thumb') || n.name.includes('Index') ||
  n.name.includes('Middle') || n.name.includes('Ring') ||
  n.name.includes('Pinky') || n.name === 'R_Hand' || n.name === 'L_Hand')
);
console.log('Hand/finger bones found:');
handBones.forEach(b => console.log(`  ${b.name}`));
