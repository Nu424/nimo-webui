// 候補表（データセット）のモデルと、nimo に渡す入力の組み立て。
//
// nimo の CSV は「説明変数の列 → 末尾に目的変数の列」という並びで、目的変数が空欄の行が未実験。
// このアプリでは元の CSV の列順を変えずに、列ごとに役割（説明変数 / 目的変数 / 使わない）を持たせ、
// 実行の直前に nimo 用の CSV を組み立てる。これで、目的変数ごとにファイルを作り分ける手間がなくなる。
import Papa from "papaparse";
import type { Table } from "./csv";
import type { ModuleDef, ModuleContext } from "../modules";

export type Role = "x" | "y" | "ignore";
export type Direction = "max" | "min";

export interface Dataset extends Table {
  name: string;
  roles: Role[];
  directions: Direction[];
}

export type RowState = "observed" | "partial" | "pending";

export const isBlank = (s: string | undefined) => s === undefined || s.trim() === "";
export const isNum = (s: string | undefined) => !isBlank(s) && Number.isFinite(Number(s));

export const colsOf = (ds: Dataset, role: Role) => ds.roles.flatMap((r, i) => (r === role ? [i] : []));

/**
 * 列の役割を推測する。
 *  - 右端から連続して「空欄を含む列」が並んでいれば、それらを目的変数とみなす（nimo の流儀: 目的変数は末尾、未実験は空欄）
 *  - 空欄のない数値列 → 説明変数
 *  - それ以外（途中にある空欄を含む列・数値でない列・結果から計算したらしい列）→ 使わない（利用者に選んでもらう）
 *  空欄の列が 1 つもなければ（全部実験済みのデータ）、末尾の列を目的変数とみなす。
 */
export function guessRoles(t: Table): Role[] {
  const n = t.header.length;
  const hasBlank = t.header.map((_, c) => t.rows.some((r) => isBlank(r[c])));
  const allNum = t.header.map((_, c) => t.rows.every((r) => isBlank(r[c]) || isNum(r[c])));
  const yCols = new Set<number>();
  for (let c = n - 1; c >= 0 && hasBlank[c]; c--) yCols.add(c);
  if (yCols.size === 0) yCols.add(n - 1);
  // 未実験の行（目的変数が空欄）では一定値なのに、実験済みの行でだけ値が変わる列は、
  // 結果から計算した列（例: 生成物の合計）とみなして説明変数にしない
  const pending = t.rows.filter((r) => [...yCols].every((c) => isBlank(r[c])));
  const observed = t.rows.filter((r) => !pending.includes(r));
  const derived = (c: number) => {
    if (pending.length === 0 || observed.length === 0) return false;
    const v0 = pending[0][c];
    return pending.every((r) => r[c] === v0) && observed.some((r) => r[c] !== v0);
  };
  return t.header.map((_, c) => {
    if (yCols.has(c)) return "y";
    if (!hasBlank[c] && allNum[c] && !derived(c)) return "x";
    return "ignore";
  });
}

export function makeDataset(name: string, t: Table): Dataset {
  return { name, ...t, roles: guessRoles(t), directions: t.header.map(() => "max") };
}

export function rowState(ds: Dataset, yCols: number[], r: number): RowState {
  const row = ds.rows[r];
  const filled = yCols.filter((c) => !isBlank(row[c])).length;
  if (yCols.length === 0 || filled === 0) return "pending";
  return filled === yCols.length ? "observed" : "partial";
}

export interface Summary {
  nRows: number;
  nObserved: number;
  nPartial: number;
  nPending: number;
  xCols: number[];
  yCols: number[];
}

export function summarize(ds: Dataset): Summary {
  const xCols = colsOf(ds, "x");
  const yCols = colsOf(ds, "y");
  let nObserved = 0, nPartial = 0;
  for (let r = 0; r < ds.rows.length; r++) {
    const s = rowState(ds, yCols, r);
    if (s === "observed") nObserved++;
    else if (s === "partial") nPartial++;
  }
  return { nRows: ds.rows.length, nObserved, nPartial, nPending: ds.rows.length - nObserved - nPartial, xCols, yCols };
}

export function moduleContext(ds: Dataset): ModuleContext {
  const s = summarize(ds);
  return {
    xCols: s.xCols.map((c) => ds.header[c]),
    yCols: s.yCols.map((c) => ds.header[c]),
    nObjectives: s.yCols.length,
    observedValues: s.yCols.map((c) => ds.rows.filter((r) => isNum(r[c])).map((r) => Number(r[c]))),
  };
}

// ---------------------------------------------------------------- 実行前チェック

/** チェック結果。fix があれば、ボタン 1 つで直せる */
export interface Issue {
  level: "error" | "warning" | "info";
  message: string;
  fix?: { label: string; action: { kind: "module"; id: string } | { kind: "help"; topic: string } };
}

export function checkReady(ds: Dataset, mod: ModuleDef, nProposals: number): Issue[] {
  const s = summarize(ds);
  const out: Issue[] = [];
  const startFix = { label: "「まんべんなく選ぶ（DOE）」に切り替える", action: { kind: "module" as const, id: "DOE" } };

  if (s.xCols.length === 0) out.push({ level: "error", message: "説明変数の列がありません。列の見出しをクリックして役割を決めてください。" });
  if (s.yCols.length === 0) out.push({ level: "error", message: "目的変数の列がありません。列の見出しをクリックして「目的変数」にしてください。" });
  if (s.yCols.length < mod.objectives.min || s.yCols.length > mod.objectives.max) {
    const range = mod.objectives.min === mod.objectives.max ? `${mod.objectives.min} 列` : `${mod.objectives.min}〜${mod.objectives.max} 列`;
    out.push({ level: "error", message: `${mod.id} は目的変数が ${range} のときに使えます（いまは ${s.yCols.length} 列）。` });
  }

  // 説明変数はすべて数値で、空欄があってはいけない
  for (const c of s.xCols) {
    const bad = ds.rows.findIndex((r) => !isNum(r[c]));
    if (bad >= 0) {
      out.push({ level: "error", message: `説明変数「${ds.header[c]}」の ${bad + 1} 行目が数値ではありません（${ds.rows[bad][c] || "空欄"}）。数値にするか、この列を「使わない」にしてください。` });
    }
  }

  // 目的変数の種類（数値 or ラベル）
  for (const c of s.yCols) {
    const nonNum = ds.rows.find((r) => !isBlank(r[c]) && !isNum(r[c]));
    if (mod.objectiveKind === "number" && nonNum) {
      out.push({ level: "error", message: `目的変数「${ds.header[c]}」に数値でない値（${nonNum[c]}）があります。${mod.id} は数値の目的変数が必要です。ラベルなら「相図・分類」の手法を選んでください。` });
    }
  }

  if (s.nPartial > 0) {
    out.push({ level: "warning", message: `目的変数の一部だけ入力された行が ${s.nPartial} 行あります。これらは「未実験」として扱います（入力済みの値は学習に使われません）。` });
  }
  if (s.nObserved < mod.minObserved) {
    out.push({
      level: "error",
      message: `${mod.id} を使うには実験済みの行が ${mod.minObserved} 行以上必要です（いまは ${s.nObserved} 行）。まずは最初の実験点を選ぶ手法で数点を測りましょう。`,
      fix: startFix,
    });
  }
  if (mod.minClasses) {
    const labels = new Set(ds.rows.map((r) => r[s.yCols[0]]).filter((v) => !isBlank(v)));
    if (labels.size < mod.minClasses && s.nObserved >= mod.minObserved) {
      out.push({ level: "error", message: `${mod.id} には 2 種類以上のラベルが観測済みである必要があります（いまは ${labels.size} 種類）。`, fix: startFix });
    }
  }
  if (!mod.proposesNewRows && nProposals > s.nPending) {
    out.push({ level: "error", message: `提案数（${nProposals}）が未実験の行数（${s.nPending}）より多くなっています。` });
  }
  if (mod.id === "COMBI") {
    const bad = ds.rows.findIndex((r) => Math.abs(s.xCols.reduce((a, c) => a + Number(r[c]), 0) - 100) > 1e-6);
    if (bad >= 0) out.push({ level: "warning", message: `COMBI は組成を百分率（合計 100）で扱います。${bad + 1} 行目の説明変数の合計が 100 になっていません。` });
  }
  return out;
}

// ---------------------------------------------------------------- nimo 入力の組み立て

/**
 * nimo に渡す CSV を作る。
 *  - 列は「説明変数 → 目的変数」の順に並べ替え、「使わない」列は落とす
 *  - 行は元の順のまま全部渡す（nimo の行番号 = 元の表の行番号）
 *  - 最大化/最小化: nimo の minimization は全目的変数で共通なので、方向が混在しても扱えるよう
 *    ここで符号をそろえる（direction=flag の手法は常に「最大化」として渡し、最小化したい列は符号反転。
 *    SLESA のように常に最小化する手法は逆に、最大化したい列を符号反転）
 */
export function buildNimoCsv(ds: Dataset, mod: ModuleDef): { csv: string; negate: boolean[] } {
  const s = summarize(ds);
  const negate = s.yCols.map((c) =>
    mod.direction === "flag" ? ds.directions[c] === "min" : mod.direction === "minimizes" ? ds.directions[c] === "max" : false,
  );
  const header = [...s.xCols, ...s.yCols].map((c) => ds.header[c]);
  const rows = ds.rows.map((r, i) => {
    // 目的変数が一部だけ入った行は「未実験」として渡す（nimo は最後の目的変数だけで未実験を判定するので、
    // 途中の列が空欄のまま学習に使われないよう、目的変数をすべて空欄にそろえる）
    const partial = rowState(ds, s.yCols, i) === "partial";
    return [
      ...s.xCols.map((c) => r[c]),
      ...s.yCols.map((c, k) => (partial ? "" : negate[k] && isNum(r[c]) ? String(-Number(r[c])) : r[c])),
    ];
  });
  return { csv: Papa.unparse([header, ...rows], { newline: "\n" }), negate };
}
