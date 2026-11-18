<script lang="ts">
  // 候補の自動生成ダイアログ。
  //  - 新しい表として作る: 変数（説明変数）と目的変数の列名から、組み合わせを網羅した候補表を作る
  //  - 今の表に追加: 今の表の説明変数の値をもとに組み合わせを作り、まだ無いものだけを末尾に足す
  // 生成そのものは lib/data/generate.ts（画面から独立した関数）が担う。
  import { app } from "../lib/app.svelte";
  import { colsOf, isNum, type Role } from "../lib/data/dataset";
  import { columnNames, generate, MAX_ROWS, mergeInto, plan, splitList, countOf, type VarSpec } from "../lib/data/generate";

  type Mode = "new" | "append";
  let mode = $state<Mode>(app.generatorOpen ?? "new");
  let dialog: HTMLDialogElement;
  $effect(() => dialog.showModal());
  const close = () => (app.generatorOpen = null);

  // ---- 初期値
  const newDefaults = (): VarSpec[] => [
    { kind: "range", name: "温度_C", min: "60", max: "100", step: "10" },
    { kind: "list", name: "時間_h", values: "1, 2, 4" },
  ];
  /** 今の表の説明変数から、変数の定義を作る（値の種類が少なければ列挙、多ければ範囲） */
  function fromDataset(): VarSpec[] {
    const ds = app.dataset;
    if (!ds) return newDefaults();
    return colsOf(ds, "x").map((c) => {
      const vals = [...new Set(ds.rows.map((r) => r[c]).filter((v) => isNum(v)))].map(Number).sort((a, b) => a - b);
      if (vals.length <= 30) return { kind: "list", name: ds.header[c], values: vals.join(", ") } as VarSpec;
      const step = Math.min(...vals.slice(1).map((v, i) => v - vals[i]));
      return { kind: "range", name: ds.header[c], min: String(vals[0]), max: String(vals.at(-1)), step: String(Number(step.toPrecision(6))) } as VarSpec;
    });
  }

  let vars = $state<VarSpec[]>(app.generatorOpen === "append" ? fromDataset() : newDefaults());
  let objectives = $state("収率_%");
  let fileName = $state("candidates.csv");

  function switchMode(m: Mode) {
    mode = m;
    vars = m === "append" ? fromDataset() : newDefaults();
  }

  const KINDS: { kind: VarSpec["kind"]; label: string; hint: string }[] = [
    { kind: "range", label: "範囲", hint: "最小〜最大を一定の刻みで" },
    { kind: "list", label: "値の列挙", hint: "使う値をカンマ区切りで" },
    { kind: "simplex", label: "組成（合計一定）", hint: "複数の元素の合計が一定" },
    { kind: "blank", label: "空欄", hint: "値はあとで表に入力" },
  ];
  function blankOf(kind: VarSpec["kind"], name = ""): VarSpec {
    switch (kind) {
      case "range":
        return { kind, name, min: "0", max: "1", step: "0.1" };
      case "list":
        return { kind, name, values: "" };
      case "simplex":
        return { kind, names: "A, B, C", total: "1", step: "0.1", allowLess: false };
      case "blank":
        return { kind, name };
    }
  }
  const nameOf = (v: VarSpec) => (v.kind === "simplex" ? "" : v.name);
  function add(kind: VarSpec["kind"]) {
    vars = [...vars, blankOf(kind, kind === "simplex" ? "" : `変数${vars.length + 1}`)];
  }
  function changeKind(i: number, kind: VarSpec["kind"]) {
    vars[i] = blankOf(kind, nameOf(vars[i]));
  }

  // ---- 見積もりとプレビュー
  const objNames = $derived(mode === "new" ? splitList(objectives) : []);
  const p = $derived(plan(vars, objNames));
  const generated = $derived(p.errors.length === 0 ? generate(vars, objNames) : null);
  const merged = $derived(mode === "append" && generated && app.dataset ? mergeInto(app.dataset, generated) : null);
  const appendError = $derived(merged?.missing.length ? `今の表にない列があります: ${merged.missing.join(", ")}（列名を合わせるか、新しい表として作ってください）` : "");
  const canCreate = $derived(!!generated && !appendError && (mode === "new" || (merged?.rows.length ?? 0) > 0));

  function create() {
    if (!generated) return;
    if (mode === "new") {
      const roles: Role[] = generated.header.map((_, i) => (i < columnNames(vars).length ? "x" : "y"));
      const name = fileName.trim() || "candidates.csv";
      app.createTable(name.endsWith(".csv") ? name : `${name}.csv`, generated, roles);
      app.toast("success", `${generated.rows.length.toLocaleString()} 行の候補表を作りました`);
    } else if (merged) {
      app.appendRows(merged.rows, `${merged.rows.length.toLocaleString()} 行を追加しました${merged.skipped ? `（すでにある ${merged.skipped} 行は除外）` : ""}`);
    }
    dialog.close();
  }
</script>

<dialog bind:this={dialog} onclose={close}>
  <div class="box">
    <header>
      <h2>{mode === "new" ? "🧮 新しい候補表を作る" : "🧮 候補を生成して追加"}</h2>
      {#if app.dataset}
        <div class="seg" role="group" aria-label="作り方">
          <button class:on={mode === "new"} onclick={() => switchMode("new")}>新しい表として作る</button>
          <button class:on={mode === "append"} onclick={() => switchMode("append")}>今の表に追加</button>
        </div>
      {/if}
    </header>

    <div class="body">
      <p class="lead muted">
        変数ごとに取りうる値を決めると、<b>すべての組み合わせ</b>を 1 行ずつ並べた候補表を作ります。
        {#if mode === "append"}<br />今の表と同じ組み合わせの行は追加しません（実験済みの行はそのまま残ります）。{/if}
      </p>

      <h3><span class="chip x">説明変数</span> 実験条件</h3>
      <div class="vars">
        {#each vars as v, i}
          {@const c = countOf(v)}
          <div class="var">
            <select value={v.kind} onchange={(e) => changeKind(i, (e.target as HTMLSelectElement).value as VarSpec["kind"])} title="値の決め方">
              {#each KINDS as k}<option value={k.kind}>{k.label}</option>{/each}
            </select>
            {#if v.kind === "simplex"}
              <input class="names" bind:value={v.names} placeholder="元素（カンマ区切り）例: Ag, Au, Pt" />
              <label>合計 <input class="n" bind:value={v.total} inputmode="decimal" /></label>
              <label>刻み <input class="n" bind:value={v.step} inputmode="decimal" /></label>
              <label class="chk" title="合計が指定値より小さい組み合わせも含める"><input type="checkbox" bind:checked={v.allowLess} /> 合計以下も含める</label>
            {:else}
              <input class="name" bind:value={v.name} placeholder="列名" />
              {#if v.kind === "range"}
                <label>最小 <input class="n" bind:value={v.min} inputmode="decimal" /></label>
                <label>最大 <input class="n" bind:value={v.max} inputmode="decimal" /></label>
                <label>刻み <input class="n" bind:value={v.step} inputmode="decimal" /></label>
              {:else if v.kind === "list"}
                <input class="list" bind:value={v.values} placeholder="値をカンマ区切りで 例: 1, 2, 4, 8" />
              {:else}
                <span class="muted small">値はあとで表に入力（1 通りとして数えます）</span>
              {/if}
            {/if}
            <span class="count" class:bad={typeof c === "string"} title={typeof c === "string" ? c : ""}>{typeof c === "number" ? `${c.toLocaleString()} 通り` : "⚠"}</span>
            <button class="ghost small del" onclick={() => (vars = vars.filter((_, j) => j !== i))} aria-label="この変数を削除">✕</button>
          </div>
        {/each}
      </div>
      <div class="adds">
        {#each KINDS as k}
          <button class="small" onclick={() => add(k.kind)} title={k.hint}>＋ {k.label}</button>
        {/each}
      </div>

      {#if mode === "new"}
        <h3><span class="chip y">目的変数</span> 測る結果</h3>
        <div class="row">
          <input class="list" bind:value={objectives} placeholder="列名（カンマ区切りで複数可）例: 収率_%, 選択率" />
          <span class="muted small">未実験として空欄で作られます</span>
        </div>
        <div class="row">
          <label class="fname">ファイル名 <input bind:value={fileName} /></label>
        </div>
      {/if}

      <h3>プレビュー</h3>
      {#if p.errors.length}
        <ul class="errors">{#each p.errors as e}<li>{e}</li>{/each}</ul>
      {:else if appendError}
        <ul class="errors"><li>{appendError}</li></ul>
      {:else if generated}
        <div class="formula">
          {p.counts.map((c) => c.toLocaleString()).join(" × ")} = <b>{p.total.toLocaleString()} 行</b>
          {#if merged}
            → 新しく追加 <b>{merged.rows.length.toLocaleString()} 行</b>{#if merged.skipped}（すでにある {merged.skipped.toLocaleString()} 行は除外）{/if}
          {/if}
        </div>
        <div class="preview">
          <table>
            <thead><tr>{#each generated.header as h, i}<th class={i < columnNames(vars).length ? "x" : "y"}>{h}</th>{/each}</tr></thead>
            <tbody>
              {#each generated.rows.slice(0, 5) as r}<tr>{#each r as c}<td>{c}</td>{/each}</tr>{/each}
              {#if generated.rows.length > 5}<tr><td colspan={generated.header.length} class="muted dots">⋮ ほか {(generated.rows.length - 5).toLocaleString()} 行</td></tr>{/if}
            </tbody>
          </table>
        </div>
      {/if}
      <p class="muted small">上限は {MAX_ROWS.toLocaleString()} 行です。</p>
    </div>

    <footer>
      <button class="ghost" onclick={() => dialog.close()}>キャンセル</button>
      <button class="primary" disabled={!canCreate} onclick={create}>
        {mode === "new" ? `${p.errors.length ? "" : p.total.toLocaleString() + " 行の"}表を作る` : `${merged?.rows.length?.toLocaleString() ?? 0} 行を追加`}
      </button>
    </footer>
  </div>
</dialog>

<style>
  dialog {
    border: none;
    border-radius: 12px;
    padding: 0;
    width: min(860px, 94vw);
    max-height: 90vh;
    box-shadow: 0 24px 64px rgba(16, 24, 40, 0.3);
  }
  dialog::backdrop { background: rgba(16, 24, 40, 0.4); }
  .box { display: flex; flex-direction: column; max-height: 90vh; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px 10px; border-bottom: 1px solid var(--line); }
  h2 { font-size: 17px; margin: 0; }
  .seg { display: inline-flex; border: 1px solid var(--line-strong); border-radius: 8px; overflow: hidden; }
  .seg button { border: none; border-radius: 0; padding: 5px 12px; font-size: 12px; }
  .seg button.on { background: var(--accent); color: #fff; font-weight: 600; }
  .body { overflow: auto; padding: 12px 20px 8px; }
  .lead { margin: 0 0 6px; line-height: 1.7; font-size: 13px; }
  h3 { font-size: 13px; margin: 14px 0 8px; display: flex; align-items: center; gap: 8px; }
  .vars { display: grid; gap: 6px; }
  .var {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fafbfd;
    flex-wrap: wrap;
  }
  .var label { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--muted); }
  .name { width: 140px; }
  .names { width: 180px; }
  .n { width: 72px; text-align: right; }
  .list { flex: 1; min-width: 200px; }
  .chk { cursor: pointer; }
  .count { margin-left: auto; font-size: 12px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .count.bad { color: var(--err); font-weight: 700; }
  .del { color: var(--muted); }
  .adds { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .fname { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
  .fname input { width: 240px; }
  .small { font-size: 12px; }
  .formula { font-size: 14px; margin-bottom: 8px; }
  .preview { overflow-x: auto; }
  table { border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid var(--line); padding: 3px 10px; text-align: right; white-space: nowrap; }
  th.x { background: var(--x-bg); color: var(--x); }
  th.y { background: var(--y-bg); color: var(--y); }
  .dots { text-align: center; }
  .errors { color: var(--err); margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.7; }
  footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px 16px; border-top: 1px solid var(--line); }
</style>
