<script lang="ts">
  import { fly } from "svelte/transition";
  import { app } from "../lib/app.svelte";
  import Icon from "./Icon.svelte";
</script>

<div class="toasts" aria-live="polite">
  {#each app.toasts as t (t.id)}
    <div class="toast {t.kind}" class:has-action={!!t.action} transition:fly={{ y: -8, duration: 180 }}>
      <Icon name={t.kind === "success" ? "check" : t.kind === "error" ? "alert" : "info"} /><span>{t.text}</span>
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
  /* ヘッダのすぐ下・左の枠の中央に出す（ファイル名のメニュー・表の行・実行ボタンに重ねない） */
  .toasts {
    position: fixed;
    top: 58px;
    left: calc((100vw - 372px) / 2);
    transform: translateX(-50%);
    display: grid;
    justify-items: center;
    gap: 6px;
    z-index: 2000;
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #17222b;
    color: #fff;
    padding: 7px 14px;
    border-radius: 10px;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
    font-size: 13px;
    max-width: max(360px, calc(100vw - 900px));
    line-height: 1.5;
  }
  .toast :global(.icon) { color: #8fd3cc; }
  .toast.success :global(.icon) { color: #7ee09a; }
  .toast.error { background: #7a1d1d; }
  .toast.error :global(.icon) { color: #ffb4b4; }
  /* ボタン付きの通知だけクリックできるようにする（ほかは下の画面の操作を邪魔しない） */
  .toast.has-action { pointer-events: auto; }
  .toast button { background: transparent; color: #ffd43b; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35); font-weight: 600; }
  .toast button:hover { background: rgba(255, 255, 255, 0.12) !important; }
</style>
