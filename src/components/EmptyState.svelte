<script lang="ts">
  // 何も開いていないときの画面: ファイルの入力枠・新しい表を作る・サンプルだけを置く。
  // 入力ファイルの作り方は、初めてファイルを開いたときに使い方ダイアログで案内する。
  import { app } from "../lib/app.svelte";
  import { loadSamples } from "../lib/samples";

  let fileInput: HTMLInputElement;
  const goalIcon: Record<string, string> = { optimize: "🎯", classify: "🗺️", combi: "🌈", start: "🌱" };
</script>

<div class="empty">
  <div class="inner">
    <button class="drop" onclick={() => fileInput.click()}>
      <span class="big">📄</span>
      <span><b>候補表の CSV をここにドラッグ&ドロップ</b>、またはクリックして選ぶ</span>
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
    <div class="or">
      CSV が無ければ <button class="link" onclick={() => (app.generatorOpen = "new")}>🧮 条件の範囲から新しい候補表を作る</button>
    </div>

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
  </div>
</div>

<style>
  .empty { height: 100%; overflow: auto; }
  .inner { max-width: 760px; margin: 0 auto; padding: 48px 28px 40px; }
  .drop {
    width: 100%;
    display: grid;
    justify-items: center;
    gap: 8px;
    padding: 40px 28px;
    border: 2px dashed #b9c5ef;
    border-radius: 14px;
    background: #f7f9ff;
    font-size: 15px;
  }
  .drop:hover { background: var(--accent-weak) !important; border-color: var(--accent); }
  .big { font-size: 36px; }
  .or { text-align: center; margin: 12px 0 0; font-size: 13px; color: var(--muted); }
  .link { border: none; background: none; color: var(--accent); padding: 0 2px; font-weight: 600; }
  .link:hover { text-decoration: underline; background: none !important; }
  h2 { font-size: 14px; margin: 36px 0 10px; }
  .samples { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .sample { display: flex; gap: 10px; text-align: left; padding: 10px 12px; align-items: flex-start; }
  .sample .icon { font-size: 22px; }
  .sample .text { display: grid; gap: 2px; }
  .sample .text span { font-size: 12px; line-height: 1.5; }
</style>
