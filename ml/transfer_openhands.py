"""Кросс-языковой перенос: самообучённый энкодер OpenHands -> РЖЯ.

Что берём. OpenHands (AI4Bharat) выложили ST-GCN энкодер, предобученный
самообучением (Dense Predictive Coding) на позах жестовых языков. Он НЕ привязан
к разметке: классификатора в чекпойнте нет вообще, только ствол. Их статья
сообщает выигрыш 2..18 пунктов от такого переноса, и тем больше, чем меньше
размеченных данных. У нас 20 клипов на класс — предельный случай.

Чего НЕ берём. Их обученные классификаторы (AUTSL, WLASL, INCLUDE и прочие)
бесполезны: жестовые языки разные, значения знаков не совпадают. Переносится
представление движения, а не словарь.

Формат. OpenHands работает с 27 точками MediaPipe Holistic и ДВУМЯ координатами
(data_bn на 54 = 27x2), нормировка по плечам на весь клип. Наши сырые кадры —
тот же MediaPipe, поэтому 27 точек достаются индексами, без перекодирования.
Пресет mediapipe_holistic_minimal_27: нос, два глаза, два плеча, два локтя,
затем по 10 точек на кисть.

Честность. Оценка — тем же протоколом, что у своей модели: невиданные
подписанты официального теста, дубли С/с и Я/я слиты.

Запуск: ml/venv/bin/python ml/transfer_openhands.py [--epochs 40]
"""
import argparse
import importlib
import importlib.abc
import importlib.machinery
import json
import os
import sys
import time
import types

import numpy as np
import torch
import torch.nn as nn

ML = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ML)
EXT = os.path.join(ML, "external")
CKPT = os.path.join(ML, "checkpoints")
LMH = os.path.join(ML, "landmarks_holistic")

# openhands/datasets/pose_transforms.py, KEYPOINT_PRESETS
PRESET_27 = [0, 2, 5, 11, 12, 13, 14,
             33, 37, 38, 41, 42, 45, 46, 49, 50, 53,
             54, 58, 59, 62, 63, 66, 67, 70, 71, 74]
SHOULDERS = [3, 4]           # индексы плеч ВНУТРИ 27
INWARD = [[2, 0], [1, 0], [0, 3], [0, 4], [3, 5], [4, 6], [5, 7], [6, 17],
          [7, 8], [7, 9], [9, 10], [7, 11], [11, 12], [7, 13], [13, 14],
          [7, 15], [15, 16], [17, 18], [17, 19], [19, 20], [17, 21],
          [21, 22], [17, 23], [23, 24], [17, 25], [25, 26]]
T_LEN = 60


def _lightning_stub():
    """Чекпойнты сохранены PyTorch Lightning; сам фреймворк нам не нужен."""
    class _A:
        def __init__(self, *a, **k): pass

    class _M(types.ModuleType):
        __path__ = []
        def __getattr__(self, n):
            if n.startswith("__"):
                raise AttributeError(n)
            return _A

    class F(importlib.abc.MetaPathFinder, importlib.abc.Loader):
        def find_spec(self, name, path=None, target=None):
            if name.split(".")[0] == "pytorch_lightning":
                s = importlib.machinery.ModuleSpec(name, self)
                s.submodule_search_locations = []
                return s
        def create_module(self, spec): return _M(spec.name)
        def exec_module(self, m): pass

    sys.meta_path.insert(0, F())


def to_openhands(raw):
    """(60,255) сырых MediaPipe -> (2,60,27), нормировка по плечам на весь клип.

    Раскладка сырого кадра: pose 0:99 | face 99:129 | left 129:192 | right 192:255.
    Индексы пресета сквозные по [pose(33) | left_hand(21) | right_hand(21)],
    поэтому лицо, которого в пресете нет, просто пропускается.
    """
    out = np.zeros((T_LEN, 27, 2), dtype=np.float32)
    for j, k in enumerate(PRESET_27):
        if k < 33:
            off = k * 3
        elif k < 54:
            off = 129 + (k - 33) * 3
        else:
            off = 192 + (k - 54) * 3
        out[:, j, 0] = raw[:, off]
        out[:, j, 1] = raw[:, off + 1]

    p1, p2 = out[:, SHOULDERS[0]], out[:, SHOULDERS[1]]
    valid = (np.abs(out).sum((1, 2)) > 0)
    if valid.sum() == 0:
        return out.transpose(2, 0, 1)
    center = ((p1[valid] + p2[valid]) / 2).mean(0)
    dist = np.sqrt(((p1[valid] - p2[valid]) ** 2).sum(-1)).mean()
    scale = 1.0 / dist if dist > 1e-6 else 1.0
    out[valid] = (out[valid] - center) * scale
    return out.transpose(2, 0, 1)          # (C,T,V)


def build_encoder(pretrained=True):
    from omegaconf import OmegaConf
    G = os.path.join(EXT, "openhands_src", "openhands", "models", "encoder", "graph")
    pkg = types.ModuleType("ohg"); pkg.__path__ = [G]; sys.modules["ohg"] = pkg
    STGCN = importlib.import_module("ohg.st_gcn").STGCN
    ga = OmegaConf.create({"num_nodes": 27, "inward_edges": INWARD, "center": 0})
    enc = STGCN(in_channels=2, graph_args=ga, edge_importance_weighting=True,
                n_out_features=256)
    if pretrained:
        _lightning_stub()
        ck = os.path.join(EXT, "raw_dpc", "epoch=499-step=308499.ckpt")
        sd = torch.load(ck, map_location="cpu", weights_only=False)["state_dict"]
        enc_sd = {k[len("model.conv_encoder."):]: v for k, v in sd.items()
                  if k.startswith("model.conv_encoder.")}
        missing, unexpected = enc.load_state_dict(enc_sd, strict=False)
        assert not missing and not unexpected, (len(missing), len(unexpected))
        print(f"перенесено из DPC: {len(enc_sd)} тензоров, без остатка")
    return enc


class Recognizer(nn.Module):
    def __init__(self, num_classes, pretrained=True):
        super().__init__()
        self.enc = build_encoder(pretrained)
        self.head = nn.Sequential(nn.Dropout(0.3), nn.Linear(256, num_classes))

    def forward(self, x):
        return self.head(torch.relu(self.enc(x)))


def load_split(split, canon):
    idx = json.load(open(os.path.join(LMH, "file_index.json")))
    ids = sorted(k for k, v in idx.items() if v["split"] == split)
    X = np.empty((len(ids), 2, T_LEN, 27), dtype=np.float32)
    y = np.empty(len(ids), dtype=np.int64)
    users = []
    for i, k in enumerate(ids):
        raw = np.load(os.path.join(LMH, split, k + ".npy")).astype(np.float32)
        X[i] = to_openhands(raw)
        y[i] = canon.get(idx[k]["label"], idx[k]["label"])
        users.append(idx[k]["user"])
        if i % 3000 == 0:
            print(f"  {split} {i}/{len(ids)}", flush=True)
    return X, y, np.array(users)


def top15(logits, y):
    top1 = float((logits.argmax(1) == y).mean())
    top5 = float(np.mean([yy in row for yy, row in zip(y, np.argsort(logits, 1)[:, -5:])]))
    return top1, top5


def pick_device():
    """ST-GCN на CPU даёт ~13 с/шаг — прогон не влезает ни в какие сроки.
    Apple MPS ускоряет в 2.4 раза; при его отсутствии остаёмся на CPU."""
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


@torch.no_grad()
def infer(model, X, dev, bs=256):
    model.eval()
    out = []
    for i in range(0, len(X), bs):
        xb = torch.from_numpy(X[i:i + bs]).to(dev)
        out.append(model(xb).float().cpu().numpy())
    return np.concatenate(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--head-epochs", type=int, default=5)
    ap.add_argument("--scratch", action="store_true",
                    help="без переноса — контроль, сколько даёт именно предобучение")
    ap.add_argument("--smoke", action="store_true")
    args = ap.parse_args()

    from evaluate import twin_pairs
    lm = json.load(open(os.path.join(LMH, "label_map.json")))
    canon = {b: a for a, b in twin_pairs(lm)}
    K = len(lm)

    cache = os.path.join(CKPT, "openhands_feats.npz")
    if os.path.exists(cache):
        d = np.load(cache, allow_pickle=True)
        Xtr, ytr, utr, Xte, yte, ute = (d["Xtr"], d["ytr"], d["utr"],
                                        d["Xte"], d["yte"], d["ute"])
        print(f"кэш: train {Xtr.shape}, test {Xte.shape}")
    else:
        Xtr, ytr, utr = load_split("train", canon)
        Xte, yte, ute = load_split("test", canon)
        np.savez(cache, Xtr=Xtr, ytr=ytr, utr=utr, Xte=Xte, yte=yte, ute=ute)
        print(f"признаки сохранены -> {cache}")

    unseen = ~np.isin(ute, np.unique(utr))
    val_signers = set(json.load(open(os.path.join(ML, "eval_split.json")))["val_signers"])
    vm = np.isin(utr, sorted(val_signers))
    print(f"train {int((~vm).sum())} | val {int(vm.sum())} | "
          f"test невиданных {int(unseen.sum())}")

    if args.smoke:
        keep = np.nonzero(~vm)[0][:1024]
        Xt, yt = Xtr[keep], ytr[keep]
        args.epochs, args.head_epochs = 2, 1
    else:
        Xt, yt = Xtr[~vm], ytr[~vm]

    torch.manual_seed(42)
    dev = pick_device()
    model = Recognizer(K, pretrained=not args.scratch).to(dev)
    print(f"параметров: {sum(p.numel() for p in model.parameters()):,} | устройство: {dev}")

    def run(epochs, lr, only_head, tag):
        for p in model.enc.parameters():
            p.requires_grad = not only_head
        opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad],
                                lr=lr, weight_decay=1e-4)
        sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, epochs))
        lossf = nn.CrossEntropyLoss(label_smoothing=0.1)
        best = -1.0
        for ep in range(epochs):
            model.train()
            order = np.random.default_rng(42 + ep).permutation(len(Xt))
            tot, t0 = 0.0, time.time()
            for i in range(0, len(order), 64):
                b = order[i:i + 64]
                opt.zero_grad()
                out = model(torch.from_numpy(Xt[b]).to(dev))
                loss = lossf(out, torch.from_numpy(yt[b]).to(dev))
                loss.backward()
                nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                opt.step()
                tot += float(loss.detach()) * len(b)
            sched.step()
            v1, v5 = top15(infer(model, Xtr[vm], dev), ytr[vm])
            if v1 > best:
                best = v1
                torch.save(model.state_dict(), os.path.join(CKPT, "openhands_best.pt"))
            print(f"  [{tag}] эпоха {ep+1}/{epochs} loss {tot/len(order):.4f} "
                  f"val {v1:.4f}/{v5:.4f} best {best:.4f} ({time.time()-t0:.0f}с)",
                  flush=True)
        return best

    t0 = time.time()
    print(f"\n=== голова, {args.head_epochs} эпох ===", flush=True)
    run(args.head_epochs, 3e-3, True, "голова")
    print(f"\n=== весь энкодер, {args.epochs} эпох ===", flush=True)
    best = run(args.epochs, 5e-4, False, "полн")

    model.load_state_dict(torch.load(os.path.join(CKPT, "openhands_best.pt")))
    logits = infer(model, Xte[unseen], dev)
    t1, t5 = top15(logits, yte[unseen])
    rep = {"pretrained": not args.scratch, "num_classes": K,
           "n_unseen": int(unseen.sum()), "val_best_top1": best,
           "unseen_top1": t1, "unseen_top5": t5,
           "hours": round((time.time() - t0) / 3600, 2)}
    name = "openhands_scratch" if args.scratch else "openhands_transfer"
    json.dump(rep, open(os.path.join(CKPT, f"{name}_report.json"), "w"), indent=1)
    print(f"\nневиданные подписанты: top1={t1:.4f} top5={t5:.4f} (n={int(unseen.sum())})")
    print(f"своя модель для сравнения: top1=0.5854 top5=0.8729")


if __name__ == "__main__":
    main()
