<script lang="ts">
  import { app, type Tab } from "../lib/app.svelte";
  import EmptyState from "./EmptyState.svelte";
  import CandidateGrid from "./CandidateGrid.svelte";
  import ProposalsView from "./ProposalsView.svelte";
  import ChartView from "./ChartView.svelte";
  import Icon, { type IconName } from "./Icon.svelte";

  const s = $derived(app.summary);
  const tabs: { id: Tab; label: string; icon: IconName }[] = [
    { id: "input", label: "候補表", icon: "table" },
    { id: "proposals", label: "提案", icon: "spark" },
    { id: "chart", label: "グラフ", icon: "chart" },
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
          <Icon name={t.icon} />{t.label}
          {#if badge(t.id)}<span class="badge" class:hot={t.id === "proposals"}>{badge(t.id)}</span>{/if}
        </button>
      {/each}
      <div class="spacer"></div>
      {#if app.tab === "input"}
        <div class="legend">
          <span><i class="mark x"></i>説明変数</span>
          <span><i class="mark y"></i>目的変数</span>
          {#if app.dataset.roles.some((r) => r === "ignore")}<span><i class="mark ignore"></i>使わない</span>{/if}
          {#if app.proposedRows.size}<span><span class="star">★</span>提案</span>{/if}
          {#if app.lastRun?.predictions && !app.runStale}
            <label class="toggle"><input type="checkbox" bind:checked={app.settings.showPredictions} onchange={() => app.scheduleSave()} /><i class="mark pred"></i>予測</label>
          {/if}
        </div>
        <span class="tsep"></span>
        <button class="ghost small" onclick={() => (app.generatorOpen = "append")} title="変数の範囲・刻みから、候補の組み合わせを網羅的に作って追加する"><Icon name="wand" size={15} />候補を生成</button>
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
      {#if app.showRoleNotice && app.tab === "input" && s}
        <div class="notice" role="status">
          <Icon name="info" size={18} />
          <div>
            <div>列の役割を自動で決めました</div>
            <div class="sub">
              説明変数 {s.xCols.length} 列・目的変数「{s.yCols.map((c) => app.dataset!.header[c]).join("・") || "なし"}」{#if app.dataset.roles.some((r) => r === "ignore")}・使わない {app.dataset.roles.filter((r) => r === "ignore").length} 列{/if}。
              違っていれば、見出しのチップをクリックして直せます。
            </div>
          </div>
          <button class="small" onclick={() => (app.showRoleNotice = false)}>OK</button>
        </div>
      {/if}
    </div>

    {#if s}
      <footer class="status num">
        <span>{s.nRows} 行</span>
        <span><i class="dot ok"></i>実験済み {s.nObserved}</span>
        <span><i class="dot pending"></i>未実験 {s.nPending}</span>
        {#if s.nPartial}<span><i class="dot partial"></i>一部のみ {s.nPartial}</span>{/if}
        {#if s.nEmpty}<span><i class="dot empty"></i>空の行 {s.nEmpty}</span>{/if}
        {#if app.proposedRows.size}<span><span class="star">★</span>提案 {app.proposedRows.size}</span>{/if}
        <span class="spacer"></span>
        <span>説明変数 {s.xCols.length}・目的変数 {s.yCols.length}</span>
      </footer>
    {/if}
  </div>
{/if}

<style>
  .pane { display: flex; flex-direction: column; height: 100%; }
  .tabs { display: flex; align-items: center; gap: 2px; padding: 0 10px 0 6px; height: 48px; border-bottom: 1px solid var(--line); flex: none; }
  .tab {
    height: 48px;
    border-radius: 0;
    background: transparent !important;
    box-shadow: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    padding: 2px 12px 0;
    color: var(--muted);
    font-weight: 600;
    gap: 7px;
  }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--text); border-bottom-color: var(--accent); }
  .tab.active :global(.icon) { color: var(--accent); }
  .badge { font-size: 12px; font-weight: 500; color: var(--faint); }
  .badge.hot { color: var(--proposal-ink); background: var(--proposal-bg); border-radius: 999px; padding: 0 7px; font-weight: 600; }
  .spacer { flex: 1; }
  .legend { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--muted); margin-right: 4px; }
  .legend > span, .toggle { display: inline-flex; align-items: center; }
  .star { color: var(--proposal); margin-right: 4px; }
  .toggle { gap: 5px; cursor: pointer; }
  .toggle .mark { margin-right: 0; }
  .tsep { width: 1px; height: 18px; background: var(--line); margin: 0 4px; }
  .body { flex: 1; min-height: 0; position: relative; }
  .notice {
    position: absolute;
    top: 50px;
    right: 16px;
    z-index: 300;
    max-width: 400px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: var(--shadow-pop);
    padding: 12px 14px;
  }
  .notice > :global(.icon) { color: var(--accent); margin-top: 2px; }
  .notice .sub { color: var(--muted); font-size: 12px; line-height: 1.6; }
  .status { display: flex; align-items: center; gap: 14px; height: 34px; padding: 0 14px; font-size: 12px; border-top: 1px solid var(--line); color: var(--muted); flex: none; }
  .status > span { display: inline-flex; align-items: center; }
  .dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 6px; }
  .dot.ok { background: var(--ok); }
  .dot.pending { background: var(--line-strong); }
  .dot.partial { background: var(--warn); }
  .dot.empty { background: #fff; border: 1px solid var(--line-strong); }
</style>
