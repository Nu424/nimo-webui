<script lang="ts">
  import { app } from "../lib/app.svelte";
  import { loadSamples } from "../lib/samples";

  let fileInput: HTMLInputElement;
  const goalIcon: Record<string, string> = { optimize: "🎯", classify: "🗺️", combi: "🌈", start: "🌱" };
</script>

<div class="empty">
  <div class="inner">
    <h1>候補表の CSV を開いて始めましょう</h1>
    <p class="lead muted">
      「試せる条件の一覧」と「これまでの実験結果」を 1 つの表にして開くと、
      <b>次に実験すると良い条件</b>を nimo が提案します。計算はすべてこのブラウザの中で行われ、データは外部に送信されません。
    </p>

    <button class="drop" onclick={() => fileInput.click()}>
      <span class="big">📄</span>
      <span><b>CSV をここにドラッグ&ドロップ</b>、またはクリックして選ぶ</span>
      <span class="muted small">Excel で保存した CSV（Shift_JIS）もそのまま開けます</span>
    </button>
    <input
      bind:this={fileInput}
      type="file"
      accept=".csv,.tsv,.txt,text/csv"
      hidden
      onchange={(e) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f) app.openFile(f);
      }}
    />

    <div class="cols">
      <section>
        <h2>候補表の形</h2>
        <table class="mini">
          <thead>
            <tr>
              <th class="x">温度</th><th class="x">時間</th><th class="x">濃度</th><th class="y">収率</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>60</td><td>1</td><td>0.1</td><td class="v">32.5</td></tr>
            <tr><td>60</td><td>2</td><td>0.1</td><td class="blank"></td></tr>
            <tr><td>70</td><td>1</td><td>0.2</td><td class="v">48.1</td></tr>
            <tr><td>70</td><td>2</td><td>0.2</td><td class="blank"></td></tr>
            <tr><td colspan="4" class="muted dots">⋮</td></tr>
          </tbody>
        </table>
        <ul class="legend">
          <li><span class="chip x">説明変数</span> 実験条件（数値）。試せる組み合わせを 1 行ずつ全部並べる</li>
          <li><span class="chip y">目的変数</span> 測った結果。<b>まだ測っていない行は空欄</b></li>
          <li>列の役割は開いた後に見出しをクリックして変えられます</li>
        </ul>
        <button class="link" onclick={() => (app.helpOpen = "input")}>入力ファイルの作り方をくわしく →</button>
      </section>

      <section>
        <h2>サンプルで試す</h2>
        <div class="samples">
          {#await loadSamples() then samples}
            {#each samples as s}
              <button class="sample" onclick={() => app.openSample(s)}>
                <span class="icon">{goalIcon[s.goal] ?? "🧪"}</span>
                <span class="text">
                  <b>{s.title}</b>
                  <span class="muted">{s.description}</span>
                </span>
              </button>
            {/each}
          {/await}
        </div>
        <p class="muted small">サンプルでは「仮想実験」ボタンで提案に結果を自動で入れて、何サイクルも回せます。</p>
      </section>
    </div>

    <ol class="flow">
      <li><span class="n">1</span><div><b>候補表を開く</b><span class="muted">説明変数と目的変数を確認</span></div></li>
      <li><span class="n">2</span><div><b>やりたいことから手法を選んで実行</b><span class="muted">迷ったら PHYSBO</span></div></li>
      <li><span class="n">3</span><div><b>提案された条件を実験</b><span class="muted">結果を表に書き込む</span></div></li>
      <li><span class="n">↻</span><div><b>もう一度実行</b><span class="muted">データが増えるほど賢くなる</span></div></li>
    </ol>
  </div>
</div>

<style>
  .empty { height: 100%; overflow: auto; }
  .inner { max-width: 880px; margin: 0 auto; padding: 32px 28px 40px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  .lead { margin: 0 0 20px; line-height: 1.7; }
  .drop {
    width: 100%;
    display: grid;
    justify-items: center;
    gap: 6px;
    padding: 28px;
    border: 2px dashed #b9c5ef;
    border-radius: 14px;
    background: #f7f9ff;
    font-size: 15px;
  }
  .drop:hover { background: var(--accent-weak) !important; border-color: var(--accent); }
  .big { font-size: 34px; }
  .small { font-size: 12px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 28px; }
  h2 { font-size: 14px; margin: 0 0 10px; }
  .mini { border-collapse: collapse; font-size: 12px; width: 100%; }
  .mini th, .mini td { border: 1px solid var(--line); padding: 4px 8px; text-align: right; }
  .mini th.x { background: var(--x-bg); color: var(--x); }
  .mini th.y { background: var(--y-bg); color: var(--y); }
  .mini td.v { font-weight: 600; }
  .mini td.blank { background: repeating-linear-gradient(45deg, #fff, #fff 4px, #f6f7f9 4px, #f6f7f9 8px); }
  .mini .dots { text-align: center; }
  .legend { padding-left: 0; list-style: none; display: grid; gap: 6px; font-size: 12px; margin: 10px 0; }
  .link { border: none; background: none; color: var(--accent); padding: 0; }
  .samples { display: grid; gap: 8px; }
  .sample { display: flex; gap: 10px; text-align: left; padding: 10px 12px; align-items: flex-start; }
  .sample .icon { font-size: 22px; }
  .sample .text { display: grid; gap: 2px; }
  .sample .text span { font-size: 12px; }
  .flow { list-style: none; padding: 0; margin: 32px 0 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .flow li { display: flex; gap: 8px; align-items: flex-start; background: #fafbfc; border: 1px solid var(--line); border-radius: 10px; padding: 10px; }
  .flow .n {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 700;
  }
  .flow div { display: grid; gap: 2px; font-size: 12px; }
</style>
