# nimo WebUI

材料探索ライブラリ [NIMO](https://nims-da.github.io/nimo/en/index.html)（NIMS）を、ブラウザだけで使えるようにした Web アプリです。
候補表の CSV を開いて手法を選ぶと、「次に実験すると良い条件」を提案します。

- インストール不要。nimo は [Pyodide](https://pyodide.org/)（ブラウザ内の Python）で動き、**データは外部に送信されません**
- 列の役割（説明変数・目的変数・使わない）を見出しのクリックで指定。目的変数ごとに CSV を作り分ける必要はありません
- 「やりたいこと」から手法を選べ、各手法に図つきの解説があります
- 提案された条件にその場で結果を入力し、そのまま次のサイクルへ進めます
- 予測値・不確かさ・獲得関数の表示、散布図（相図・パレート図）での可視化
- 変数ごとの範囲・刻み（値の列挙、合計一定の組成も可）から、候補の組み合わせを網羅した表を作れます。CSV が無くても始められます
- 行・列の追加・削除（元に戻せる）、リセット
- 作業内容はブラウザに自動保存。Excel の CSV（Shift_JIS）もそのまま開けます

## 使い方

1. 候補表の CSV を開く（ドラッグ&ドロップ、または「📂 開く」）。CSV が無ければ「🧮 候補を生成」で作れます。まずは「🧪 サンプル」で試すのがおすすめです
2. 列の役割を確認する（見出しのチップをクリックで 説明変数 → 目的変数 → 使わない）。目的変数は「▲ 最大化 / ▼ 最小化」も切り替えられます
3. 右のパネルで「やりたいこと」→ 手法を選び、「✨ 提案を出す」（<kbd>Ctrl</kbd>+<kbd>Enter</kbd>）
4. 「提案」タブの条件で実験し、結果を入力 → もう一度「提案を出す」
5. 「💾 書き出し」（<kbd>Ctrl</kbd>+<kbd>S</kbd>）で候補表を、「⬇ 提案を CSV で保存」で提案だけを保存

画面右上の「❓ 使い方」に、入力ファイルの作り方・結果の見方・手法の選び方をまとめています。

### 候補表の形

| 温度_C | 時間_h | 濃度_M | 収率_% |
|---:|---:|---:|---:|
| 60 | 1 | 0.1 | 32.5 |
| 60 | 1 | 0.2 | |
| 60 | 2 | 0.1 | |

- 1 行 = 1 つの実験条件。試せる組み合わせを、未実験のものも含めて全部並べる
- 説明変数（実験条件）はすべて数値で埋める。目的変数（結果）は**未実験の行を空欄**にする
- 目的変数は複数列でもよい（多目的）。相図用には相の名前などのラベルでもよい

### 使える手法

| やりたいこと | 手法 |
|---|---|
| いちばん良い条件を探したい | PHYSBO（ベイズ最適化・既定）、NTS、BOMP、RSVM、SLESA |
| まず最初の実験点を決めたい | RE（ランダム）、DOE（実験計画法）、ES（上から順） |
| 狙った範囲に入る条件を探したい | PTR（目標範囲）、LSE（しきい値の境目） |
| 相図・分類の境界を描きたい | PDC（相図作成）、BALD |
| 物性の幅を広げたい | BLOX |
| 組成傾斜膜の実験を計画したい | COMBI |

LLMEP（Claude を使う手法）と、ロボット連携用の入出力機能（`preparation_input` / `analysis_output`）は対象外です。

## 開発

Node.js 20 以上（Vite 6 を使用）。

```bash
npm install
npm run dev          # http://localhost:5173/
npm run check        # 型チェック（svelte-check）
npm test             # 候補生成の単体テスト
npm run build        # dist/ に静的ファイルを出力（相対パスなのでどこに置いても動く）
```

目視確認・テスト（Playwright。初回は `npx playwright install chromium`）:

```bash
npm run smoke                                  # 開発サーバー上で全手法をサンプルに対して実行
npm run shot -- <url> <out.png> [待機ms] [幅x高さ] [--script=操作.mjs]   # スクリーンショット
```

`main` に push すると、GitHub Actions（`.github/workflows/deploy.yml`）で GitHub Pages に公開されます（Settings → Pages → Source を「GitHub Actions」に設定）。

### 構成

```
src/
  App.svelte                 画面の外枠（2 ペイン・D&D・ショートカット）
  lib/
    app.svelte.ts            アプリの状態と操作（読み込み・編集・実行・書き出し・自動保存）
    modules.ts               手法の定義（説明・パラメータ・前提条件・nimo 引数への変換）← 手法の追加はここ
    data/csv.ts              CSV の読み書き（文字コード判別）
    data/dataset.ts          候補表のモデル、列の役割の推測、実行前チェック、nimo 用 CSV の組み立て
    data/results.ts          nimo の出力（提案・予測）を元の表の行に対応づける
    data/generate.ts         候補の自動生成（範囲・列挙・組成の直積、既存の表との重複除去）
    nimo/                    Pyodide ワーカーと、画面側から使うエンジン
  python/runner.py           nimo.selection を 1 回実行して出力ファイルを回収する薄いラッパ
  components/                画面の部品（候補表 Handsontable、提案、グラフ Plotly、手法パネル、使い方）
public/
  wheels/                    同梱する Python wheel
  samples/                   サンプル（scripts/make_samples.py で生成。*.truth.csv は「仮想実験」用の真の値）
```

処理の流れ: 候補表（列の役割つき）→ `buildNimoCsv` で「説明変数 → 目的変数」の順に並べ替え、最小化したい列は符号反転 → ワーカーで `nimo.selection` → `parseRun` で提案・予測を元の行番号に対応づけ（符号も戻す）→ 画面に表示。

### 同梱 wheel の更新

physbo と odat-se は PyPI に sdist しかないため、純 Python の wheel をビルドして `public/wheels/` に置いています。
nimo の依存の anthropic（LLMEP 用）はブラウザで動かないので入れず、起動時に空モジュールで代用しています。

```bash
cd public/wheels
pip wheel --no-deps physbo==3.2.1 odat-se==4.0.1 -w .
pip download --no-deps nimo==2.1.8 pydoe3==1.6.2 -d .
```

版を変えたら `src/lib/nimo/protocol.ts` の `BUNDLED_WHEELS` も更新し、`npm run smoke` で全手法を確認してください。

## ライセンス・出典

- このリポジトリのコードは MIT ライセンスです（`LICENSE`）。同梱・利用しているライブラリはそれぞれのライセンスに従います
- 同梱している wheel は無改変で、各ライセンス文書は wheel 内に含まれています: [NIMO](https://github.com/NIMS-DA/nimo)（MIT）、[PHYSBO](https://github.com/issp-center-dev/PHYSBO)（MPL-2.0）、[ODAT-SE](https://github.com/issp-center-dev/ODAT-SE)（MPL-2.0）、[pyDOE3](https://github.com/relf/pyDOE3)（BSD-3-Clause）
- Python 本体と数値計算ライブラリは [Pyodide](https://pyodide.org/) の CDN から読み込みます
- 表のエディタに [Handsontable](https://handsontable.com/) を非商用ライセンス（`non-commercial-and-evaluation`）で使っています。商用目的で使う場合は Handsontable のライセンスが別途必要です
- グラフに [Plotly.js](https://plotly.com/javascript/)（MIT）
