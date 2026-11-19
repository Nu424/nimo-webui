# CLAUDE.md — nimo-webui

材料探索ライブラリ NIMO（`nimo.selection`）を、ブラウザだけで使えるようにした Web アプリ。
nimo は Pyodide（ブラウザ内の Python）で Web Worker 上で動かし、データはブラウザの外に出さない。

- 公開: https://nu424.github.io/nimo-webui/（`main` に push すると GitHub Actions が自動でビルド・配備）
- リポジトリ: GitHub `Nu424/nimo-webui`（private。ただし Pages のサイト自体は URL を知っていれば誰でも見られる）
- 使い方は README.md と画面内の「使い方」（`HelpDialog.svelte`）、経緯・決定・レビュー結果は PLAN.md（作業書。時系列に追記してきた履歴で、冒頭に目次）

## 作業の始め方

```bash
npm install
npx playwright install chromium   # 初回のみ（目視確認・スモークテスト用）
npm run dev                        # http://127.0.0.1:5199/
```

変更したら、規模に応じて次で確認する（いずれも開発サーバーを起動したまま別のシェルで）。

| コマンド | 内容 | 目安 |
|---|---|---|
| `npm run check` | 型チェック（svelte-check）。0 件を保つ | 毎回 |
| `npm test` | 候補生成（`src/lib/data/generate.ts`）の単体テスト | 生成まわりを触ったら |
| `npm run smoke` | 全 14 手法 × 設定パターン 26 件を、画面の状態経由で実際に nimo 実行 | nimo 呼び出し・データの組み立て・結果の対応づけを触ったら |
| `npm run shot -- <url> <out.png> [待機ms] [幅x高さ] [--script=操作.mjs]` | スクリーンショット。`--script` で操作してから撮る | 見た目を変えたら必ず |
| `npm run build` | 本番ビルド（`dist/`、相対パス） | push 前 |

- `smoke` と自動操作は、開発時だけ `globalThis.__app`（アプリの状態）が公開されていることを利用している（`src/lib/app.svelte.ts` 末尾）。
- 見た目の確認は Playwright（ヘッドレス Chromium）で行う。Claude in Chrome はこの環境から 127.0.0.1 を開けなかった。
- Handsontable は見出しを二重に描画する。操作で見出しを掴むときは `.ht_clone_top .colh ...` を指定する。

### 利用者とのやり取り

利用者が公開版を触って UX のフィードバックを出し、こちらが計画（PLAN.md に追記）→ 承認 → 実装・確認 → push、という流れで改善している。

- 計画段階は選択肢と推奨を出し、決定は利用者がする。
- 実装後はスクリーンショットで目視し、上の確認を通してから push する。
- push 前には、追加分に機密情報（個人のパス、`try-nimo` の実データやファイル名、鍵）が無いかを grep で確認する。
- コミットは日本語＋プレフィックス（`feat:` `fix:` `docs:` `chore:`）。開発方針は利用者の指南書（リポジトリ外）に従う: 規模に応じた手順、計画段階は選択肢と推奨、見た目はスクリーンショットで確認、レビューは文脈を持たない目で must/should/could、文書は最後にまとめて更新。

## 構成

```
src/
  App.svelte                 外枠（2 ペイン・どこでも D&D・Ctrl+Enter 実行・Ctrl+S 書き出し・各ダイアログ）
  lib/
    app.svelte.ts            アプリの状態と操作のすべて（読み込み・編集・行列操作・元に戻す・実行・書き出し・リセット・自動保存）
    modules.ts               手法の定義（説明・図・パラメータ・前提条件・nimo 引数への変換）← 手法の追加・変更はここ
    data/csv.ts              CSV の読み書き（UTF-8/Shift_JIS 自動判別、BOM 付きで書き出し）
    data/dataset.ts          候補表のモデル、列の役割の推測、実行前チェック、nimo 用 CSV の組み立て
    data/results.ts          nimo の出力（提案・予測）を元の表の行に対応づける
    data/generate.ts         候補の自動生成（範囲・列挙・組成・空欄の直積、既存表との重複除去）。純粋関数
    nimo/protocol.ts         画面⇔ワーカーのメッセージ型、Pyodide の版、同梱 wheel の一覧
    nimo/nimo.worker.ts      Pyodide を起動し nimo を入れて実行するワーカー
    nimo/engine.svelte.ts    画面側のエンジン（起動・状態・実行・中断＝ワーカー作り直し）
  python/runner.py           nimo.selection を 1 回実行し、生成ファイルを回収して返す
  components/                画面の部品（CandidateGrid=Handsontable、ProposalsView、ChartView=Plotly、SidePanel、
                             MethodDialog（手法を選ぶ）、ParamForm、GeneratorDialog、HelpDialog、ConfirmDialog、
                             Toasts、Icon（線画アイコン）ほか）
public/wheels/               同梱 wheel（nimo 2.1.8、physbo 3.2.1、odat-se 4.0.1、pyDOE3 1.6.2）
public/samples/              サンプル（scripts/make_samples.py で生成。*.truth.csv は「仮想実験」用の真の値）
scripts/                     shot.mjs（スクショ）、smoke.mjs（全手法の実行）、make_samples.py
tests/generate.test.mjs      生成の単体テスト（esbuild で .tmp/ に変換して実行）
```

### 中心の処理の流れ

1. 候補表 `Dataset`（元の列順のまま、列ごとに役割 `x`/`y`/`ignore` と方向 `max`/`min` を持つ）
2. `checkReady`（dataset.ts）＋手法ごとの `validate`（modules.ts）＋ app 側のチェック → エラーがあれば実行不可、`fix` があればボタンで手法を切替
3. `buildNimoCsv`: 説明変数 → 目的変数の順に並べ替え、「使わない」列を落とす。説明変数がすべて空の行は渡さない（`included` で元の行番号を保持）。一部の目的変数しか無い行は目的変数をすべて空欄にそろえる。最小化したい列は符号反転
4. ワーカーで `runner.run`（作業ディレクトリに CSV と前回の状態ファイルを置いて `nimo.selection`）
5. `parseRun`: 提案の `actions` と `output_res.csv` を `included` 経由で元の行番号に戻し、反転した予測の符号を戻す
6. 表示: 候補表（★順位・予測列）、提案タブ（結果をその場で入力）、グラフ

## 守るべき前提（踏んだ落とし穴）

### nimo / Pyodide
- physbo・odat-se は PyPI に sdist しか無い → 純 Python wheel を自前ビルドして同梱（手順は README）。版を変えたら `protocol.ts` の `BUNDLED_WHEELS` を更新して `npm run smoke`。
- nimo の `__init__` が LLMEP 経由で `anthropic` を import する → `runner.setup()` で空モジュールを差し込む。LLMEP は対象外。
- micropip のキーワード引数は JS から `install.callKwargs(..., { deps: false })` で渡す（素の第 2 引数だと依存を全部解決しに行く）。
- nimo は一部の失敗で `sys.exit()` を呼ぶ → runner は `SystemExit` も捕まえる。
- `minimization` は全目的変数で共通の 1 つ → 常に最大化で渡し、最小化の列を符号反転（`direction: "flag"`）。SLESA は常に最小化なので逆（`"minimizes"`）。方向の無い手法（PTR・LSE など）は反転しない。
- `output_res.csv` は多くの手法で「未実験の行だけ」を元の順に出力。LSE（`actions` 列あり）と PDC は全行。PDC の確率列名は `output_res_classes.csv` でラベルに対応づける。
- SLESA は前回の提案行がすべて測定済みでないと「ログ不正」で止まる → 実行前にチェック。行を削除したら状態ファイルは捨てる。
- COMBI は組成を百分率の整数で扱い、提案は新しい組成（`actions=-1`）。「候補表の末尾に追加」で行にできる。
- PHYSBO は実験済みが少ない・山が鋭いと予測が全候補で一定になり、提案が表の先頭からになる（CPython の nimo でも同じ）→ 検知して DOE を案内（results.ts の `notes`）。
- Windows の CPython では、nimo が日本語列名の UTF-8 CSV を cp932 で読んで失敗する（Pyodide は UTF-8 なので問題なし）。比較検証するときは `PYTHONUTF8=1`。

### 画面（Svelte 5 / Handsontable）
- Svelte の状態（Proxy）はワーカーに `postMessage` できない → engine で JSON に通してから送る。
- 表のデータは大きいので `$state.raw` で持ち、編集は配列を直接書き換えて `app.touch()`（`version` を進める）で知らせる。
- 表に渡すデータは「元の行＋予測列」のコピー。編集は `afterChange` で `toPhysicalRow` を通して元の行へ書き戻す。Handsontable 内での行・列の挿入は禁止し、行列の操作はすべて app 側の関数で行う。
- 描画フックはコンストラクタ実行中にも呼ばれる → `hot` ではなく `this` を使う。行の削除直後は古い行数で描画されることがあるので、存在しない行に耐えるようにする。
- 見出しのチップは `beforeOnCellMouseDown` で処理して `stopImmediatePropagation`（列の選択を止める）。
- 重なり順: Handsontable の見出し 160〜180 ＜ 役割の自動判定カード 300 ＜ 通知 2000 ＜ ファイルのメニュー 2100。ダイアログは `<dialog>.showModal()`（最前面の層）なので z-index は不要。
- 共通の `button` は inline-flex・中央寄せ・折り返しなし。一覧の項目など左寄せ・折り返しが要るボタンは `justify-content: flex-start; white-space: normal` を明示する（共通スタイルを変えたら、使い方・候補生成などのダイアログも目視する）。
- グローバルの `button.danger` は塗りの赤。メニュー項目などで文字だけ赤くしたいときは別のクラス（`danger-text`）にする（hover で読めなくなった）。
- 見出しの HTML は自前でエスケープしている（`sanitizer` は素通し）。利用者の文字列を HTML に入れるときは必ずエスケープする（グラフのホバーも同じ）。
- 実行中に別ファイルを開いたら結果を捨てる（`#loadId`）。実行時点の表を写してから対応づける。列の役割が変わった後の結果は `runStale` として強調・予測を隠す。
- 構造を変える操作（行・列の削除、候補の追加）は `#undoable` で包み、通知の「元に戻す」で戻せるようにする。確認・入力はブラウザの confirm/prompt ではなく `ConfirmDialog`（`app.confirmRequest`）。
- リセットは既定で時刻付きの CSV を書き出してから行う。▼ から「保存せずにリセット」も選べる（毎回のダウンロードは不便という利用者の要望）。

### 環境
- 手元の Node は 20.17 → Vite 6 + vite-plugin-svelte 5（Vite 7/8 は Node 20.19 以上が必要）。
- 依存を足した直後に開発サーバーが 504（Outdated Optimize Dep）を返したら `npx vite --force` で起動し直す。
- gh は Git Bash の PATH に無い。PowerShell で PATH を読み直して使う（`$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")`）。

## デザインの約束

- 色の意味は全体で共通: 説明変数＝青、目的変数＝橙、使わない＝灰、提案＝黄の★、予測＝紫（`src/app.css` の変数）。操作の色（アクセント）は藍緑 `--accent` で、説明変数の青と混ぜない。
- アイコンは絵文字を使わず `components/Icon.svelte` の線画 SVG（足りなければ同じ太さで追加）。ボタンは 3 種: 主＝`.primary`（塗り。画面に 1 つ、基本は「提案を出す」）・副＝既定（淡い面）・控えめ＝`.ghost`。
- 画面の割り当て: ヘッダ＝ファイル名のメニュー（開く・新規・サンプル・書き出し・リセット）と状態・使い方。右パネル＝今の手法（「変更」でダイアログ `MethodDialog`）・設定・実行。表の上＝凡例・予測の表示・候補を生成（今の表への追加。候補表タブのみ）、表の下＝行を追加。通知はヘッダのすぐ下の中央、列の役割の自動判定は表の右上に浮いたカード。
- 改善前の UI モック（`.tmp/mock/index.html`、git 管理外）で方向性を決めた。大きな見た目の変更は、モックで比べてから実装する。
- 説明文は利用者向けに専門用語を言い換える。README には「研究室の他の人向け」といった利用者層の記述を書かない（利用者の指示）。
- 使い方ダイアログの文言は利用者と調整済み。変えるときは意図を確認する。
- グラフの色は dataviz スキルの検証済みパレット（カテゴリは固定順、数値は青の 1 色濃淡）。

## 残っている検討事項

- 候補生成の条件式による絞り込み（例: a+b≤0.5）、xlsx の読み込み、列の並べ替えは未対応（第 2 弾の計画で「今回やらない」とした）。
- LLMEP（API キーをブラウザで扱う設計が要る）、ロボット連携の入出力は対象外。
- Handsontable は非商用ライセンス（`non-commercial-and-evaluation`）で使用。商用利用には別ライセンスが要る。
- GitHub Actions の actions/*@v4 が Node 20 非推奨の警告を出している（動作はする）。
- 本体の JS は約 1.7 MB（ほぼ Handsontable、gzip 430 KB）。必要なら `handsontable/base` ＋必要なプラグインの登録で削れる。
