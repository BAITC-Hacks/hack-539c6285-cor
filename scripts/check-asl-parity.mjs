/**
 * Паритет ASL-дактильной модели: TF.js против эталона из python-экспорта.
 *
 *   node scripts/check-asl-parity.mjs
 *
 * Фикстура пишется ml/export_asl_tfjs.py: 4 псевдослучайные кисти и
 * вероятности, посчитанные исходной keras-моделью. Если tfjs-сборка
 * отдаёт другое — конвертация сломана, в прод такое не едет.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tf from '@tensorflow/tfjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'public/model/asl_dactyl');

// file:// для loadLayersModel в node: подсовываем простой io.IOHandler.
const modelJson = JSON.parse(fs.readFileSync(path.join(DIR, 'model.json'), 'utf8'));
const weightsBin = fs.readFileSync(path.join(DIR, 'group1-shard1of1.bin'));

const handler = {
  load: async () => ({
    modelTopology: modelJson.modelTopology,
    weightSpecs: modelJson.weightsManifest.flatMap((g) => g.weights),
    weightData: weightsBin.buffer.slice(
      weightsBin.byteOffset, weightsBin.byteOffset + weightsBin.byteLength),
  }),
};

const model = await tf.loadLayersModel(handler);
const fx = JSON.parse(fs.readFileSync(path.join(DIR, 'fixture.json'), 'utf8'));
const x = tf.tensor(fx.input, [fx.input.length, 63]).reshape([fx.input.length, 63, 1]);
const y = model.predict(x);
const got = await y.array();

let worst = 0;
for (let i = 0; i < got.length; i++) {
  for (let j = 0; j < got[i].length; j++) {
    worst = Math.max(worst, Math.abs(got[i][j] - fx.expected[i][j]));
  }
}
const labels = JSON.parse(fs.readFileSync(path.join(DIR, 'labels.json'), 'utf8'));
console.log(`классов: ${labels.length}, образцов: ${got.length}, max|diff| = ${worst.toExponential(2)}`);
if (worst > 1e-4) {
  console.log('ПРОВАЛ: tfjs-сборка расходится с python-эталоном');
  process.exit(1);
}
console.log('ок — tfjs-сборка совпадает с эталоном');
