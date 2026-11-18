<script lang="ts">
  // 候補表（Handsontable）。
  // - 見出しのチップで列の役割（説明変数/目的変数/使わない）と、最大化/最小化を切り替える
  // - 行は「実験済み/未実験/提案」で色分けし、提案された行は行見出しに ★順位 を出す
  // - 直近の実行の予測値（平均・不確かさ・獲得関数など）を、読み取り専用の列として右に並べる
  // 表に渡すデータは「元の行 + 予測値」のコピーなので、編集は afterChange で元の行へ書き戻す。
  import { onMount, untrack } from "svelte";
  import Handsontable from "handsontable";
  import "handsontable/styles/handsontable.min.css";
  import "handsontable/styles/ht-theme-main.min.css";
  import { app } from "../lib/app.svelte";
  import { rowState, colsOf, type Role } from "../lib/data/dataset";

  /** コンテキストメニューの選択範囲 */
  type Sel = { start: { row: number; col: number }; end: { row: number; col: number } }[];

  let el: HTMLDivElement;
  let hot: Handsontable | null = null;
  /** 表自身の編集で進んだ version（このときは表のデータを作り直さない） */
  let selfVersion = -1;

  const ROLE_LABEL: Record<Role, string> = { x: "説明", y: "目的", ignore: "不使用" };

  const preds = $derived(app.settings.showPredictions ? (app.lastRun?.predictions ?? null) : null);

  function buildData() {
    const ds = app.dataset!;
    const p = preds;
    return ds.rows.map((r, i) => {
      const extra = p ? (p.columns.map((_, k) => p.byRow[i]?.[k] ?? "") as (string | number)[]) : [];
      return [...r, ...extra];
    });
  }

  const fmt = (v: unknown) => {
    if (typeof v !== "number") return String(v ?? "");
    if (v === 0) return "0";
    const a = Math.abs(v);
    return a >= 1e4 || a < 1e-3 ? v.toExponential(2) : v.toPrecision(4).replace(/\.?0+$/, "");
  };

  function headerHtml(col: number): string {
    const ds = app.dataset!;
    const n = ds.header.length;
    if (col >= n) {
      const c = preds?.columns[col - n];
      return `<div class="colh pred"><span class="chip pred">予測</span><span class="cname">${esc(c?.label.replace(/^予測: /, "") ?? "")}</span></div>`;
    }
    const role = ds.roles[col];
    const dirOk = role === "y" && app.module.direction !== "none" && app.module.objectiveKind === "number";
    const dir = ds.directions[col];
    const dirHtml = dirOk
      ? `<span class="dir ${dir}" data-act="dir" title="クリックで 最大化 ⇄ 最小化">${dir === "max" ? "▲ 最大化" : "▼ 最小化"}</span>`
      : "";
    return `<div class="colh ${role}"><span class="chip ${role}" data-act="role" title="クリックで役割を切替（説明変数 → 目的変数 → 使わない）">${ROLE_LABEL[role]}</span><span class="cname" title="${esc(ds.header[col])}">${esc(ds.header[col])}</span>${dirHtml}</div>`;
  }

  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

  function colWidths() {
    const ds = app.dataset!;
    const textW = (s: string) => [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 13 : 7.5), 0);
    const base = ds.header.map((h, c) => Math.min(280, Math.max(96, textW(h) + 78 + (ds.roles[c] === "y" && app.module.direction !== "none" ? 72 : 0))));
    const pw = (preds?.columns ?? []).map((c) => Math.min(240, Math.max(110, textW(c.label.replace(/^予測: /, "")) + 70)));
    return [...base, ...pw];
  }

  function cellsMeta(physRow: number, col: number) {
    const ds = app.dataset!;
    const n = ds.header.length;
    const yCols = colsOf(ds, "y");
    const cls = [`row-${rowState(ds, yCols, physRow)}`];
    if (app.proposedRows.has(physRow)) cls.push("row-proposal");
    if (col >= n) cls.push("cell-pred");
    else cls.push(`cell-${ds.roles[col]}`);
    return cls.join(" ");
  }

  function settings(): Handsontable.GridSettings {
    const ds = app.dataset!;
    const n = ds.header.length;
    const nPred = preds?.columns.length ?? 0;
    return {
      data: buildData(),
      colHeaders: (c: number) => headerHtml(c),
      colWidths: colWidths(),
      columns: [
        ...ds.header.map(() => ({ type: "text" as const })),
        ...Array.from({ length: nPred }, () => ({ readOnly: true, renderer: predRenderer })),
      ],
    };
  }

  function predRenderer(this: unknown, instance: Handsontable, td: HTMLTableCellElement, ...rest: unknown[]) {
    // @ts-expect-error 型定義上は可変長引数
    Handsontable.renderers.TextRenderer.apply(this, [instance, td, ...rest]);
    const value = rest[3];
    td.textContent = fmt(value);
  }

  onMount(() => {
    hot = new Handsontable(el, {
      ...settings(),
      themeName: "ht-theme-main",
      // 見出しの HTML は headerHtml() で自前にエスケープしているので、そのまま通す
      sanitizer: (html: string) => html,
      licenseKey: "non-commercial-and-evaluation",
      height: "100%",
      width: "100%",
      rowHeaders: (visualRow: number) => {
        const phys = hot ? hot.toPhysicalRow(visualRow) : visualRow;
        const rank = app.proposedRows.get(phys);
        return rank ? `<span class="rank">★${rank}</span> ${phys + 1}` : String(phys + 1);
      },
      rowHeaderWidth: 64,
      // 列が少ないときは横幅いっぱいに広げる（列が多ければ横スクロール）
      stretchH: "all",
      manualColumnResize: true,
      columnSorting: { headerAction: false, indicator: true, sortEmptyCells: false },
      undo: true,
      autoWrapRow: true,
      autoWrapCol: true,
      outsideClickDeselects: false,
      afterRenderer(this: Handsontable, td, row, col) {
        // 行の状態・役割による色分け（cells で className を付けると編集時に再計算が多いので描画時に付ける）
        // コンストラクタ実行中にも呼ばれるので、hot ではなく this（インスタンス）を使う
        const phys = this.toPhysicalRow(row);
        const physCol = this.toPhysicalColumn(col);
        td.className = `${td.className.replace(/\b(row|cell)-\S+/g, "").trim()} ${cellsMeta(phys, physCol)}`;
      },
      afterChange(changes, source) {
        if (!changes || source === "loadData" || source === "updateData") return;
        const ds = app.dataset!;
        let changed = false;
        for (const [row, prop, , next] of changes) {
          const col = Number(prop);
          if (col >= ds.header.length) continue;
          const phys = hot!.toPhysicalRow(row);
          ds.rows[phys][col] = String(next ?? "").trim();
          changed = true;
        }
        if (changed) {
          app.touch();
          selfVersion = app.version;
          hot!.render(); // 行の状態（実験済みになった等）の色を更新
        }
      },
      afterOnCellMouseDown(event, coords) {
        if (coords.row !== -1 || coords.col == null || coords.col < 0) return;
        const act = (event.target as HTMLElement).closest<HTMLElement>("[data-act]")?.dataset.act;
        const col = hot!.toPhysicalColumn(coords.col) ?? -1;
        if (col >= app.dataset!.header.length) return;
        if (act === "role") app.cycleRole(col);
        if (act === "dir") app.setDirection(col, app.dataset!.directions[col] === "max" ? "min" : "max");
      },
      contextMenu: {
        items: {
          role_x: { name: "🔵 説明変数にする", callback: (_k: string, sel: Sel) => setRoleSel(sel, "x"), hidden: () => !colSelected() },
          role_y: { name: "🟠 目的変数にする", callback: (_k: string, sel: Sel) => setRoleSel(sel, "y"), hidden: () => !colSelected() },
          role_ignore: { name: "⚪ 使わない", callback: (_k: string, sel: Sel) => setRoleSel(sel, "ignore"), hidden: () => !colSelected() },
          sp1: "---------",
          sort_asc: { name: "昇順で並べ替え", callback: (_k: string, sel: Sel) => sortBy(sel, "asc") },
          sort_desc: { name: "降順で並べ替え", callback: (_k: string, sel: Sel) => sortBy(sel, "desc") },
          sort_clear: { name: "並べ替えを解除", callback: () => hot!.getPlugin("columnSorting").clearSort() },
          sp2: "---------",
          undo: { name: "元に戻す" },
          redo: { name: "やり直す" },
          sp3: "---------",
          copy: { name: "コピー" },
          cut: { name: "切り取り" },
        },
      },
    });
    el.addEventListener("dblclick", (e) => {
      // 見出しのダブルクリックで列幅をリセットしないよう何もしない（既定動作の抑止）
      if ((e.target as HTMLElement).closest("thead")) e.stopPropagation();
    });
    return () => {
      hot?.destroy();
      hot = null;
    };
  });

  function colSelected() {
    const r = hot?.getSelectedRangeLast();
    if (!r) return false;
    const c = hot!.toPhysicalColumn(r.from.col ?? -1) ?? -1;
    return c >= 0 && c < app.dataset!.header.length;
  }
  function setRoleSel(sel: Sel, role: Role) {
    const cols = new Set<number>();
    for (const s of sel) for (let c = Math.min(s.start.col, s.end.col); c <= Math.max(s.start.col, s.end.col); c++) cols.add(hot!.toPhysicalColumn(c) ?? -1);
    for (const c of cols) if (c >= 0 && c < app.dataset!.header.length) app.setRole(c, role);
  }
  function sortBy(sel: Sel, order: "asc" | "desc") {
    hot!.getPlugin("columnSorting").sort({ column: sel[0].start.col, sortOrder: order });
  }

  // ---- データ・設定の変化を表に反映する
  $effect(() => {
    // 依存: データセット（役割の変更を含む）・版・予測の表示・手法（最大/最小の表示有無）・提案
    const ds = app.dataset;
    const v = app.version;
    preds;
    app.module;
    app.proposedRows;
    if (!hot || !ds) return;
    untrack(() => {
      if (v === selfVersion) {
        hot!.updateSettings({ colHeaders: (c: number) => headerHtml(c), colWidths: colWidths() });
      } else {
        const s = settings();
        hot!.updateSettings({ colHeaders: s.colHeaders, colWidths: s.colWidths, columns: s.columns });
        hot!.updateData(s.data as unknown[][]);
      }
    });
  });

  // ---- グラフや提案タブから「この行を表で見る」
  $effect(() => {
    const f = app.focusRow;
    if (!f || !hot) return;
    untrack(() => {
      const visual = hot!.toVisualRow(f.row);
      hot!.selectCell(visual, 0);
      hot!.scrollViewportTo({ row: Math.max(0, visual - 3), col: 0 });
    });
  });
</script>

<div class="grid" bind:this={el}></div>

<style>
  .grid { position: absolute; inset: 0; }

  /* ---- 見出し */
  .grid :global(.colh) { display: flex; align-items: center; gap: 5px; justify-content: flex-start; overflow: hidden; }
  .grid :global(.colh .chip) { cursor: pointer; user-select: none; }
  .grid :global(.colh .chip:hover) { filter: brightness(0.95); box-shadow: 0 0 0 2px rgba(59, 91, 219, 0.15); }
  .grid :global(.colh .cname) { font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
  .grid :global(.colh.ignore .cname) { color: var(--faint); text-decoration: line-through; }
  .grid :global(.colh.pred .cname) { color: var(--pred); font-weight: 500; }
  .grid :global(.colh .dir) {
    margin-left: auto;
    font-size: 11px;
    border-radius: 4px;
    padding: 0 4px;
    cursor: pointer;
    color: var(--y);
    border: 1px solid #f6d3ad;
    background: #fff;
    white-space: nowrap;
  }
  .grid :global(.colh .dir:hover) { background: var(--y-bg); }
  .grid :global(.rank) { color: #b07d00; font-weight: 700; }

  /* ---- 列の色（見出しの下線で役割を示す） */
  .grid :global(th:has(.colh.x)) { box-shadow: inset 0 -3px 0 var(--x); }
  .grid :global(th:has(.colh.y)) { box-shadow: inset 0 -3px 0 var(--y); }
  .grid :global(th:has(.colh.pred)) { box-shadow: inset 0 -3px 0 var(--pred); }

  /* ---- セル: 役割と行の状態 */
  .grid :global(td.cell-x),
  .grid :global(td.cell-y),
  .grid :global(td.cell-pred) { text-align: right; font-variant-numeric: tabular-nums; }
  .grid :global(td.cell-y) { background: #fffaf4; font-weight: 600; color: #8a4b08; }
  .grid :global(td.cell-ignore) { color: var(--faint); }
  .grid :global(td.cell-pred) { background: #faf8fe; color: var(--pred); }
  .grid :global(td.row-pending.cell-x) { color: var(--muted); }
  .grid :global(td.row-pending.cell-y) {
    background: repeating-linear-gradient(45deg, #fffaf4, #fffaf4 4px, #fbf1e4 4px, #fbf1e4 8px);
  }
  .grid :global(td.row-partial.cell-y) { background: var(--warn-bg); }
  .grid :global(td.row-proposal) { background-color: var(--proposal-bg) !important; background-image: none !important; }
  .grid :global(td.row-proposal.cell-x) { color: var(--text); font-weight: 600; }
</style>
