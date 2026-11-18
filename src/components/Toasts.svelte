<script lang="ts">
  import { fly } from "svelte/transition";
  import { app } from "../lib/app.svelte";
</script>

<div class="toasts" aria-live="polite">
  {#each app.toasts as t (t.id)}
    <div class="toast {t.kind}" transition:fly={{ y: 12, duration: 180 }}>
      {t.kind === "success" ? "✓" : t.kind === "error" ? "⚠" : "ℹ"}
      {t.text}
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    left: 50%;
    bottom: 20px;
    transform: translateX(-50%);
    display: grid;
    gap: 8px;
    z-index: 2000;
    pointer-events: none;
  }
  .toast {
    background: #1f2430;
    color: #fff;
    padding: 9px 16px;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    font-size: 13px;
    max-width: 640px;
  }
  .toast.success { background: #1f5130; }
  .toast.error { background: #7a1d1d; }
</style>
