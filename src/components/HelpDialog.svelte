<script lang="ts">
  import { app } from "../lib/app.svelte";
  import { GOALS, MODULES } from "../lib/modules";
  import { engine } from "../lib/nimo/engine.svelte";
  import ModuleFigure from "./ModuleFigure.svelte";

  const topics = [
    { id: "start", label: "はじめに" },
    { id: "input", label: "入力ファイルの作り方" },
    { id: "output", label: "結果の見方" },
    { id: "modules", label: "手法の選び方" },
    { id: "faq", label: "よくある質問" },
  ];
  let dialog: HTMLDialogElement;
  $effect(() => {
    dialog.showModal();
  });
  const close = () => (app.helpOpen = null);
  function pick(id: string) {
    app.selectModule(id);
    close();
  }
</script>

<dialog bind:this={dialog} onclose={close} onclick={(e) => e.target === dialog && dialog.close()}>
  <div class="box">
    <nav>
      <div class="title">使い方</div>
      {#each topics as t}
        <button class="ghost" class:active={app.helpOpen === t.id} onclick={() => (app.helpOpen = t.id)}>{t.label}</button>
      {/each}
      <div class="grow"></div>
      <div class="ver muted">
        {#if engine.versions}nimo {engine.versions.nimo}<br />PHYSBO {engine.versions.physbo}<br />Python {engine.versions.python}{/if}
      </div>
    </nav>

    <article>
      <button class="ghost x" onclick={() => dialog.close()} aria-label="閉じる">✕</button>

      {#if app.helpOpen === "start"}
        <h2>nimo WebUI でできること</h2>
        <p>
          <a href="https://nims-da.github.io/nimo/en/index.html" target="_blank" rel="noreferrer">NIMO</a>
          は、物質・材料研究機構（NIMS）が開発した「次にどの条件で実験すればよいか」を AI が提案するライブラリです。
          このツールは NIMO をブラウザの中で動かし、表を開いてボタンを押すだけで使えるようにしたものです。
        </p>
        <div class="cycle">
          <div><span class="n">1</span><b>候補表を開く</b><p>試せる条件を全部並べ、測った行には結果を書いた CSV</p></div>
          <div><span class="n">2</span><b>手法を選んで実行</b><p>右のパネルで「やりたいこと」→ 手法 → 「提案を出す」</p></div>
          <div><span class="n">3</span><b>提案を実験する</b><p>「提案」タブの条件で実験し、結果をその場で入力</p></div>
          <div><span class="n">↻</span><b>繰り返す</b><p>実行するたびにデータが増え、提案が賢くなる</p></div>
        </div>
        <h3>まずはサンプルで</h3>
        <p>
          上の「🧪 サンプル」から「合成条件の最適化」を開き、「提案を出す」→「仮想実験で結果を入れる」→「提案を出す」…と数回繰り返してみてください。
          「グラフ」タブで、提案（★）が良い領域へ近づいていく様子が見られます。
        </p>
        <h3>データの扱い</h3>
        <p>
          計算はすべてこのブラウザの中（Pyodide）で行われ、表のデータは外部に送信されません。作業内容はこのブラウザに自動保存され、閉じても次に開いたときに戻ります。
          長く残したい表は「💾 書き出し」で CSV に保存してください。
        </p>
        <h3>ショートカット</h3>
        <ul>
          <li><kbd>Ctrl</kbd>+<kbd>Enter</kbd> 提案を出す</li>
          <li><kbd>Ctrl</kbd>+<kbd>S</kbd> 候補表を書き出し</li>
          <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> 表の編集を元に戻す / やり直す</li>
          <li>Excel のセル範囲をコピーして、表に <kbd>Ctrl</kbd>+<kbd>V</kbd> で貼り付けられます</li>
        </ul>
      {:else if app.helpOpen === "input"}
        <h2>入力ファイル（候補表）の作り方</h2>
        <p>1 行が「1 つの実験条件」、1 列が「1 つの変数」の CSV です。<b>試せる条件の組み合わせを、まだ実験していないものも含めて全部</b>並べます。</p>
        <table class="ex">
          <thead><tr><th class="x">温度_C</th><th class="x">時間_h</th><th class="x">濃度_M</th><th class="y">収率_%</th><th class="ig">メモ</th></tr></thead>
          <tbody>
            <tr><td>60</td><td>1</td><td>0.1</td><td><b>32.5</b></td><td>1/10 実施</td></tr>
            <tr><td>60</td><td>1</td><td>0.2</td><td class="blank"></td><td></td></tr>
            <tr><td>60</td><td>2</td><td>0.1</td><td class="blank"></td><td></td></tr>
            <tr><td>…</td><td>…</td><td>…</td><td>…</td><td></td></tr>
          </tbody>
        </table>
        <dl>
          <dt><span class="chip x">説明変数</span></dt>
          <dd>実験で自分が決める条件（温度・組成・時間など）。<b>すべての行が数値で埋まっている</b>必要があります。単位は列名に書いておくとわかりやすいです。</dd>
          <dt><span class="chip y">目的変数</span></dt>
          <dd>測った結果（収率・強度・相の名前など）。<b>まだ測っていない行は空欄</b>にします。空欄の行が「提案の候補」になります。複数列あってもかまいません（多目的）。</dd>
          <dt><span class="chip ignore">使わない</span></dt>
          <dd>メモ・試料番号・計算に使わない測定値など。表には残り、書き出しにも含まれます。</dd>
        </dl>
        <h3>コツ</h3>
        <ul>
          <li>列の役割は開いた後で、見出しのチップをクリックして決められます。列の順番を並べ替える必要はありません。</li>
          <li>候補の条件は、Excel で組み合わせを作ってから貼り付けると簡単です。組成のように合計が決まっている場合は、合計を満たす組み合わせだけを並べます。</li>
          <li>一部の目的変数だけ測れた行は、nimo では「未実験」として扱われます。</li>
          <li>同じ表で目的変数を切り替えて別々に最適化することもできます（使わない列は「使わない」に）。</li>
          <li>Excel で「CSV（コンマ区切り）」として保存したファイルで大丈夫です。文字コードは自動で判別します。</li>
        </ul>
      {:else if app.helpOpen === "output"}
        <h2>結果の見方</h2>
        <h3>提案タブ</h3>
        <p>次に実験すると良い条件が、良い順に <span class="chip proposal">★1</span> <span class="chip proposal">★2</span> … と並びます。「行」は候補表の行番号です。</p>
        <ul>
          <li>実験したら、<span class="chip y">目的変数</span> の欄に結果を入力します。候補表の同じ行に書き込まれます。</li>
          <li>「⬇ 提案を CSV で保存」で、提案の行だけを候補表と同じ列構成で保存できます（実験ノートや装置への受け渡しに）。</li>
        </ul>
        <h3>予測の列（<span class="chip pred">予測</span>）</h3>
        <p>ベイズ最適化などの手法は、すべての候補について次の値を計算します。候補表の右側と提案タブに表示されます。</p>
        <dl>
          <dt>予測: 〇〇</dt>
          <dd>その条件で実験したときの目的変数の予想値（平均）。</dd>
          <dt>不確かさ σ</dt>
          <dd>予想の自信のなさ（標準偏差）。大きいほど「やってみないとわからない」。予想値 ± 2σ の範囲に、およそ 95% の確率で入ると見積もっています。</dd>
          <dt>獲得関数</dt>
          <dd>「次に実験する価値」のスコア。予想値が良いほど、また不確かさが大きいほど高くなります。提案はこれが大きい順です。</dd>
          <dt>確率 / 推定ラベル / 判定</dt>
          <dd>相図や境界探索の手法で、各候補がどのラベル（領域）に属しそうか。</dd>
        </dl>
        <h3>グラフタブ</h3>
        <ul>
          <li>●（大）実験済み、●（小・薄い）未実験、★ 提案。色は目的変数の値（未実験は予測値）です。</li>
          <li>縦軸・横軸を目的変数にすると、未実験の点は予測の位置に白抜き ○ で描かれます。2 つの目的変数のトレードオフ（パレート）を見るのに便利です。</li>
          <li>点をクリックすると、候補表のその行へ移動します。</li>
        </ul>
        <h3>うまくいかないとき</h3>
        <ul>
          <li>予測がほとんど平らなときは、実験済みの点が少なすぎるか、説明変数と目的変数の関係が弱い可能性があります。DOE などで点を増やしてみましょう。</li>
          <li>同じような条件ばかり提案されるときは、獲得関数を TS にすると散らばりやすくなります。</li>
        </ul>
      {:else if app.helpOpen === "modules"}
        <h2>手法の選び方</h2>
        <p>「やりたいこと」から選びます。名前をクリックすると、その手法に切り替わります。</p>
        {#each GOALS as g}
          <h3>{g.emoji} {g.label}</h3>
          <div class="mods">
            {#each MODULES.filter((m) => m.goals.includes(g.id)) as m}
              <button class="mod" onclick={() => pick(m.id)}>
                <ModuleFigure figure={m.figure} size="sm" />
                <span><b>{m.title}</b> <span class="muted mono">{m.id}</span><br /><span class="muted">{m.catchphrase}</span></span>
              </button>
            {/each}
          </div>
        {/each}
        <p class="muted">
          LLMEP（Claude を使った選択）は、ブラウザから API キーを扱う必要があるため、このツールでは使えません。ロボット連携用の入出力機能（preparation_input / analysis_output）も対象外です。
        </p>
      {:else if app.helpOpen === "faq"}
        <h2>よくある質問</h2>
        <dl>
          <dt>最初の読み込みが遅い</dt>
          <dd>初回はブラウザに Python と数値計算ライブラリ（数十 MB）を読み込むため、数十秒かかります。2 回目からはキャッシュされて速くなります。読み込み中も表の編集はできます。</dd>
          <dt>何行くらいまで扱えますか</dt>
          <dd>数千行 × 10 列程度なら数秒で計算できます。数万行になると、手法によっては時間がかかります。計算中は「中断」できます。</dd>
          <dt>Python の nimo と結果は同じですか</dt>
          <dd>中身は同じ nimo（PyPI 版）をそのまま動かしています。乱数を使う手法は、詳細設定の「乱数の種」を固定すると再現できます。</dd>
          <dt>最小化したい</dt>
          <dd>目的変数の見出しの「▲ 最大化」をクリックすると「▼ 最小化」に切り替わります。目的変数ごとに方向を変えられます。</dd>
          <dt>作業をリセットしたい</dt>
          <dd>新しい CSV を開くと、表と提案の履歴が置き換わります。</dd>
        </dl>
      {/if}
    </article>
  </div>
</dialog>

<style>
  dialog {
    border: none;
    border-radius: 12px;
    padding: 0;
    width: min(980px, 92vw);
    height: min(720px, 88vh);
    box-shadow: 0 24px 64px rgba(16, 24, 40, 0.3);
  }
  dialog::backdrop { background: rgba(16, 24, 40, 0.4); }
  .box { display: grid; grid-template-columns: 200px 1fr; height: 100%; }
  nav { background: #f6f7f9; border-right: 1px solid var(--line); padding: 16px 10px; display: flex; flex-direction: column; gap: 2px; }
  nav .title { font-weight: 700; padding: 0 10px 10px; }
  nav button { text-align: left; }
  nav button.active { background: #fff; box-shadow: var(--shadow); font-weight: 600; }
  .grow { flex: 1; }
  .ver { font-size: 11px; padding: 0 10px; line-height: 1.6; }
  article { position: relative; overflow: auto; padding: 22px 32px 32px; line-height: 1.75; font-size: 14px; }
  .x { position: absolute; top: 10px; right: 10px; font-size: 16px; }
  h2 { font-size: 20px; margin: 0 0 12px; }
  h3 { font-size: 15px; margin: 22px 0 6px; }
  dt { font-weight: 600; margin-top: 10px; }
  dd { margin: 2px 0 0 0; color: #333; }
  .cycle { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
  .cycle > div { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: #fafbfd; }
  .cycle p { margin: 4px 0 0; font-size: 12px; color: var(--muted); line-height: 1.5; }
  .n {
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-size: 11px;
    margin-right: 6px;
  }
  .ex { border-collapse: collapse; font-size: 13px; margin: 8px 0 14px; }
  .ex th, .ex td { border: 1px solid var(--line); padding: 4px 12px; text-align: right; }
  .ex th.x { background: var(--x-bg); color: var(--x); }
  .ex th.y { background: var(--y-bg); color: var(--y); }
  .ex th.ig { background: var(--ignore-bg); color: var(--ignore); }
  .ex td.blank { background: repeating-linear-gradient(45deg, #fff, #fff 4px, #f6f7f9 4px, #f6f7f9 8px); }
  .mods { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .mod { display: flex; gap: 10px; align-items: center; text-align: left; font-size: 12px; line-height: 1.5; }
</style>
