<script lang="ts">
  // アプリ内の確認・入力ダイアログ（app.confirmRequest を表示する）。
  // ブラウザの confirm/prompt は見た目が揃わず操作も止まるので使わない。
  import { app } from "../lib/app.svelte";
  import Icon from "./Icon.svelte";

  const req = $derived(app.confirmRequest!);
  let dialog: HTMLDialogElement;
  let value = $state(app.confirmRequest?.input?.value ?? "");
  let input: HTMLInputElement | undefined = $state();
  /** ▼ で開いている操作の番号 */
  let moreOpen = $state<number | null>(null);

  $effect(() => {
    dialog.showModal();
    input?.select();
  });

  const close = () => (app.confirmRequest = null);
  function act(run: (v: string) => void) {
    close();
    run(value);
  }
  const primary = $derived(req.actions.find((a) => a.kind === "primary") ?? req.actions.at(-1));
</script>

<dialog
  bind:this={dialog}
  onclose={close}
  oncancel={(e) => {
    if (moreOpen !== null) {
      e.preventDefault();
      moreOpen = null;
    }
  }}
  onclick={(e) => {
    if (moreOpen !== null && !(e.target as HTMLElement).closest(".split")) moreOpen = null;
    if (e.target === dialog) dialog.close();
  }}
>
  <form
    method="dialog"
    onsubmit={(e) => {
      e.preventDefault();
      if (req.input && primary) act(primary.run);
    }}
  >
    <h2>{req.title}</h2>
    {#if req.message}<p>{req.message}</p>{/if}
    {#if req.input}
      <label>
        <span>{req.input.label}</span>
        <input bind:this={input} bind:value />
      </label>
    {/if}
    <div class="actions">
      <button type="button" class="ghost" onclick={() => dialog.close()}>キャンセル</button>
      {#each req.actions as a, i}
        {#if a.more?.length}
          <div class="split" class:primary={a.kind === "primary"}>
            <button type="button" class:primary={a.kind === "primary"} class:danger={a.kind === "danger"} onclick={() => act(a.run)}>{a.label}</button>
            <button
              type="button"
              class="caret"
              class:primary={a.kind === "primary"}
              class:danger={a.kind === "danger"}
              aria-label="ほかの操作"
              aria-expanded={moreOpen === i}
              onclick={() => (moreOpen = moreOpen === i ? null : i)}><Icon name="down" size={14} /></button
            >
            {#if moreOpen === i}
              <div class="more" role="menu" {@attach (el) => (el.querySelector("button") as HTMLButtonElement | null)?.focus()}>
                {#each a.more as m}
                  <button type="button" role="menuitem" class="item" class:danger-text={m.kind === "danger"} onclick={() => act(m.run)}>{m.label}</button>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <button type="button" class:primary={a.kind === "primary"} class:danger={a.kind === "danger"} onclick={() => act(a.run)}>{a.label}</button>
        {/if}
      {/each}
    </div>
  </form>
</dialog>

<style>
  dialog {
    border: none;
    border-radius: 14px;
    padding: 20px 22px;
    width: min(480px, 92vw);
    box-shadow: 0 24px 64px rgba(16, 24, 40, 0.3);
    color: var(--text);
    overflow: visible;
  }
  dialog::backdrop { background: rgba(20, 30, 36, 0.38); }
  h2 { font-size: 16px; margin: 0 0 10px; }
  p { margin: 0 0 16px; line-height: 1.7; white-space: pre-line; color: var(--muted); }
  label { display: grid; gap: 4px; font-size: 12px; color: var(--muted); margin-bottom: 14px; }
  label input { font-size: 14px; padding: 6px 8px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  .actions > button, .split > button { padding: 7px 14px; }
  .split { position: relative; display: inline-flex; }
  .split > button:first-child { border-radius: 8px 0 0 8px; }
  .split > .caret { border-radius: 0 8px 8px 0; padding: 7px 8px; margin-left: 1px; }
  .split.primary > .caret { box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.35); margin-left: 0; }
  .more {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    min-width: 200px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: var(--shadow-pop);
    padding: 4px;
    display: grid;
    z-index: 1;
  }
  .item { justify-content: flex-start; background: transparent; box-shadow: none; padding: 7px 10px; }
  .danger-text { color: var(--err); }
</style>
