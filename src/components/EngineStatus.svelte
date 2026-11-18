<script lang="ts">
  import { engine } from "../lib/nimo/engine.svelte";
</script>

{#if engine.status === "loading" || engine.status === "idle"}
  <div class="pill loading" title={engine.progressLabel}>
    <span class="spinner"></span>
    <span>Python 準備中</span>
    <span class="bar"><span style:width={`${Math.round(engine.progress * 100)}%`}></span></span>
  </div>
{:else if engine.status === "error"}
  <button class="pill error" onclick={() => engine.retry()} title={engine.errorMessage}>⚠ Python を読み込めませんでした（クリックで再試行）</button>
{:else}
  <div
    class="pill ready"
    title={engine.versions ? `Python ${engine.versions.python} / nimo ${engine.versions.nimo} / PHYSBO ${engine.versions.physbo}（ブラウザ内で動作。データは外部に送信されません）` : ""}
  >
    <span class="dot"></span>
    nimo {engine.versions?.nimo ?? ""}
    {engine.status === "running" ? "計算中…" : "準備完了"}
  </div>
{/if}

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    border-radius: 999px;
    padding: 3px 10px;
    border: 1px solid var(--line);
    background: #fff;
    white-space: nowrap;
  }
  .ready { color: var(--ok); border-color: #b8e2c1; background: var(--ok-bg); }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); }
  .error { color: var(--err); border-color: #f3c0c0; background: var(--err-bg); }
  .loading { color: var(--muted); }
  .bar { width: 60px; height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--accent); transition: width 0.4s; }
  .spinner {
    width: 10px;
    height: 10px;
    border: 2px solid var(--line-strong);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
