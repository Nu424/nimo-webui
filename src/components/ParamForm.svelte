<script lang="ts">
  // 設定フォーム。modules.ts のパラメータ定義から自動で組み立てる。
  import { app } from "../lib/app.svelte";
  import { visibleOptions, type ParamDef } from "../lib/modules";

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
    <div class="label">{mod.proposesNewRows ? "傾斜の分割数（提案数）" : "提案数（次に実験する数）"}</div>
    <div class="stepper">
      <button class="small" onclick={() => (app.nProposals = Math.max(1, app.nProposals - 1))} aria-label="減らす">−</button>
      <input type="number" min="1" bind:value={app.nProposals} onchange={() => app.scheduleSave()} />
      <button class="small" onclick={() => (app.nProposals += 1)} aria-label="増やす">＋</button>
      <span class="muted help-inline">1 回の実験でまとめて試せる数</span>
    </div>
  </div>

  {#each basic as p (p.key)}{@render field(p)}{/each}

  {#if mod.direction !== "none" && ctx.nObjectives > 0}
    <div class="field">
      <div class="label">良い方向</div>
      <div class="dirs">
        {#each app.summary?.yCols ?? [] as c}
          {@const d = app.dataset!.directions[c]}
          <button class="small dir" class:min={d === "min"} onclick={() => app.setDirection(c, d === "max" ? "min" : "max")}>
            <span class="chip y">{app.dataset!.header[c]}</span>
            {d === "max" ? "▲ 大きいほど良い" : "▼ 小さいほど良い"}
          </button>
        {/each}
      </div>
      <div class="help">クリックで切替（表の見出しからも変えられます）</div>
    </div>
  {/if}

  <details>
    <summary>詳細設定</summary>
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
  .form { display: grid; gap: 12px; }
  .field { display: grid; gap: 4px; }
  .label { font-size: 12px; font-weight: 600; }
  .help { font-size: 11px; color: var(--muted); line-height: 1.5; }
  .help-inline { font-size: 11px; }
  .stepper { display: flex; align-items: center; gap: 4px; }
  .stepper input { width: 56px; text-align: center; }
  .ranges { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 4px 6px; align-items: center; }
  .ranges input { width: 100%; }
  .checks { display: flex; flex-wrap: wrap; gap: 4px 12px; }
  .check { font-size: 12px; display: inline-flex; gap: 4px; align-items: center; }
  .dirs { display: flex; flex-wrap: wrap; gap: 6px; }
  .dir { display: inline-flex; align-items: center; gap: 6px; }
  details summary { cursor: pointer; font-size: 12px; color: var(--muted); margin-bottom: 8px; }
  details[open] { display: grid; gap: 12px; }
</style>
