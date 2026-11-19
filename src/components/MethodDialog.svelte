<script lang="ts">
  // 手法を選ぶダイアログ: 「やりたいこと → 手法 → 説明」を横に並べ、見比べてから決められるようにする。
  import { app } from "../lib/app.svelte";
  import { GOALS, MODULES, getModule, type GoalId } from "../lib/modules";
  import Icon from "./Icon.svelte";
  import ModuleFigure from "./ModuleFigure.svelte";

  let { onclose }: { onclose: () => void } = $props();

  let dialog: HTMLDialogElement;
  let focus = $state(app.moduleId);
  let goal = $state<GoalId>(app.module.goals[0]);
  const list = $derived(MODULES.filter((m) => m.goals.includes(goal)));
  const m = $derived(getModule(focus));

  $effect(() => dialog.showModal());

  function pickGoal(g: GoalId) {
    goal = g;
    if (!getModule(focus).goals.includes(g)) focus = MODULES.find((x) => x.goals.includes(g))!.id;
  }
  function use(id: string) {
    app.selectModule(id);
    dialog.close();
  }
</script>

<dialog bind:this={dialog} {onclose} onclick={(e) => e.target === dialog && dialog.close()}>
  <div class="dh">
    <h2>手法を選ぶ</h2>
    <button class="ghost icon-btn" onclick={() => dialog.close()} aria-label="閉じる"><Icon name="x" /></button>
  </div>
  <div class="db">
    <div class="col">
      <div class="colt">やりたいこと</div>
      <div class="goals">
        {#each GOALS as g}
          <button class="goal" class:on={goal === g.id} aria-pressed={goal === g.id} onclick={() => pickGoal(g.id)} title={g.hint}>
            <Icon name={g.icon} />{g.label}
          </button>
        {/each}
      </div>
    </div>
    <div class="col">
      <div class="colt">手法</div>
      <div class="mods">
        {#each list as x (x.id)}
          <button class="mod" class:on={focus === x.id} aria-pressed={focus === x.id} onclick={() => (focus = x.id)} ondblclick={() => use(x.id)}>
            <ModuleFigure figure={x.figure} size="xs" />
            <span class="mt">
              <b>{x.title}{#if x.id === "PHYSBO" || x.id === "DOE"}<span class="rec">定番</span>{/if}{#if x.id === app.moduleId}<span class="cur">使用中</span>{/if}</b>
              <span class="id">{x.id}</span>
            </span>
          </button>
        {/each}
      </div>
    </div>
    <div class="col detail">
      <div class="fig"><ModuleFigure figure={m.figure} /></div>
      <h3>{m.title} <span class="id">{m.id}</span></h3>
      <p class="catch">{m.catchphrase}</p>
      <p>{m.how}</p>
      <h4>使える条件</h4>
      <div class="req">
        <span>目的変数: {m.objectives.min === m.objectives.max ? `${m.objectives.min} 列` : `${m.objectives.min} 列〜`}（{m.objectiveKind === "label" ? "ラベル" : "数値"}）</span>
        <span>実験済み: {m.minObserved === 0 ? "なしで OK" : `${m.minObserved} 行〜`}</span>
      </div>
      <h4>使いどころ・注意</h4>
      <ul>{#each m.tips as t}<li>{t}</li>{/each}</ul>
      {#if m.docUrl || m.reference}
        <h4>資料</h4>
        {#if m.docUrl}<a href={m.docUrl} target="_blank" rel="noreferrer">公式ドキュメント <Icon name="ext" size={14} /></a>{/if}
        {#if m.reference}<div class="ref">出典: {m.reference}</div>{/if}
      {/if}
    </div>
  </div>
  <div class="df">
    <button class="ghost" onclick={() => dialog.close()}>キャンセル</button>
    <button class="primary" onclick={() => use(m.id)}>{m.id === app.moduleId ? "この手法のまま閉じる" : "この手法を使う"}</button>
  </div>
</dialog>

<style>
  dialog {
    border: none;
    padding: 0;
    border-radius: 16px;
    width: min(1000px, calc(100vw - 48px));
    height: min(640px, calc(100vh - 64px));
    box-shadow: 0 24px 64px rgba(16, 24, 40, 0.25);
    color: var(--text);
  }
  dialog[open] { display: grid; grid-template-rows: auto 1fr auto; }
  dialog::backdrop { background: rgba(20, 30, 36, 0.38); }
  .dh { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 12px 22px; border-bottom: 1px solid var(--line); }
  h2 { font-size: 16px; margin: 0; }
  .icon-btn { width: 32px; height: 32px; padding: 0; }
  .db { display: grid; grid-template-columns: 260px 290px 1fr; min-height: 0; }
  .col { overflow: auto; padding: 14px; min-height: 0; }
  .col + .col { border-left: 1px solid var(--line); }
  .colt { font-size: 12px; color: var(--faint); font-weight: 600; margin: 0 0 8px 6px; }
  .goals, .mods { display: grid; gap: 4px; }
  .goal, .mod { justify-content: flex-start; text-align: left; background: transparent; box-shadow: none; white-space: normal; }
  .goal { gap: 10px; padding: 8px 10px; color: var(--muted); }
  .goal :global(.icon) { color: var(--accent); }
  .goal.on { background: var(--accent-weak) !important; color: var(--accent-ink); font-weight: 600; }
  .mod { gap: 10px; padding: 8px; border-radius: 10px; }
  .mod.on { background: var(--accent-weak) !important; box-shadow: inset 0 0 0 1px var(--accent-line); }
  .mt { display: grid; }
  .mt b { font-size: 13px; line-height: 1.4; }
  .id { font: 11px var(--mono); color: var(--faint); font-weight: 400; }
  .rec, .cur { font-size: 11px; border-radius: 4px; padding: 0 5px; margin-left: 6px; font-weight: 600; }
  .rec { color: var(--accent); background: #fff; box-shadow: inset 0 0 0 1px var(--accent-line); }
  .cur { color: var(--muted); background: var(--surface-2); }
  .detail { padding: 18px 22px; line-height: 1.7; }
  .fig { background: var(--surface); border-radius: 12px; padding: 12px; display: grid; place-items: center; margin-bottom: 14px; }
  h3 { font-size: 18px; margin: 0; }
  .catch { color: var(--muted); margin: 2px 0 12px; }
  p { margin: 0 0 6px; }
  h4 { font-size: 12px; color: var(--faint); margin: 16px 0 4px; }
  .req { display: flex; gap: 8px; flex-wrap: wrap; }
  .req span { background: var(--surface); border-radius: 6px; padding: 1px 8px; font-size: 12px; color: var(--muted); }
  ul { margin: 0; padding-left: 18px; color: var(--muted); }
  a { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .ref { color: var(--faint); font-size: 12px; margin-top: 4px; }
  .df { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--line); }
  .df button { padding: 7px 16px; }
</style>
