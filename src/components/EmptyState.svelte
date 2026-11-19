<script lang="ts">
  // 何も開いていないときの画面: 一言の説明・ファイルの入力枠・新しい表を作る・サンプルだけを置く。
  // 入力ファイルの作り方は、初めてファイルを開いたときに使い方ダイアログで案内する。
  import { app } from "../lib/app.svelte";
  import { loadSamples } from "../lib/samples";
  import Icon, { type IconName } from "./Icon.svelte";

  let fileInput: HTMLInputElement;
  const goalIcon: Record<string, IconName> = { optimize: "target", classify: "map", combi: "layers", start: "sprout" };
</script>

<div class="empty">
  <div class="inner">
    <h1>次に実験する条件を、AI に提案してもらう</h1>
    <p class="lead">候補の条件を並べた表（CSV）を開くと、実験済みの結果から次に試す条件を選びます。計算はこのブラウザの中だけで行い、データは外に送りません。</p>
    <button class="drop" onclick={() => fileInput.click()}>
      <span class="ic"><Icon name="folder" size={22} /></span>
      <b>候補表の CSV をここにドラッグ&ドロップ</b>
      <span>またはクリックしてファイルを選ぶ</span>
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
      CSV が無ければ <button class="link" onclick={() => (app.generatorOpen = "new")}><Icon name="wand" size={14} />条件の範囲から新しい候補表を作る</button>
    </div>

    <h3>サンプルで試す</h3>
    <div class="samples">
      {#await loadSamples() then samples}
        {#each samples as s}
          <button class="sample" onclick={() => app.openSample(s)}>
            <span class="gi"><Icon name={goalIcon[s.goal] ?? "flask"} size={18} /></span>
            <span class="text">
              <b>{s.title}</b>
              <span>{s.description}</span>
            </span>
            <span class="go"><Icon name="right" /></span>
          </button>
        {/each}
      {/await}
    </div>
  </div>
</div>

<style>
  .empty { height: 100%; overflow: auto; }
  .inner { max-width: 720px; margin: 0 auto; padding: 56px 28px 40px; }
  h1 { font-size: 20px; margin: 0 0 6px; }
  .lead { color: var(--muted); margin: 0 0 24px; line-height: 1.7; }
  .drop {
    width: 100%;
    display: grid;
    justify-items: center;
    gap: 8px;
    padding: 36px 24px;
    border: 1.5px dashed var(--accent-line);
    box-shadow: none;
    border-radius: 14px;
    background: #f7fbfa;
    color: var(--muted);
    white-space: normal;
  }
  .drop:hover { background: var(--accent-weak) !important; border-color: var(--accent); }
  .drop b { color: var(--text); font-size: 14px; }
  .ic { width: 44px; height: 44px; border-radius: 12px; background: #fff; display: grid; place-items: center; color: var(--accent); box-shadow: 0 0 0 1px var(--accent-line); }
  .or { text-align: center; margin: 14px 0 0; color: var(--faint); }
  .link { background: none !important; box-shadow: none; color: var(--accent); padding: 0 2px; font-weight: 600; gap: 4px; }
  .link:hover { text-decoration: underline; }
  h3 { font-size: 13px; color: var(--muted); margin: 36px 0 8px; font-weight: 600; }
  .samples { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; display: grid; }
  .sample { justify-content: flex-start; gap: 12px; padding: 12px 14px; text-align: left; background: #fff; box-shadow: none; border-radius: 0; border-bottom: 1px solid var(--line); white-space: normal; }
  .sample:last-child { border-bottom: 0; }
  .sample:hover { background: var(--surface) !important; }
  .gi { width: 32px; height: 32px; border-radius: 8px; background: var(--accent-weak); color: var(--accent); display: grid; place-items: center; flex: none; }
  .text { display: grid; gap: 1px; flex: 1; }
  .text span { font-size: 12px; color: var(--muted); line-height: 1.5; }
  .go { color: var(--faint); }
</style>
