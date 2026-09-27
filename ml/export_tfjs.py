"""Экспорт модели в TF.js через dual-build (обход бага tensorflow/tfjs#8266).

Путь: веса keras3 (npz по именам слоёв) -> идентичная топология на tf_keras ->
h5 -> tensorflowjs_converter (keras -> tfjs_layers_model).
Никогда не скармливаем конвертеру .keras-файлы напрямую.

Использование:
  python export_tfjs.py <weights.npz> <out_dir> [--fp16]
  python export_tfjs.py --smoke <out_dir>        # нетренированная модель + фикстуры
"""
import json
import os
import subprocess
import sys

import numpy as np

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")


def save_weights_npz(model, path):
    """Сохранить веса {имя_слоя/индекс: массив} — переносимо между Keras 2/3."""
    arrs = {}
    for layer in model.layers:
        ws = layer.get_weights()
        for i, w in enumerate(ws):
            arrs[f"{layer.name}/{i}"] = w
    np.savez(path, **arrs)
    return len(arrs)


def load_weights_npz(model, path):
    """Залить веса по именам; упасть, если что-то не сошлось или осталось."""
    data = dict(np.load(path))
    consumed = set()
    for layer in model.layers:
        n = len(layer.get_weights())
        if n == 0:
            continue
        ws = []
        for i in range(n):
            key = f"{layer.name}/{i}"
            if key not in data:
                raise KeyError(f"нет весов для {key}")
            ws.append(data[key])
            consumed.add(key)
        cur = layer.get_weights()
        for c, w in zip(cur, ws):
            if c.shape != w.shape:
                raise ValueError(f"{layer.name}: shape {c.shape} != {w.shape}")
        layer.set_weights(ws)
    leftover = set(data) - consumed
    if leftover:
        raise ValueError(f"неиспользованные веса: {sorted(leftover)[:5]}...")


def _patch_initializers(obj, count=None):
    if count is None:
        count = [0]
    if isinstance(obj, dict):
        for k, v in list(obj.items()):
            if k.endswith("initializer") and isinstance(v, dict) and \
               v.get("class_name") in ("Orthogonal", "OrthogonalV2",
                                       "GlorotUniform", "GlorotUniformV2"):
                obj[k] = {"class_name": "Zeros", "config": {}}
                count[0] += 1
            else:
                _patch_initializers(v, count)
    elif isinstance(obj, list):
        for it in obj:
            _patch_initializers(it, count)
    return count[0]


def export(weights_npz, out_dir, fp16=False):
    import tf_keras
    from model_def import build_model

    m2 = build_model(tf_keras)
    load_weights_npz(m2, weights_npz)
    h5_path = os.path.join(os.path.dirname(weights_npz) or ".", "model_tfkeras.h5")
    m2.save(h5_path)

    cmd = [
        os.path.join(os.path.dirname(sys.executable), "tensorflowjs_converter"),
        "--input_format=keras", "--output_format=tfjs_layers_model",
    ]
    if fp16:
        cmd += ["--quantize_float16", "*"]
    cmd += [h5_path, out_dir]
    subprocess.run(cmd, check=True)
    mj = json.load(open(os.path.join(out_dir, "model.json")))
    fmt = mj.get("format")
    assert fmt == "layers-model", fmt
    # Подменяем медленные инициализаторы на Zeros: tfjs строит модель ДО загрузки
    # весов, а Orthogonal для LSTM — это минуты QR-разложения в JS (фриз вкладки).
    n = _patch_initializers(mj["modelTopology"])
    json.dump(mj, open(os.path.join(out_dir, "model.json"), "w"))
    print(f"инициализаторы -> Zeros: {n}")
    print(f"OK: {out_dir} ({fmt}, fp16={fp16})")
    return m2


def smoke(out_dir):
    """Нетренированная модель через всю цепочку + фикстуры для Node-паритета."""
    import keras
    from model_def import build_model

    keras.utils.set_random_seed(42)
    m3 = build_model(keras)
    npz = os.path.join(os.path.dirname(__file__), "checkpoints", "smoke.weights.npz")
    os.makedirs(os.path.dirname(npz), exist_ok=True)
    n = save_weights_npz(m3, npz)
    print(f"веса сохранены: {n} массивов")

    # фикстуры: фиксированный вход -> выход keras3
    rng = np.random.default_rng(7)
    x = rng.normal(0, 1, (3, 60, 259)).astype(np.float32)
    y3 = m3.predict(x, verbose=0)
    export(npz, out_dir, fp16=False)

    # сверка tf_keras против keras3 в питоне
    import tf_keras
    from model_def import build_model as bm
    m2 = bm(tf_keras)
    load_weights_npz(m2, npz)
    y2 = m2.predict(x, verbose=0)
    diff = float(np.abs(y3 - y2).max())
    match = bool((y3.argmax(1) == y2.argmax(1)).all())
    print(f"keras3 vs tf_keras: max|dp|={diff:.2e}, top-1 match={match}")
    assert diff < 1e-4 and match, "расхождение сборок"

    np.save(os.path.join(out_dir, "fixture_x.npy"), x)
    np.save(os.path.join(out_dir, "fixture_y.npy"), y3)
    print("SMOKE PYTHON OK")


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    if sys.argv[1] == "--smoke":
        smoke(sys.argv[2])
    else:
        fp16 = "--fp16" in sys.argv
        export(sys.argv[1], sys.argv[2], fp16=fp16)
