"""サンプルデータ（public/samples/）を作る。

各サンプルは 2 ファイル:
  <name>.csv        … アプリで開く候補表（実験済みの数行だけ目的変数が入っている）
  <name>.truth.csv  … 全行の「真の値」。アプリの「仮想実験」ボタンが、提案された行にこの値を入れる
実行: python scripts/make_samples.py
"""
import csv
import json
import math
import random
from itertools import product
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "samples"
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(42)


def write(name, header, rows, truth, n_observed, title, description, module, goal):
    """rows: 説明変数の値, truth: 目的変数の真の値（行ごとのリスト）"""
    observed = set(rng.sample(range(len(rows)), n_observed))
    with open(OUT / f"{name}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        for i, (x, t) in enumerate(zip(rows, truth)):
            w.writerow(list(x) + (list(t) if i in observed else [""] * len(t)))
    with open(OUT / f"{name}.truth.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header[len(rows[0]):])
        w.writerows(truth)
    return {"file": f"{name}.csv", "truth": f"{name}.truth.csv", "title": title,
            "description": description, "module": module, "goal": goal, "rows": len(rows)}


def noise(s):
    return rng.gauss(0, s)


samples = []

# 1. 合成条件の最適化（単目的・最大化）: 収率が山型、最良は 1 か所
temps = [60, 70, 80, 90, 100, 110]
times = [1, 2, 4, 6, 8]
concs = [0.1, 0.2, 0.3, 0.4, 0.5]
rows, truth = [], []
for T, t, c in product(temps, times, concs):
    y = 80 * math.exp(-((T - 92) / 28) ** 2 - ((math.log(t) - math.log(4)) / 1.3) ** 2 - ((c - 0.32) / 0.22) ** 2) + 8
    rows.append((T, t, c))
    truth.append([round(y + noise(1.0), 1)])
samples.append(write("synthesis_yield", ["温度_C", "時間_h", "濃度_M", "収率_%"], rows, truth, 10,
                     "合成条件の最適化", "温度・時間・濃度の 150 通りから、収率が最大になる条件を探す（目的変数 1 つ）",
                     "PHYSBO", "optimize"))

# 2. 2 つの物性の両立（多目的）: 強度と導電率がトレードオフ
rows, truth = [], []
for a, b in product([i / 10 for i in range(11)], [i / 10 for i in range(11)]):
    strength = 200 + 300 * a - 120 * a * a + 60 * b + noise(5)
    cond = 50 + 80 * (1 - a) ** 1.5 + 40 * b * (1 - b) + noise(2)
    rows.append((a, b))
    truth.append([round(strength, 1), round(cond, 1)])
samples.append(write("two_properties", ["添加量A", "熱処理B", "強度_MPa", "導電率_%IACS"], rows, truth, 6,
                     "2 つの物性の両立（多目的）", "強度と導電率はトレードオフ。両方とも良い「パレート解」を探す（目的変数 2 つ）",
                     "PHYSBO", "optimize"))

# 3. 三元系の相図（分類）: 組成 A-B-C で 3 相
rows, truth = [], []
step = 0.05
n = round(1 / step)
for i in range(n + 1):
    for j in range(n + 1 - i):
        a, b = i * step, j * step
        c = 1 - a - b
        if a > 0.55:
            phase = "α"
        elif b > 0.5 or (b > 0.35 and c < 0.3):
            phase = "β"
        else:
            phase = "γ"
        rows.append((round(a, 2), round(b, 2), round(c, 2)))
        truth.append([phase])
samples.append(write("ternary_phase", ["A", "B", "C", "相"], rows, truth, 6,
                     "三元系の相図", "A-B-C の組成 231 点で、どの組成がどの相（α/β/γ）になるかの境界を描く（目的変数はラベル）",
                     "PDC", "classify"))

# 4. 組成傾斜膜（COMBI）: 百分率の整数
rows, truth = [], []
for i in range(0, 101, 5):
    for j in range(0, 101 - i, 5):
        k = 100 - i - j
        a, b, c = i / 100, j / 100, k / 100
        y = 3.0 * a * b + 1.2 * b * c + 0.5 * c + noise(0.02)
        rows.append((i, j, k))
        truth.append([round(y, 3)])
samples.append(write("combi_film", ["Pt", "Pd", "Ru", "活性"], rows, truth, 5,
                     "組成傾斜膜の設計", "Pt-Pd-Ru の組成（%）から、活性が高い領域へ 2 元素の傾斜膜を提案する",
                     "COMBI", "combi"))

with open(OUT / "index.json", "w", encoding="utf-8") as f:
    json.dump(samples, f, ensure_ascii=False, indent=2)
print("\n".join(f"{s['file']}: {s['rows']} rows" for s in samples))
