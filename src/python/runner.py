"""nimo を Pyodide 上で 1 回実行するための薄いラッパ。

何を: CSV 文字列と設定を受け取り、nimo.selection を実行して、生成されたファイルを
      すべて文字列で返す。
なぜ: nimo はファイルパスで入出力し、カレントディレクトリに output_res.csv 等を
      書く設計なので、ブラウザ側からはファイルを意識せずに扱えるようにしたい。
方針: 実行ごとに空の作業ディレクトリを作って chdir し、終わったら中身を回収する。
      SLESA のように実行をまたいで状態ファイルを持ち回るモジュールのために、
      前回の状態ファイルを受け取って作業ディレクトリに復元できるようにする。
"""
import contextlib
import io
import json
import os
import shutil
import sys
import traceback
import types
import warnings

WORKDIR = "/tmp/nimo_run"
INPUT_NAME = "candidates.csv"
OUTPUT_NAME = "proposals.csv"


def setup():
    """nimo を import できる状態にし、バージョン情報を返す（起動時に 1 回呼ぶ）。"""
    # 画面のないワーカーで動かすので、matplotlib は描画先なしのバックエンドにする
    os.environ["MPLBACKEND"] = "Agg"
    # nimo/__init__.py が LLMEP 経由で anthropic を import する。
    # LLMEP は使わないので空モジュールで代用する
    sys.modules.setdefault("anthropic", types.ModuleType("anthropic"))
    import nimo  # noqa: F401
    import numpy
    import physbo
    from importlib.metadata import version

    return json.dumps(
        {
            "python": sys.version.split()[0],
            "nimo": version("nimo"),
            "physbo": getattr(physbo, "__version__", version("physbo")),
            "numpy": numpy.__version__,
        }
    )


def run(request_json):
    """nimo.selection を 1 回実行する。

    request_json: {method, csv, num_objectives, num_proposals, options, state_files, seed}
    戻り値（JSON 文字列）: {ok, error, log, files}
    """
    import nimo
    import numpy as np
    import random

    req = json.loads(request_json)
    shutil.rmtree(WORKDIR, ignore_errors=True)
    os.makedirs(WORKDIR)
    prev = os.getcwd()
    os.chdir(WORKDIR)

    log = io.StringIO()
    ok, error = True, None
    try:
        with open(INPUT_NAME, "w", newline="", encoding="utf-8") as f:
            f.write(req["csv"])
        for name, text in (req.get("state_files") or {}).items():
            with open(name, "w", newline="", encoding="utf-8") as f:
                f.write(text)

        # 乱数を使うモジュールの結果を再現できるように、指定があれば種を固定する
        seed = req.get("seed")
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)

        with contextlib.redirect_stdout(log), contextlib.redirect_stderr(log), warnings.catch_warnings():
            warnings.simplefilter("always")
            # 警告もログに流す（OptimizeWarning など、利用者には無害なものが多い）
            warnings.showwarning = lambda m, c, *_a, **_k: log.write(f"[warning] {c.__name__}: {m}\n")
            nimo.selection(
                method=req["method"],
                input_file=INPUT_NAME,
                output_file=OUTPUT_NAME,
                num_objectives=req["num_objectives"],
                num_proposals=req["num_proposals"],
                **(req.get("options") or {}),
            )
    except SystemExit:
        # nimo はいくつかの失敗（COMBI の組成が広げられない等）で sys.exit() を呼ぶ。
        # 理由はログに print されているので、ログ末尾をエラーとして返す
        ok = False
        error = "nimo が処理を中断しました。\n" + "\n".join(log.getvalue().strip().splitlines()[-3:])
    except BaseException as e:  # noqa: BLE001 - 利用者に見せるため全て捕まえる
        ok = False
        error = f"{type(e).__name__}: {e}\n\n" + traceback.format_exc(limit=4)
    finally:
        files = {}
        for name in os.listdir(WORKDIR):
            if name == INPUT_NAME:
                continue
            with open(name, encoding="utf-8", errors="replace") as f:
                files[name] = f.read()
        os.chdir(prev)

    if ok and OUTPUT_NAME not in files:
        ok = False
        error = "提案ファイルが作られませんでした。\n" + "\n".join(log.getvalue().strip().splitlines()[-3:])
    return json.dumps({"ok": ok, "error": error, "log": log.getvalue(), "files": files})
