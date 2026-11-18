<script lang="ts">
  // アプリ内の確認・入力ダイアログ（app.confirmRequest を表示する）。
  // ブラウザの confirm/prompt は見た目が揃わず操作も止まるので使わない。
  import { app } from "../lib/app.svelte";

  const req = $derived(app.confirmRequest!);
  let dialog: HTMLDialogElement;
  let value = $state(app.confirmRequest?.input?.value ?? "");
  let input: HTMLInputElement | undefined = $state();

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

<dialog bind:this={dialog} onclose={close} onclick={(e) => e.target === dialog && dialog.close()}>
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
      {#each req.actions as a}
        <button type="button" class:primary={a.kind === "primary"} class:danger={a.kind === "danger"} onclick={() => act(a.run)}>{a.label}</button>
      {/each}
    </div>
  </form>
</dialog>

<style>
  dialog {
    border: none;
    border-radius: 12px;
    padding: 20px 22px;
    width: min(460px, 92vw);
    box-shadow: 0 24px 64px rgba(16, 24, 40, 0.3);
  }
  dialog::backdrop { background: rgba(16, 24, 40, 0.4); }
  h2 { font-size: 16px; margin: 0 0 10px; }
  p { margin: 0 0 14px; line-height: 1.7; white-space: pre-line; color: #333; }
  label { display: grid; gap: 4px; font-size: 12px; color: var(--muted); margin-bottom: 14px; }
  label input { font-size: 14px; padding: 6px 8px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  .danger { background: var(--err); border-color: var(--err); color: #fff; font-weight: 600; }
  .danger:hover:not(:disabled) { background: #a61e1e !important; }
</style>
