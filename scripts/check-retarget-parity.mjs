// Паритет Python <-> TypeScript ретаргетинга лэндмарков в gesture JSON.
// Запуск: node scripts/check-retarget-parity.mjs
// Требует: ml/fixtures/retarget_fixtures.json (генерируется ml/make_retarget_fixtures.py)
// и транспилированный src/lib/retarget.ts (делается автоматически через esbuild).
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const TOL = 1e-4;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesPath = join(root, 'ml', 'fixtures', 'retarget_fixtures.json');
if (!existsSync(fixturesPath)) {
  console.error('нет фикстур:', fixturesPath);
  process.exit(2);
}

// транспиляция TS -> ESM во временный файл
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');
const outFile = join(root, 'node_modules', '.cache-retarget-parity.mjs');
execFileSync(esbuild, [
  join(root, 'src', 'lib', 'retarget.ts'),
  '--format=esm', `--outfile=${outFile}`,
]);
const { retargetSequence } = await import(pathToFileURL(outFile).href);

const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
let worst = 0;
let failed = 0;

for (const fx of fixtures) {
  const frames = fx.raw.map((row) => Float32Array.from(row));
  const problems = [];
  let localWorst = 0;
  const note = (msg) => { if (problems.length < 5) problems.push(msg); };

  let got;
  try {
    got = retargetSequence(frames, {
      name: fx.name,
      description: fx.expected.description,
      durationSec: fx.raw_len / 30, // питон: raw_len кадров при 30 fps
    });
  } catch (e) {
    console.log(`${fx.id}: бросил ${e.message} — FAIL`);
    failed++;
    continue;
  }
  const exp = fx.expected;

  // метаданные
  for (const k of ['name', 'fps_target', 'rotation_order', 'unit', 'description']) {
    if (got[k] !== exp[k]) note(`${k}: ${JSON.stringify(got[k])} != ${JSON.stringify(exp[k])}`);
  }
  if (got.frames.length !== exp.frames.length) {
    note(`кадров ${got.frames.length} != ${exp.frames.length}`);
  }

  const n = Math.min(got.frames.length, exp.frames.length);
  for (let i = 0; i < n; i++) {
    const gf = got.frames[i];
    const ef = exp.frames[i];
    const dt = Math.abs(gf.t - ef.t);
    if (dt > localWorst) localWorst = dt;
    if (dt > TOL) note(`кадр ${i}: t ${gf.t} != ${ef.t}`);

    const gk = Object.keys(gf.bones);
    const ek = Object.keys(ef.bones);
    if (gk.length !== ek.length) note(`кадр ${i}: костей ${gk.length} != ${ek.length}`);
    for (const b of ek) {
      const gv = gf.bones[b];
      if (!gv) { note(`кадр ${i}: нет кости ${b}`); continue; }
      const ev = ef.bones[b];
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(gv[c] - ev[c]);
        if (d > localWorst) localWorst = d;
        if (d > TOL) note(`кадр ${i} ${b}[${c}]: ${gv[c]} != ${ev[c]} (d=${d.toExponential(2)})`);
      }
    }
    for (const b of gk) if (!(b in ef.bones)) note(`кадр ${i}: лишняя кость ${b}`);
  }

  const bones = exp.frames.reduce((a, f) => a + Object.keys(f.bones).length, 0);
  const ok = problems.length === 0 && localWorst <= TOL;
  if (!ok) failed++;
  console.log(
    `${fx.id} [${fx.name}]: ${exp.frames.length} кадров, ${bones} значений костей, ` +
    `max|diff| ${localWorst.toExponential(2)} ${ok ? 'OK' : 'FAIL'}`,
  );
  for (const p of problems) console.log(`   ! ${p}`);
  worst = Math.max(worst, localWorst);
}

console.log(
  `\nworst: ${worst.toExponential(2)} (допуск ${TOL.toExponential(0)}) | ` +
  `${fixtures.length - failed}/${fixtures.length} passed — ${failed ? 'FAIL' : 'PASS'}`,
);
process.exit(failed ? 1 : 0);
