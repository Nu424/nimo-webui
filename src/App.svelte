<script lang="ts">
  import { onMount } from "svelte";
  import { app } from "./lib/app.svelte";
  import { engine } from "./lib/nimo/engine.svelte";
  import Header from "./components/Header.svelte";
  import DataPane from "./components/DataPane.svelte";
  import SidePanel from "./components/SidePanel.svelte";
  import Toasts from "./components/Toasts.svelte";
  import HelpDialog from "./components/HelpDialog.svelte";

  // ページを開いた瞬間から Python の準備を裏で始める（初回は数十秒かかるため）
  onMount(() => {
    app.restore();
    engine.start();
  });

  // ---- ウィンドウのどこにでも CSV をドロップできるようにする
  let dragDepth = $state(0);
  const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files");
  function onDragEnter(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
  }
  function onDragLeave(e: DragEvent) {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
  }
  function onDrop(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    const file = e.dataTransfer?.files[0];
    if (file) app.openFile(file);
  }

  // ---- キーボード操作: Ctrl+Enter で実行、Ctrl+S で書き出し
  function onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      app.run();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      app.exportCandidates();
    }
  }
</script>

<svelte:window
  ondragenter={onDragEnter}
  ondragleave={onDragLeave}
  ondragover={(e) => hasFiles(e) && e.preventDefault()}
  ondrop={onDrop}
  onkeydown={onKey}
/>

<div class="shell">
  <Header />
  <main>
    <section class="left"><DataPane /></section>
    <aside class="right"><SidePanel /></aside>
  </main>
</div>

{#if dragDepth > 0}
  <div class="drop-overlay">
    <div class="drop-card">
      <div class="drop-icon">📄</div>
      <div>ここに CSV をドロップ</div>
      <div class="muted small">今の表は置き換わります（必要なら先に書き出してください）</div>
    </div>
  </div>
{/if}

<Toasts />
{#if app.helpOpen}<HelpDialog />{/if}

<style>
  .shell { display: flex; flex-direction: column; height: 100vh; }
  main {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 400px;
    gap: 12px;
    padding: 0 12px 12px;
  }
  .left, .right {
    min-height: 0;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .right { display: flex; flex-direction: column; }
  @media (max-width: 1100px) {
    main { grid-template-columns: minmax(0, 1fr) 340px; }
  }
  .drop-overlay {
    position: fixed;
    inset: 0;
    background: rgba(59, 91, 219, 0.12);
    backdrop-filter: blur(2px);
    display: grid;
    place-items: center;
    z-index: 1000;
    pointer-events: none;
  }
  .drop-card {
    background: #fff;
    border: 2px dashed var(--accent);
    border-radius: 16px;
    padding: 32px 48px;
    text-align: center;
    font-size: 18px;
    font-weight: 600;
    display: grid;
    gap: 6px;
  }
  .drop-icon { font-size: 40px; }
  .small { font-size: 12px; font-weight: 400; }
</style>
