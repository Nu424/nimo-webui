<script lang="ts">
  import { fly } from "svelte/transition";
  import { app } from "../lib/app.svelte";
</script>

<div class="toasts" aria-live="polite">
  {#each app.toasts as t (t.id)}
    <div class="toast {t.kind}" class:has-action={!!t.action} transition:fly={{ y: 12, duration: 180 }}>
      <span>{t.kind === "success" ? "✓" : t.kind === "error" ? "⚠" : "ℹ"} {t.text}</span>
      {#if t.action}
        <button
          class="small"
          onclick={() => {
            app.dismissToast(t.id);
            t.action!.run();
          }}>{t.action.label}</button
        >
      {/if}
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
    display: flex;
    align-items: center;
    gap: 12px;
    background: #1f2430;
    color: #fff;
    padding: 9px 16px;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    font-size: 13px;
    max-width: 640px;
  }
  /* ボタン付きの通知だけクリックできるようにする（ほかは下の画面の操作を邪魔しない） */
  .toast.has-action { pointer-events: auto; }
  .toast.success { background: #1f5130; }
  .toast.error { background: #7a1d1d; }
  .toast button { background: transparent; color: #ffd43b; border-color: rgba(255, 255, 255, 0.35); font-weight: 600; }
  .toast button:hover { background: rgba(255, 255, 255, 0.12) !important; }
</style>
