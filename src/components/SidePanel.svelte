<script lang="ts">
  // 右パネル: ①やりたいこと → ②手法 → ③設定 → ④実行。上から順に決めれば実行できる流れにする。
  import { app } from "../lib/app.svelte";
  import { engine } from "../lib/nimo/engine.svelte";
  import { GOALS, MODULES, type GoalId } from "../lib/modules";
  import ModuleFigure from "./ModuleFigure.svelte";
  import ParamForm from "./ParamForm.svelte";

  let goal = $state<GoalId>(app.module.goals[0]);
  // 手法が外から変わったら（サンプルを開いた等）、やりたいことも合わせる
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
  <section>
    <h3><span class="step">1</span>やりたいことは？</h3>
    <div class="goals">
      {#each GOALS as g}
        <button class="goal" class:active={goal === g.id} onclick={() => pickGoal(g.id)} title={g.hint}>
          <span class="emoji">{g.emoji}</span>
          <span>{g.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h3><span class="step">2</span>手法を選ぶ</h3>
    <div class="modules">
      {#each list as m (m.id)}
        {@const active = app.moduleId === m.id}
        <div class="card" class:active>
          <button class="card-head" onclick={() => app.selectModule(m.id)} aria-pressed={active}>
            <ModuleFigure figure={m.figure} size="sm" />
            <span class="card-text">
              <span class="name"><b>{m.title}</b> <span class="id">{m.id}</span>{#if m.id === "PHYSBO"}<span class="rec">定番</span>{/if}</span>
              <span class="catch">{m.catchphrase}</span>
            </span>
          </button>
          {#if active}
            <div class="detail">
              <p>{m.how}</p>
              <details>
                <summary>使いどころ・注意</summary>
                <ul>{#each m.tips as t}<li>{t}</li>{/each}</ul>
                <div class="meta">
                  <span>目的変数: {m.objectives.min === m.objectives.max ? `${m.objectives.min} 列` : `${m.objectives.min} 列〜`}（{m.objectiveKind === "label" ? "ラベル" : "数値"}）</span>
                  <span>必要な実験済み: {m.minObserved === 0 ? "なしで OK" : `${m.minObserved} 行〜`}</span>
                </div>
                {#if m.docUrl}<a href={m.docUrl} target="_blank" rel="noreferrer">公式ドキュメント ↗</a>{/if}
                {#if m.reference}<div class="meta">出典: {m.reference}</div>{/if}
              </details>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  {#if app.dataset}
    <section>
      <h3><span class="step">3</span>設定</h3>
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
      <span>{app.module.id} で計算中… {elapsed} 秒</span>
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
        ✨ 提案を出す <span class="sub">（Python の準備ができ次第）</span>
      {:else}
        ✨ {app.module.id} で {app.nProposals} 件の提案を出す
      {/if}
    </button>
  {/if}
</div>

<style>
  .scroll { flex: 1; min-height: 0; overflow: auto; padding: 12px 14px; }
  section + section { margin-top: 18px; }
  h3 { font-size: 13px; margin: 0 0 8px; display: flex; align-items: center; gap: 6px; }
  .step {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-size: 11px;
    display: grid;
    place-items: center;
  }
  .goals { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .goal {
    display: flex;
    align-items: center;
    gap: 6px;
    text-align: left;
    font-size: 12px;
    padding: 7px 8px;
    border-color: var(--line);
  }
  .goal.active { border-color: var(--accent); background: var(--accent-weak); color: #1d3aa8; font-weight: 600; }
  .emoji { font-size: 16px; }
  .modules { display: grid; gap: 6px; }
  .card { border: 1px solid var(--line); border-radius: 8px; background: #fff; }
  .card.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .card-head {
    width: 100%;
    display: flex;
    gap: 10px;
    align-items: center;
    border: none;
    background: none;
    text-align: left;
    padding: 8px;
  }
  .card-text { display: grid; gap: 2px; }
  .name { font-size: 13px; }
  .id { font-size: 11px; color: var(--muted); font-family: var(--mono); margin-left: 4px; }
  .rec { font-size: 10px; background: var(--ok-bg); color: var(--ok); border-radius: 4px; padding: 0 4px; margin-left: 4px; }
  .catch { font-size: 12px; color: var(--muted); line-height: 1.45; }
  .detail { padding: 2px 12px 12px; font-size: 12px; line-height: 1.6; }
  .detail p { margin: 0 0 4px; }
  .detail summary { cursor: pointer; color: var(--accent); font-size: 12px; }
  .detail ul { margin: 4px 0; padding-left: 18px; color: var(--text); }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 12px; color: var(--muted); font-size: 11px; margin: 6px 0; }
  .run { border-top: 1px solid var(--line); padding: 10px 14px 12px; display: grid; gap: 6px; background: #fbfbfd; }
  .issue { font-size: 12px; border-radius: 6px; padding: 6px 9px; line-height: 1.5; }
  .issue button { margin-top: 4px; display: block; }
  .issue.error { background: var(--err-bg); color: var(--err); }
  .issue.warning { background: var(--warn-bg); color: #8a5a12; }
  .issue.info { background: var(--accent-weak); }
  .go { width: 100%; padding: 10px; font-size: 14px; }
  .go .sub { font-weight: 400; font-size: 12px; opacity: 0.85; }
  .running { display: flex; align-items: center; gap: 8px; padding: 8px 4px; font-size: 13px; }
  .running span:nth-child(2) { flex: 1; }
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
