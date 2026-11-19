<script lang="ts">
  // 設定フォーム。modules.ts のパラメータ定義から自動で組み立てる。
  import { app } from "../lib/app.svelte";
  import { visibleOptions, type ParamDef } from "../lib/modules";
  import Icon from "./Icon.svelte";

  const mod = $derived(app.module);
  const ctx = $derived(app.context!);
  const basic = $derived(mod.params.filter((p) => !p.advanced));
  const advanced = $derived(mod.params.filter((p) => p.advanced));
  const v = $derived(app.params);

  const num = (e: Event) => {
    const s = (e.target as HTMLInputElement).value;
    return s === "" ? NaN : Number(s);
  };
  const rangeVal = (key: string, i: number, j: number) => ((v[key] as (number | "")[][] | undefined)?.[i]?.[j] ?? "") as number | "";
  function setRange(key: string, i: number, j: number, s: string) {
    const cur = ((v[key] as (number | "")[][]) ?? []).map((r) => [...r]);
    while (cur.length <= i) cur.push(["", ""]);
    cur[i][j] = s === "" ? "" : Number(s);
    app.setParam(key, cur);
  }
  function toggleIn(key: string, idx: number) {
    const cur = new Set((v[key] as number[]) ?? []);
    cur.has(idx) ? cur.delete(idx) : cur.add(idx);
    app.setParam(key, [...cur].sort((a, b) => a - b));
  }
  const pairKey = (p: number[]) => `${p[0]}-${p[1]}`;
  function togglePair(key: string, pair: number[]) {
    const cur = ((v[key] as number[][]) ?? []).filter((p) => pairKey(p) !== pairKey(pair));
    if (cur.length === ((v[key] as number[][]) ?? []).length) cur.push(pair);
    app.setParam(key, cur);
  }
  const allPairs = $derived(ctx.xCols.flatMap((_, i) => ctx.xCols.slice(i + 1).map((_, k) => [i, i + 1 + k])));
</script>

{#snippet field(p: ParamDef)}
  <div class="field">
    <div class="label">{p.label}</div>
    {#if p.kind === "select"}
      {@const opts = visibleOptions(mod, p, ctx)}
      <select value={v[p.key]} onchange={(e) => app.setParam(p.key, (e.target as HTMLSelectElement).value)}>
        {#each opts as o}<option value={o.value}>{o.label}</option>{/each}
      </select>
      {@const cur = opts.find((o) => o.value === v[p.key])}
      {#if cur?.help}<div class="help">{cur.help}</div>{/if}
    {:else if p.kind === "number"}
      <input
        type="number"
        min={p.min}
        max={p.max}
        step={p.step ?? "any"}
        value={Number.isFinite(v[p.key] as number) ? v[p.key] : ""}
        onchange={(e) => app.setParam(p.key, num(e))}
      />
    {:else if p.kind === "ranges"}
      <div class="ranges">
        {#each ctx.yCols as y, i}
          <span class="chip y">{y}</span>
          <input type="number" step="any" placeholder="下限なし" value={rangeVal(p.key, i, 0)} onchange={(e) => setRange(p.key, i, 0, (e.target as HTMLInputElement).value)} />
          <span class="muted">〜</span>
          <input type="number" step="any" placeholder="上限なし" value={rangeVal(p.key, i, 1)} onchange={(e) => setRange(p.key, i, 1, (e.target as HTMLInputElement).value)} />
        {/each}
      </div>
    {:else if p.kind === "columns"}
      <div class="checks">
        {#each ctx.xCols as x, i}
          <label class="check"><input type="checkbox" checked={((v[p.key] as number[]) ?? []).includes(i)} onchange={() => toggleIn(p.key, i)} /> {x}</label>
        {/each}
      </div>
    {:else if p.kind === "pairs"}
      <div class="checks">
        {#each allPairs as pair}
          <label class="check">
            <input type="checkbox" checked={((v[p.key] as number[][]) ?? []).some((q) => pairKey(q) === pairKey(pair))} onchange={() => togglePair(p.key, pair)} />
            {ctx.xCols[pair[0]]}–{ctx.xCols[pair[1]]}
          </label>
        {/each}
      </div>
    {:else if p.kind === "colRanges"}
      <div class="ranges">
        {#each ctx.xCols as x, i}
          <span class="chip x">{x}</span>
          <input type="number" step="1" value={rangeVal(p.key, i, 0)} onchange={(e) => setRange(p.key, i, 0, (e.target as HTMLInputElement).value)} />
          <span class="muted">〜</span>
          <input type="number" step="1" value={rangeVal(p.key, i, 1)} onchange={(e) => setRange(p.key, i, 1, (e.target as HTMLInputElement).value)} />
        {/each}
      </div>
    {/if}
    {#if p.help && p.kind !== "select"}<div class="help">{p.help}</div>{/if}
  </div>
{/snippet}

<div class="form">
  <div class="field">
    <div class="label">{mod.proposesNewRows ? "傾斜の分割数（提案数）" : "提案数"}<span>{mod.proposesNewRows ? "" : "1 回の実験でまとめて試せる数"}</span></div>
    <div class="stepper">
      <button onclick={() => { app.nProposals = Math.max(1, (app.nProposals || 1) - 1); app.scheduleSave(); }} aria-label="減らす"><Icon name="minus" size={14} /></button>
      <input type="number" min="1" bind:value={app.nProposals} onchange={() => app.scheduleSave()} />
      <button onclick={() => { app.nProposals = (app.nProposals || 0) + 1; app.scheduleSave(); }} aria-label="増やす"><Icon name="plus" size={14} /></button>
    </div>
  </div>

  {#each basic as p (p.key)}{@render field(p)}{/each}

  {#if mod.direction !== "none" && ctx.nObjectives > 0}
    <div class="field">
      <div class="label">良い方向</div>
      {#each app.summary?.yCols ?? [] as c}
        {@const d = app.dataset!.directions[c]}
        <div class="dirrow">
          <span class="yn" title={app.dataset!.header[c]}><i class="mark y"></i><span class="ynt">{app.dataset!.header[c]}</span></span>
          <div class="seg" role="group">
            <button class:on={d === "max"} aria-pressed={d === "max"} onclick={() => app.setDirection(c, "max")}>▲ 大きいほど良い</button>
            <button class:on={d === "min"} aria-pressed={d === "min"} onclick={() => app.setDirection(c, "min")}>▼ 小さいほど良い</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <details>
    <summary><Icon name="right" size={14} />詳細設定</summary>
    {#each advanced as p (p.key)}{@render field(p)}{/each}
    <div class="field">
      <div class="label">乱数の種（再現したいとき）</div>
      <input
        type="number"
        step="1"
        placeholder="指定しない"
        value={app.seed ?? ""}
        onchange={(e) => {
          const s = (e.target as HTMLInputElement).value;
          app.seed = s === "" ? null : Math.trunc(Number(s));
          app.scheduleSave();
        }}
      />
      <div class="help">同じ値にすると、同じデータから同じ提案が出ます</div>
    </div>
  </details>
</div>

<style>
  .form { display: grid; gap: 16px; }
  .field { display: grid; gap: 6px; }
  .label { font-size: 13px; font-weight: 600; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .label span { font-weight: 400; font-size: 12px; color: var(--faint); }
  .help { font-size: 12px; color: var(--muted); line-height: 1.55; }
  .stepper { display: inline-flex; align-items: stretch; border: 1px solid var(--line-strong); border-radius: 8px; overflow: hidden; width: fit-content; }
  .stepper button { width: 32px; padding: 0; border-radius: 0; background: #fff; box-shadow: none; color: var(--muted); }
  .stepper input { width: 52px; text-align: center; border: 0; border-left: 1px solid var(--line); border-right: 1px solid var(--line); border-radius: 0; font-weight: 600; height: 30px; }
  .ranges { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 6px; align-items: center; }
  .ranges input { width: 100%; }
  .checks { display: flex; flex-wrap: wrap; gap: 4px 12px; }
  .check { font-size: 12px; display: inline-flex; gap: 4px; align-items: center; }
  .dirrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .yn { color: var(--y); font-weight: 600; display: inline-flex; align-items: center; min-width: 0; }
  .ynt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .seg { display: inline-flex; background: var(--surface); border-radius: 8px; padding: 3px; box-shadow: inset 0 0 0 1px var(--line); flex: none; }
  .seg button { padding: 2px 9px; border-radius: 6px; background: transparent; box-shadow: none; color: var(--muted); font-size: 12px; }
  .seg button.on { background: #fff; color: var(--text); font-weight: 600; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--line); }
  details summary { cursor: pointer; font-size: 12px; color: var(--muted); list-style: none; display: flex; align-items: center; gap: 4px; }
  details summary::-webkit-details-marker { display: none; }
  details[open] summary :global(.icon) { transform: rotate(90deg); }
  details[open] { display: grid; gap: 14px; }
</style>
