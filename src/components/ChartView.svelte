<script lang="ts">
  // グラフタブ: 候補全体の散布図。
  //  - 軸は説明変数・目的変数・予測値から選べる（目的変数が 2 つ以上なら、既定は目的変数どうし＝パレート図）
  //  - 色は目的変数（観測値。未実験は予測値）またはラベル
  //  - 実験済み=塗りつぶし、未実験=小さく半透明、提案=★。点をクリックすると候補表のその行へ
  // 目的変数の軸で未実験の行は、予測値があれば予測位置に白抜きで描く（モデルの見立てが見える）。
  import { onMount } from "svelte";
  import { app } from "../lib/app.svelte";
  import { isNum, isBlank, colsOf, rowState } from "../lib/data/dataset";
  import type * as PL from "plotly.js";

  type Axis = { id: string; label: string; kind: "col" | "pred"; index: number };

  // 検証済みパレット（dataviz スキルの参照パレット）: カテゴリは固定順、数値は青の 1 色濃淡
  const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
  const SEQ = [
    [0, "#cde2fb"],
    [0.25, "#86b6ef"],
    [0.5, "#3987e5"],
    [0.75, "#1c5cab"],
    [1, "#0d366b"],
  ];

  let el: HTMLDivElement;
  let Plotly: typeof PL | null = $state(null);

  const ds = $derived(app.dataset!);
  const run = $derived(app.lastRun);
  const preds = $derived(app.runStale ? null : (run?.predictions ?? null));
  const escHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

  const axes = $derived.by((): Axis[] => {
    app.version;
    const cols: Axis[] = ds.header.flatMap((h, i) => (ds.roles[i] === "ignore" ? [] : [{ id: `c${i}`, label: h, kind: "col" as const, index: i }]));
    const p: Axis[] = (preds?.columns ?? []).flatMap((c, k) => (c.kind === "label" ? [] : [{ id: `p${k}`, label: c.label, kind: "pred" as const, index: k }]));
    return [...cols, ...p];
  });
  const colorChoices = $derived.by((): Axis[] => {
    const ys = colsOf(ds, "y").map((i) => ({ id: `c${i}`, label: ds.header[i], kind: "col" as const, index: i }));
    const p: Axis[] = (preds?.columns ?? []).map((c, k) => ({ id: `p${k}`, label: c.label, kind: "pred" as const, index: k }));
    return [...ys, ...p];
  });

  let xId = $state("");
  let yId = $state("");
  let colorId = $state("");

  // 既定の軸: 目的変数が 2 つ以上 → 目的変数どうし。そうでなければ説明変数の 1・2 列目
  $effect(() => {
    const ids = new Set(axes.map((a) => a.id));
    const xs = colsOf(ds, "x");
    const ys = colsOf(ds, "y");
    if (!ids.has(xId) || !ids.has(yId)) {
      if (ys.length >= 2) [xId, yId] = [`c${ys[0]}`, `c${ys[1]}`];
      else if (xs.length >= 2) [xId, yId] = [`c${xs[0]}`, `c${xs[1]}`];
      else [xId, yId] = [`c${xs[0] ?? 0}`, `c${ys[0] ?? 0}`];
    }
    if (!colorChoices.some((c) => c.id === colorId)) colorId = colorChoices[0]?.id ?? "";
  });

  onMount(async () => {
    Plotly = (await import("plotly.js-basic-dist-min")).default;
  });

  /** 予測の列のうち、目的変数 name の予測平均の番号 */
  const meanIndexOf = (name: string) => preds?.columns.findIndex((c) => c.kind === "mean" && c.target === name) ?? -1;

  /** 行 r の軸 a の値。目的変数が空欄なら予測平均で代用（predicted=true） */
  function valueOf(a: Axis | undefined, r: number): { v: number | string | null; predicted: boolean } {
    if (!a) return { v: null, predicted: false };
    if (a.kind === "pred") {
      const v = preds?.byRow[r]?.[a.index];
      return { v: v === undefined || v === "" ? null : v, predicted: true };
    }
    const raw = ds.rows[r][a.index];
    if (!isBlank(raw)) return { v: isNum(raw) ? Number(raw) : raw, predicted: false };
    if (ds.roles[a.index] === "y") {
      // 数値の目的変数は予測平均、ラベルの目的変数は推定ラベルで代用する
      const k = meanIndexOf(ds.header[a.index]);
      const v = k >= 0 ? preds?.byRow[r]?.[k] : undefined;
      if (typeof v === "number") return { v, predicted: true };
      const kl = preds?.columns.findIndex((c) => c.kind === "label") ?? -1;
      const l = kl >= 0 ? preds?.byRow[r]?.[kl] : undefined;
      if (typeof l === "string" && l !== "") return { v: l, predicted: true };
    }
    return { v: null, predicted: false };
  }

  function draw() {
    if (!Plotly || !el) return;
    const ax = axes.find((a) => a.id === xId);
    const ay = axes.find((a) => a.id === yId);
    const ac = colorChoices.find((a) => a.id === colorId);
    const yCols = colsOf(ds, "y");
    const proposed = app.proposedRows;

    // 色の値を先に集めて、数値かラベルかを判定する
    const colorVals = ds.rows.map((_, r) => valueOf(ac, r).v);
    const numericColor = colorVals.every((v) => v === null || typeof v === "number");
    const labels = numericColor ? [] : [...new Set(colorVals.filter((v): v is string => v !== null).map(String))].sort();
    const nums = colorVals.filter((v): v is number => typeof v === "number");
    const cmin = Math.min(...nums), cmax = Math.max(...nums);

    type Group = { name: string; rows: number[] };
    const groups: Record<string, Group> = {
      pending: { name: "未実験", rows: [] },
      predicted: { name: "未実験（予測の位置）", rows: [] },
      observed: { name: "実験済み", rows: [] },
      proposal: { name: "★ 提案", rows: [] },
    };
    ds.rows.forEach((_, r) => {
      const x = valueOf(ax, r), y = valueOf(ay, r);
      if (x.v === null || y.v === null) return;
      if (proposed.has(r)) groups.proposal.rows.push(r);
      else if (rowState(ds, yCols, r) === "observed") groups.observed.rows.push(r);
      else if (x.predicted || y.predicted) groups.predicted.rows.push(r);
      else groups.pending.rows.push(r);
    });

    const hover = (r: number) => {
      const parts = [`<b>行 ${r + 1}</b>${proposed.has(r) ? ` ★${proposed.get(r)}` : ""}`];
      ds.header.forEach((h, i) => {
        if (ds.roles[i] !== "ignore") parts.push(`${escHtml(h)}: ${ds.rows[r][i] === "" ? "—" : escHtml(ds.rows[r][i])}`);
      });
      preds?.columns.forEach((c, k) => {
        const v = preds.byRow[r]?.[k];
        if (v !== undefined && v !== "") parts.push(`<span style="color:#7c5cc4">${escHtml(c.label)}: ${typeof v === "number" ? v.toPrecision(4) : escHtml(v)}</span>`);
      });
      return parts.join("<br>");
    };

    const markerColor = (rows: number[]) => {
      const vs = rows.map((r) => colorVals[r]);
      if (numericColor) return vs.map((v) => (typeof v === "number" ? v : null));
      return vs.map((v) => (v === null ? "#c7cbd2" : CATEGORICAL[labels.indexOf(String(v)) % CATEGORICAL.length]));
    };
    const traces: Partial<PL.PlotData>[] = [];
    const base = (g: Group): Partial<PL.PlotData> => ({
      type: "scatter",
      mode: "markers",
      name: g.name,
      x: g.rows.map((r) => valueOf(ax, r).v) as PL.Datum[],
      y: g.rows.map((r) => valueOf(ay, r).v) as PL.Datum[],
      customdata: g.rows as unknown as PL.Datum[],
      text: g.rows.map(hover),
      hovertemplate: "%{text}<extra></extra>",
    });
    const colorScale = numericColor && nums.length > 0
      ? { colorscale: SEQ as unknown as PL.ColorScale, cmin, cmax }
      : {};
    if (groups.pending.rows.length)
      traces.push({ ...base(groups.pending), marker: { size: 6, color: markerColor(groups.pending.rows), ...colorScale, opacity: 0.35, line: { width: 0 } } as PL.PlotMarker });
    if (groups.predicted.rows.length)
      traces.push({ ...base(groups.predicted), marker: { size: 7, symbol: "circle-open", color: markerColor(groups.predicted.rows), ...colorScale, opacity: 0.7, line: { width: 1.5 } } as PL.PlotMarker });
    if (groups.observed.rows.length)
      traces.push({
        ...base(groups.observed),
        marker: {
          size: 14,
          color: markerColor(groups.observed.rows),
          ...colorScale,
          showscale: numericColor && nums.length > 0,
          colorbar: { title: { text: ac?.label ?? "", side: "right" }, thickness: 10, outlinewidth: 0, len: 0.8 },
          line: { width: 2, color: "#1f2430" },
        } as PL.PlotMarker,
      });
    if (groups.proposal.rows.length)
      traces.push({
        ...base(groups.proposal),
        mode: "text+markers" as PL.PlotData["mode"],
        textposition: "top center",
        texttemplate: groups.proposal.rows.map((r) => `★${proposed.get(r)}`),
        textfont: { color: "#6b4e00", size: 12 },
        marker: { size: 20, symbol: "star", color: "#eda100", line: { width: 1.5, color: "#6b4e00" } },
      });
    // ラベルの凡例（色だけに頼らないよう、ラベル名を凡例に出す）
    if (!numericColor)
      labels.forEach((l, i) =>
        traces.push({ type: "scatter", mode: "markers", x: [null], y: [null], name: `${ac?.label}: ${l}`, marker: { size: 10, color: CATEGORICAL[i % CATEGORICAL.length] }, hoverinfo: "skip" }),
      );

    const axisStyle = (title: string) => ({
      title: { text: title, font: { size: 13 } },
      gridcolor: "#eef0f3",
      zerolinecolor: "#dfe3e8",
      linecolor: "#cfd4dc",
      ticks: "outside" as const,
      tickcolor: "#cfd4dc",
    });
    Plotly.react(
      el,
      traces as PL.Data[],
      {
        margin: { l: 64, r: 24, t: 16, b: 56 },
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        font: { family: "Segoe UI, Hiragino Sans, Noto Sans JP, Meiryo, sans-serif", size: 12, color: "#1f2430" },
        xaxis: axisStyle(ax?.label ?? ""),
        yaxis: axisStyle(ay?.label ?? ""),
        legend: { orientation: "h", y: -0.16, x: 0 },
        hoverlabel: { bgcolor: "#ffffff", bordercolor: "#cfd4dc", font: { color: "#1f2430" } },
        dragmode: "pan",
      },
      { responsive: true, displaylogo: false, scrollZoom: true, modeBarButtonsToRemove: ["select2d", "lasso2d"] },
    );
  }

  let bound = false;
  $effect(() => {
    // 依存を明示して再描画する
    app.version;
    run;
    xId;
    yId;
    colorId;
    if (!Plotly) return;
    draw();
    if (!bound && el) {
      bound = true;
      (el as unknown as PL.PlotlyHTMLElement).on("plotly_click", (e) => {
        const r = e.points[0]?.customdata as unknown as number | undefined;
        if (typeof r === "number") app.jumpToRow(r);
      });
    }
  });

  function swap() {
    [xId, yId] = [yId, xId];
  }
</script>

<div class="wrap">
  <div class="controls">
    <label>横軸 <select bind:value={xId}>{#each axes as a}<option value={a.id}>{a.label}</option>{/each}</select></label>
    <button class="ghost small" onclick={swap} title="縦軸と横軸を入れ替え">⇄</button>
    <label>縦軸 <select bind:value={yId}>{#each axes as a}<option value={a.id}>{a.label}</option>{/each}</select></label>
    <label>色 <select bind:value={colorId}>{#each colorChoices as a}<option value={a.id}>{a.label}</option>{/each}</select></label>
    <span class="grow"></span>
    <span class="muted hint">点をクリックで候補表のその行へ ・ ホイールで拡大</span>
  </div>
  <div class="plot" bind:this={el}>
    {#if !Plotly}<div class="loading muted">グラフを準備中…</div>{/if}
  </div>
</div>

<style>
  .wrap { position: absolute; inset: 0; display: flex; flex-direction: column; }
  .controls { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
  select { max-width: 200px; }
  .grow { flex: 1; }
  .hint { font-size: 11px; }
  .plot { flex: 1; min-height: 0; position: relative; }
  .loading { position: absolute; inset: 0; display: grid; place-items: center; }
</style>
