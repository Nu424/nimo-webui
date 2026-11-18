<script lang="ts">
  import { app, type Tab } from "../lib/app.svelte";
  import EmptyState from "./EmptyState.svelte";
  import CandidateGrid from "./CandidateGrid.svelte";
  import ProposalsView from "./ProposalsView.svelte";
  import ChartView from "./ChartView.svelte";

  const s = $derived(app.summary);
  const tabs: { id: Tab; label: string }[] = [
    { id: "input", label: "候補表" },
    { id: "proposals", label: "提案" },
    { id: "chart", label: "グラフ" },
  ];
  const badge = (id: Tab) =>
    id === "input" ? (s ? `${s.nRows}` : "") : id === "proposals" ? (app.lastRun ? `${app.lastRun.proposals.length}` : "") : "";
</script>

{#if !app.dataset}
  <EmptyState />
{:else}
  <div class="pane">
    <div class="tabs" role="tablist">
      {#each tabs as t}
        <button role="tab" class="tab" class:active={app.tab === t.id} aria-selected={app.tab === t.id} onclick={() => (app.tab = t.id)}>
          {t.label}
          {#if badge(t.id)}<span class="badge" class:hot={t.id === "proposals"}>{badge(t.id)}</span>{/if}
        </button>
      {/each}
      <div class="spacer"></div>
      {#if app.tab === "input"}
        <div class="legend">
          <span class="chip x">説明変数</span>
          <span class="chip y">目的変数</span>
          <span class="chip ignore">使わない</span>
          {#if app.proposedRows.size}<span class="chip proposal">★ 提案</span>{/if}
          {#if app.lastRun?.predictions}
            <label class="toggle"><input type="checkbox" bind:checked={app.settings.showPredictions} /> 予測を表示</label>
          {/if}
        </div>
      {/if}
    </div>

    <div class="body">
      {#if app.tab === "input"}
        <CandidateGrid />
      {:else if app.tab === "proposals"}
        <ProposalsView />
      {:else}
        <ChartView />
      {/if}
    </div>

    {#if s}
      <footer class="status">
        <span>{s.nRows} 行</span>
        <span class="dot ok"></span><span>実験済み {s.nObserved}</span>
        <span class="dot pending"></span><span>未実験 {s.nPending}</span>
        {#if s.nPartial}<span class="dot partial"></span><span>一部のみ {s.nPartial}</span>{/if}
        <span class="sep">|</span>
        <span>説明変数 {s.xCols.length}・目的変数 {s.yCols.length}</span>
        <span class="grow"></span>
        <span class="hint muted">見出しのチップで役割を切替 ・ 右クリックでメニュー ・ <kbd>Ctrl</kbd>+<kbd>Z</kbd> で元に戻す</span>
      </footer>
    {/if}
  </div>
{/if}

<style>
  .pane { display: flex; flex-direction: column; height: 100%; }
  .tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px 8px 0;
    border-bottom: 1px solid var(--line);
  }
  .tab {
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 6px 6px 0 0;
    background: transparent;
    padding: 7px 14px;
    color: var(--muted);
    font-weight: 600;
  }
  .tab.active { color: var(--text); border-bottom-color: var(--accent); }
  .badge {
    display: inline-block;
    margin-left: 4px;
    font-size: 11px;
    background: var(--line);
    color: var(--muted);
    border-radius: 999px;
    padding: 0 6px;
  }
  .badge.hot { background: var(--proposal); color: #4a3700; }
  .spacer { flex: 1; }
  .legend { display: flex; align-items: center; gap: 6px; padding-bottom: 6px; }
  .toggle { display: inline-flex; gap: 4px; align-items: center; font-size: 12px; color: var(--muted); margin-left: 6px; cursor: pointer; }
  .body { flex: 1; min-height: 0; position: relative; }
  .status {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    font-size: 12px;
    border-top: 1px solid var(--line);
    color: var(--text);
    background: #fafbfc;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-left: 6px; }
  .dot.ok { background: var(--ok); }
  .dot.pending { background: var(--line-strong); }
  .dot.partial { background: var(--warn); }
  .sep { color: var(--line-strong); margin: 0 4px; }
  .grow { flex: 1; }
  .hint { font-size: 11px; }
  @media (max-width: 1300px) { .hint { display: none; } }
</style>
