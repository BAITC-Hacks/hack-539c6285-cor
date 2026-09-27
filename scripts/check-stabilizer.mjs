#!/usr/bin/env node
// Тесты стабилизатора лэндмарков: src/lib/landmarkStabilizer.test.ts → esbuild → node --test.
// Запуск: node scripts/check-stabilizer.mjs   (node ≥ 20; esbuild из node_modules)
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');
const out = join(mkdtempSync(join(tmpdir(), 'stab-')), 'stabilizer.test.mjs');
execFileSync(esbuild, [join(root, 'src/lib/landmarkStabilizer.test.ts'), '--bundle', '--platform=node', '--format=esm',
  '--external:node:*', `--outfile=${out}`], { stdio: 'inherit' });
execFileSync(process.execPath, ['--test', out], { stdio: 'inherit' });
