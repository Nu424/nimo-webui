# nimo WebUI

材料探索ライブラリ [NIMO](https://www.nims.go.jp/nimo/)（NIMS）を、ブラウザだけで使えるようにした Web アプリです。
候補表の CSV を開いて手法を選ぶと、「次に実験すると良い条件」を提案します。

公開版: https://nu424.github.io/nimo-webui/

## 主な機能

- インストール不要。nimo は [Pyodide](https://pyodide.org/)（ブラウザ内の Python）で動き、**データは外部に送信されません**
- 列の役割（説明変数・目的変数・使わない）は見出しのクリックで指定。目的変数ごとに CSV を作り分ける必要はありません
- 手法は「やりたいこと」から選べ、各手法に図つきの解説があります（14 手法）
- 提案は「次の実験」として並び、予測値 ± 不確かさを横棒で、これまでの最良値と比べて見られます。結果はその場で入力して、そのまま次のサイクルへ進めます
- 候補表に予測値・不確かさ・獲得関数を表示。散布図（相図・パレート図）で可視化
- 変数ごとの範囲・刻み（値の列挙、合計一定の組成、空欄も可）から、候補の組み合わせを網羅した表を作れます。CSV が無くても始められます
- 行・列の追加・削除（通知から元に戻せる）、リセット（既定では書き出してから）
- 作業内容はブラウザに自動保存。Excel の CSV（Shift_JIS）もそのまま開けます

## 使い方

画面は、左に表（候補表・提案・グラフのタブ）、右に手法・設定・実行ボタン、上にファイル名のメニューという配置です。

1. **候補表を開く**: 最初の画面に CSV をドラッグ&ドロップするか、クリックして選びます。CSV が無ければ「条件の範囲から新しい候補表を作る」で作れます。まずは「サンプルで試す」がおすすめです
2. **列の役割を確かめる**: 見出しのチップをクリックすると 説明変数 → 目的変数 → 使わない と切り替わります。目的変数の「▲ 最大 / ▼ 最小」も見出し（または右の「良い方向」）で切り替えられます
3. **提案を出す**: 右のパネルで手法（「変更」から、やりたいこと → 手法を選ぶ）と設定を確かめ、「提案を出す」（<kbd>Ctrl</kbd>+<kbd>Enter</kbd>）
4. **実験して結果を入れる**: 「提案」タブの条件で実験し、結果の欄に入力します（候補表の同じ行に書き込まれます）。もう一度「提案を出す」で次のサイクルへ
5. **保存する**: ファイル名のメニューの「書き出し」（<kbd>Ctrl</kbd>+<kbd>S</kbd>）で候補表を、提案タブの「CSV で保存」で提案の行だけを保存します

- 表を開いた後のファイルの操作（別の CSV を開く・新しい候補表・サンプル・書き出し・リセット）は、上のファイル名をクリックしたメニューにあります
- 候補を足したいときは表の上の「候補を生成」、1 行ずつ足すときは表の下の「行を追加」。行・列の削除や列の追加・列名の変更は表の右クリックで
- リセットは既定で表を書き出してから行います。書き出さずに消したいときは、ボタン右端の ▼ から「保存せずにリセット」

画面右上の「使い方」に、入力ファイルの作り方・結果の見方・手法の選び方・よくある質問をまとめています。

### 候補表の形

| 温度_C | 時間_h | 濃度_M | 収率_% |
|---:|---:|---:|---:|
| 60 | 1 | 0.1 | 32.5 |
| 60 | 1 | 0.2 | |
| 60 | 2 | 0.1 | |

- 1 行 = 1 つの実験条件。試せる組み合わせを、未実験のものも含めて全部並べる
- 説明変数（実験条件）はすべて数値で埋める。目的変数（結果）は**未実験の行を空欄**にする
- 目的変数は複数列でもよい（多目的）。相図用には相の名前などのラベルでもよい
- メモや試料番号などの列は「使わない」にすれば、表に残したまま計算から外せます

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

Node.js 20 以上（Vite 6 を使用。Vite 7 以降は Node 20.19 以上が必要なため据え置き）。

```bash
npm install
npm run dev          # http://127.0.0.1:5199/
npm run check        # 型チェック（svelte-check）
npm test             # 候補生成の単体テスト
npm run build        # dist/ に静的ファイルを出力（相対パスなのでどこに置いても動く）
```

目視確認・テスト（Playwright。初回は `npx playwright install chromium`。開発サーバーを起動したまま別のシェルで）:

```bash
npm run smoke                                  # 全 14 手法 × 設定パターン 27 件を、サンプルに対して実際に実行
npm run shot -- <url> <out.png> [待機ms] [幅x高さ] [--script=操作.mjs]   # スクリーンショット
```

`main` に push すると、GitHub Actions（`.github/workflows/deploy.yml`）で GitHub Pages に公開されます（Settings → Pages → Source を「GitHub Actions」に設定）。

### 構成

```
src/
  App.svelte                 画面の外枠（2 ペイン・どこでも D&D・ショートカット・各ダイアログ）
  app.css                    色・ボタンなどの共通スタイル（色の意味は全体で共通）
  lib/
    app.svelte.ts            アプリの状態と操作（読み込み・編集・行列操作・元に戻す・実行・書き出し・リセット・自動保存）
    modules.ts               手法の定義（説明・図・パラメータ・前提条件・nimo 引数への変換）← 手法の追加はここ
    data/csv.ts              CSV の読み書き（UTF-8 / Shift_JIS の判別、BOM 付きで書き出し）
    data/dataset.ts          候補表のモデル、列の役割の推測、実行前チェック、nimo 用 CSV の組み立て
    data/results.ts          nimo の出力（提案・予測）を元の表の行に対応づける
    data/generate.ts         候補の自動生成（範囲・列挙・組成・空欄の直積、既存の表との重複除去）
    nimo/                    Pyodide ワーカーと、画面側から使うエンジン
  python/runner.py           nimo.selection を 1 回実行して出力ファイルを回収する薄いラッパ
  components/                画面の部品（候補表 Handsontable、提案、グラフ Plotly、右パネル、手法を選ぶダイアログ、
                             候補の生成、使い方、確認ダイアログ、通知、線画アイコン）
public/
  wheels/                    同梱する Python wheel
  samples/                   サンプル（scripts/make_samples.py で生成。*.truth.csv は「仮想実験」用の真の値）
scripts/                     shot.mjs（スクリーンショット）、smoke.mjs（全手法の実行）、make_samples.py
tests/                       候補生成の単体テスト
```

処理の流れ: 候補表（列の役割・最大化/最小化つき）→ 実行前チェック → `buildNimoCsv` で「説明変数 → 目的変数」の順に並べ替え（「使わない」列と説明変数が空の行は除く。最小化したい列は符号反転）→ ワーカーで `nimo.selection` → `parseRun` で提案・予測を元の行番号に対応づけ（符号も戻す）→ 画面に表示。

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
