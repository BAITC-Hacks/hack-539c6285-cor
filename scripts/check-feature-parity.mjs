// Паритет Python <-> TypeScript нормализации лэндмарков.
// Запуск: node scripts/check-feature-parity.mjs
// Требует: ml/fixtures/parity_fixtures.json (генерируется в ml/, см. features.py)
// и транспилированный src/lib/features.ts (делается автоматически через esbuild).
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesPath = join(root, 'ml', 'fixtures', 'parity_fixtures.json');
if (!existsSync(fixturesPath)) {
  console.error('нет фикстур:', fixturesPath);
  process.exit(2);
}

// транспиляция TS -> ESM во временный файл
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');
const outFile = join(root, 'node_modules', '.cache-features-parity.mjs');
execFileSync(esbuild, [
  join(root, 'src', 'lib', 'features.ts'),
  '--format=esm', `--outfile=${outFile}`,
]);
const { featurizeWindow, OUT_DIM } = await import(pathToFileURL(outFile).href);

const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
let worst = 0;
let failed = 0;
for (const fx of fixtures) {
  const frames = fx.raw.map((row) => Float32Array.from(row));
  const got = featurizeWindow(frames);
  const exp = fx.expected;
  let localWorst = 0;
  for (let t = 0; t < exp.length; t++) {
    for (let j = 0; j < OUT_DIM; j++) {
      const d = Math.abs(got[t * OUT_DIM + j] - exp[t][j]);
      if (d > localWorst) localWorst = d;
    }
  }
  worst = Math.max(worst, localWorst);
  const ok = localWorst < 1e-5;
  if (!ok) failed++;
  console.log(`${fx.id}: max|diff| ${localWorst.toExponential(2)} ${ok ? 'OK' : 'FAIL'}`);
}
console.log(`\nworst: ${worst.toExponential(2)} | ${fixtures.length - failed}/${fixtures.length} passed`);
process.exit(failed ? 1 : 0);
