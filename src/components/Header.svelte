<script lang="ts">
  import { app } from "../lib/app.svelte";
  import { engine } from "../lib/nimo/engine.svelte";
  import { loadSamples } from "../lib/samples";
  import EngineStatus from "./EngineStatus.svelte";

  let fileInput: HTMLInputElement;
  let samplesOpen = $state(false);

  function onPick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) app.openFile(f);
    (e.target as HTMLInputElement).value = "";
  }

  const savedText = $derived(app.savedAt ? `自動保存 ${app.savedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}` : "");
</script>

<header>
  <div class="brand">
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#3b5bdb" />
      <circle cx="11" cy="20" r="3" fill="#fff" />
      <circle cx="17" cy="12" r="3" fill="#fff" opacity=".7" />
      <path d="M22 6l1.6 3.4L27 11l-3.4 1.6L22 16l-1.6-3.4L17 11l3.4-1.6z" fill="#ffd43b" />
    </svg>
    <div>
      <div class="title">nimo WebUI</div>
      <div class="sub">次に実験する条件を、AI に提案してもらう</div>
    </div>
  </div>

  <div class="file">
    {#if app.dataset}
      <span class="fname" title={app.dataset.name}>📄 {app.dataset.name}</span>
      <span class="saved muted" title="作業内容はこのブラウザに自動で保存されます。再読み込みしても消えません">{savedText}</span>
    {/if}
  </div>

  <div class="actions">
    <input bind:this={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" hidden onchange={onPick} />
    <button onclick={() => fileInput.click()} title="CSV を開く（ウィンドウへのドラッグ&ドロップでも開けます）">📂 開く</button>
    <div class="menu-wrap">
      <button onclick={() => (samplesOpen = !samplesOpen)} aria-expanded={samplesOpen}>🧪 サンプル ▾</button>
      {#if samplesOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="backdrop" onclick={() => (samplesOpen = false)}></div>
        <div class="menu">
          {#await loadSamples() then samples}
            {#each samples as s}
              <button
                class="item"
                onclick={() => {
                  samplesOpen = false;
                  app.openSample(s);
                }}
              >
                <b>{s.title}</b>
                <span class="muted">{s.description}</span>
              </button>
            {/each}
          {/await}
        </div>
      {/if}
    </div>
    <button onclick={() => app.exportCandidates()} disabled={!app.dataset} title="編集した候補表を CSV で保存（Ctrl+S）">💾 書き出し</button>
    <span class="sep"></span>
    <EngineStatus />
    <button class="help" onclick={() => (app.helpOpen = "start")}>❓ 使い方</button>
  </div>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 14px;
  }
  .brand { display: flex; align-items: center; gap: 10px; }
  .title { font-weight: 700; font-size: 16px; letter-spacing: 0.01em; }
  .sub { font-size: 11px; color: var(--muted); }
  .file { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 10px; }
  .fname { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .saved { font-size: 11px; white-space: nowrap; }
  .actions { display: flex; align-items: center; gap: 6px; }
  .sep { width: 1px; height: 22px; background: var(--line-strong); margin: 0 4px; }
  .menu-wrap { position: relative; }
  .backdrop { position: fixed; inset: 0; z-index: 50; }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 51;
    width: 360px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgba(16, 24, 40, 0.14);
    padding: 6px;
    display: grid;
    gap: 2px;
  }
  .item {
    border: none;
    text-align: left;
    display: grid;
    gap: 2px;
    padding: 8px 10px;
  }
  .item span { font-size: 12px; }
</style>
