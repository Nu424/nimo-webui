<script lang="ts">
  // ヘッダ: 左にロゴとファイル名（クリックでファイルのメニュー）、右に Python の状態と使い方。
  // ファイルの操作（開く・新規・サンプル・書き出し・リセット）はメニューにまとめ、画面の主役を表と実行に譲る。
  import { app } from "../lib/app.svelte";
  import { loadSamples } from "../lib/samples";
  import EngineStatus from "./EngineStatus.svelte";
  import Icon, { type IconName } from "./Icon.svelte";

  let fileInput: HTMLInputElement;
  let menuOpen = $state(false);
  const sampleIcon: Record<string, IconName> = { optimize: "target", classify: "map", combi: "layers", start: "sprout" };

  function onPick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) app.openFile(f);
    (e.target as HTMLInputElement).value = "";
  }
  function act(fn: () => void) {
    menuOpen = false;
    fn();
  }

  const savedText = $derived(app.savedAt ? `自動保存 ${app.savedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}` : "");
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && (menuOpen = false)} />

<header>
  <div class="brand">
    <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0e6e6b" />
      <circle cx="10.5" cy="21" r="2.6" fill="#fff" opacity=".55" />
      <circle cx="16" cy="15" r="2.6" fill="#fff" opacity=".8" />
      <path d="M22.5 6.5l1.5 3.3 3.3 1.5-3.3 1.5-1.5 3.3-1.5-3.3-3.3-1.5 3.3-1.5z" fill="#f2b100" />
    </svg>
    <span class="title">nimo WebUI</span>
  </div>

  <input bind:this={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" hidden onchange={onPick} />
  {#if app.dataset}
    <span class="vsep"></span>
    <div class="menu-wrap">
      <button class="file" aria-expanded={menuOpen} aria-haspopup="menu" onclick={() => (menuOpen = !menuOpen)} title="ファイルの操作（開く・書き出し・リセットなど）">
        <Icon name="file" /><span class="fname">{app.dataset.name}</span><Icon name="down" size={14} />
      </button>
      {#if menuOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="backdrop" onclick={() => (menuOpen = false)}></div>
        <div class="menu" role="menu">
          <button class="item" role="menuitem" onclick={() => act(() => fileInput.click())}><Icon name="folder" />CSV を開く…<span class="k">ドロップでも可</span></button>
          <button class="item" role="menuitem" onclick={() => act(() => (app.generatorOpen = "new"))}><Icon name="wand" />新しい候補表を作る…</button>
          <hr />
          <div class="label">サンプル</div>
          {#await loadSamples() then samples}
            {#each samples as s}
              <button class="item" role="menuitem" title={s.description} onclick={() => act(() => app.openSample(s))}><Icon name={sampleIcon[s.goal] ?? "flask"} />{s.title}</button>
            {/each}
          {/await}
          <hr />
          <button class="item" role="menuitem" onclick={() => act(() => app.exportCandidates())}><Icon name="download" />書き出し（CSV）<span class="k"><kbd>Ctrl</kbd>+<kbd>S</kbd></span></button>
          <button class="item danger-text" role="menuitem" onclick={() => act(() => app.askReset())}><Icon name="reset" />リセット…</button>
        </div>
      {/if}
    </div>
    <span class="saved" title="作業内容はこのブラウザに自動で保存されます。再読み込みしても消えません">{savedText}</span>
  {/if}

  <span class="spacer"></span>
  <EngineStatus />
  <span class="vsep"></span>
  <button class="ghost" onclick={() => (app.helpOpen = "start")}><Icon name="help" />使い方</button>
</header>

<style>
  header { display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 12px 0 16px; flex: none; }
  .brand { display: flex; align-items: center; gap: 9px; }
  .title { font-weight: 700; font-size: 15px; letter-spacing: 0.01em; }
  .vsep { width: 1px; height: 20px; background: var(--line-strong); margin: 0 2px; }
  .spacer { flex: 1; }
  .menu-wrap { position: relative; min-width: 0; }
  .file { background: transparent; box-shadow: none; font-weight: 600; padding: 5px 8px 5px 10px; max-width: 420px; }
  .file :global(.icon) { color: var(--faint); }
  .file:hover, .file[aria-expanded="true"] { background: var(--panel) !important; box-shadow: inset 0 0 0 1px var(--line); }
  .fname { overflow: hidden; text-overflow: ellipsis; }
  .saved { font-size: 12px; color: var(--faint); white-space: nowrap; }
  /* Handsontable の見出し（z-index 160〜180）と通知（2000）より前面に出す */
  .backdrop { position: fixed; inset: 0; z-index: 2100; }
  .menu {
    position: absolute;
    left: 0;
    top: calc(100% + 6px);
    z-index: 2101;
    width: 300px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: var(--shadow-pop);
    padding: 6px;
    display: grid;
  }
  .item { justify-content: flex-start; gap: 10px; padding: 7px 10px; background: transparent; box-shadow: none; border-radius: 8px; }
  .item :global(.icon) { color: var(--muted); }
  .item .k { margin-left: auto; color: var(--faint); font-size: 12px; }
  .item:hover { background: var(--surface-2) !important; }
  .item.danger-text { color: var(--err); }
  .item.danger-text :global(.icon) { color: var(--err); }
  hr { border: 0; border-top: 1px solid var(--line); margin: 6px 4px; width: calc(100% - 8px); }
  .label { padding: 2px 10px; font-size: 12px; color: var(--faint); }
</style>
