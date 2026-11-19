<script lang="ts">
  // 右パネル。表を開いた後は「今の手法（1 行）→ 設定 → 実行」だけを置き、毎回触る設定を画面内に収める。
  // 手法の変更はダイアログ（MethodDialog）で行う。表を開く前は、何ができるかの見通しのために手法の一覧を出す。
  import { app } from "../lib/app.svelte";
  import { engine } from "../lib/nimo/engine.svelte";
  import { GOALS, MODULES, type GoalId } from "../lib/modules";
  import Icon from "./Icon.svelte";
  import ModuleFigure from "./ModuleFigure.svelte";
  import ParamForm from "./ParamForm.svelte";
  import MethodDialog from "./MethodDialog.svelte";

  let pickerOpen = $state(false);

  // ---- 表を開く前の一覧
  let goal = $state<GoalId>(app.module.goals[0]);
  $effect(() => {
    if (!app.module.goals.includes(goal)) goal = app.module.goals[0];
  });
  const list = $derived(MODULES.filter((m) => m.goals.includes(goal)));
  function pickGoal(g: GoalId) {
    goal = g;
    const first = MODULES.find((m) => m.goals.includes(g));
    if (first && !app.module.goals.includes(g)) app.selectModule(first.id);
  }

  // 実行中の経過秒
  let now = $state(Date.now());
  $effect(() => {
    if (engine.status !== "running") return;
    const t = setInterval(() => (now = Date.now()), 200);
    return () => clearInterval(t);
  });
  const elapsed = $derived(engine.runStartedAt ? ((now - engine.runStartedAt) / 1000).toFixed(1) : "0");
  const errors = $derived(app.issues.filter((i) => i.level === "error"));
  const others = $derived(app.issues.filter((i) => i.level !== "error"));
</script>

<div class="scroll">
  {#if !app.dataset}
    <section>
      <div class="sec-title">やりたいこと</div>
      <div class="goals">
        {#each GOALS as g}
          <button class="goal" class:on={goal === g.id} onclick={() => pickGoal(g.id)} title={g.hint}><Icon name={g.icon} />{g.label}</button>
        {/each}
      </div>
    </section>
    <section>
      <div class="sec-title">手法</div>
      <div class="mods">
        {#each list as m (m.id)}
          {@const on = app.moduleId === m.id}
          <div class="mod" class:on>
            <button class="mod-h" onclick={() => app.selectModule(m.id)} aria-pressed={on}>
              <ModuleFigure figure={m.figure} size="xs" />
              <span class="mt">
                <span class="name"><b>{m.title}</b><span class="id">{m.id}</span>{#if m.id === "PHYSBO" || m.id === "DOE"}<span class="rec">定番</span>{/if}</span>
                <span class="catch">{m.catchphrase}</span>
              </span>
            </button>
            {#if on}<div class="how">{m.how}</div>{/if}
          </div>
        {/each}
      </div>
    </section>
  {:else}
    <section>
      <div class="sec-title">手法</div>
      <div class="method">
        <ModuleFigure figure={app.module.figure} size="xs" />
        <div class="mt">
          <div class="name"><b>{app.module.title}</b><span class="id">{app.module.id}</span></div>
          <div class="catch">{app.module.catchphrase}</div>
        </div>
        <button class="small change" onclick={() => (pickerOpen = true)}>変更</button>
      </div>
    </section>
    <section>
      <div class="sec-title">設定</div>
      <ParamForm />
    </section>
  {/if}
</div>

<div class="run">
  {#if app.dataset}
    {#each errors as i}
      <div class="issue error">
        {i.message}
        {#if i.fix?.action.kind === "module"}
          <button class="small" onclick={() => app.selectModule((i.fix!.action as { id: string }).id)}>{i.fix.label}</button>
        {/if}
      </div>
    {/each}
    {#each others as i}<div class="issue {i.level}">{i.message}</div>{/each}
  {/if}

  {#if app.busy && engine.status !== "running"}
    <div class="running">
      <span class="spinner"></span>
      <span>Python の準備ができ次第、{app.module.id} を実行します…</span>
    </div>
  {:else if engine.status === "running"}
    <div class="running">
      <span class="spinner"></span>
      <span>{app.module.id} で計算中… <span class="num">{elapsed}</span> 秒</span>
      <button class="small" onclick={() => engine.cancel()}>中断</button>
    </div>
  {:else}
    <button
      class="primary go"
      disabled={!app.canRun || engine.status === "error"}
      aria-busy={app.busy}
      onclick={() => app.run()}
      title={!app.dataset ? "まず候補表を開いてください" : "Ctrl+Enter でも実行できます"}
    >
      {#if !app.dataset}
        候補表を開くと実行できます
      {:else if engine.status === "loading" || engine.status === "idle"}
        <Icon name="spark" size={18} />提案を出す <span class="sub">（Python の準備ができ次第）</span>
      {:else}
        <Icon name="spark" size={18} />{app.module.id} で {app.nProposals} 件の提案を出す
      {/if}
    </button>
    {#if app.dataset}<div class="hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> でも実行</div>{/if}
  {/if}
</div>

{#if pickerOpen}<MethodDialog onclose={() => (pickerOpen = false)} />{/if}

<style>
  .scroll { flex: 1; min-height: 0; overflow: auto; }
  section { padding: 16px 18px; }
  section + section { border-top: 1px solid var(--line); }
  .sec-title { font-size: 12px; font-weight: 600; color: var(--faint); margin: 0 0 10px; letter-spacing: 0.02em; }

  .goals { display: grid; gap: 2px; }
  .goal { justify-content: flex-start; gap: 10px; padding: 6px 10px; background: transparent; box-shadow: none; color: var(--muted); text-align: left; white-space: normal; }
  .goal :global(.icon) { color: var(--accent); }
  .goal.on { background: var(--accent-weak) !important; color: var(--accent-ink); font-weight: 600; }

  .mods { display: grid; gap: 8px; }
  .mod { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .mod.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .mod-h { width: 100%; justify-content: flex-start; align-items: center; gap: 10px; padding: 10px; background: transparent; box-shadow: none; text-align: left; white-space: normal; border-radius: 0; }
  .how { padding: 0 12px 12px; font-size: 12px; color: var(--muted); line-height: 1.65; }

  .method { display: flex; gap: 12px; align-items: center; }
  .method .change { margin-left: auto; align-self: flex-start; }
  .mt { display: grid; gap: 1px; min-width: 0; }
  .name { line-height: 1.4; }
  .method .name b { font-size: 15px; }
  .id { font: 11px var(--mono); color: var(--faint); margin-left: 6px; }
  .rec { font-size: 11px; color: var(--accent); background: var(--accent-weak); border-radius: 4px; padding: 0 5px; margin-left: 6px; font-weight: 600; }
  .catch { font-size: 12px; color: var(--muted); line-height: 1.5; }

  .run { border-top: 1px solid var(--line); padding: 14px 18px 14px; display: grid; gap: 8px; }
  .issue { font-size: 12px; border-radius: 8px; padding: 7px 10px; line-height: 1.55; }
  .issue button { margin-top: 6px; display: flex; }
  .issue.error { background: var(--err-bg); color: var(--err); }
  .issue.warning { background: var(--warn-bg); color: var(--warn); }
  .issue.info { background: var(--accent-weak); color: var(--accent-ink); }
  .go { width: 100%; height: 44px; font-size: 14px; border-radius: 10px; }
  .go .sub { font-weight: 400; font-size: 12px; opacity: 0.85; }
  .hint { text-align: center; color: var(--faint); font-size: 12px; }
  .running { display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: 13px; }
  .running > span:nth-child(2) { flex: 1; }
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--line-strong);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
