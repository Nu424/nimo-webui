// 候補表の自動生成。変数ごとの「範囲・刻み」「値の列挙」「組成（合計一定）」から、
// すべての組み合わせ（直積）を作る。画面から切り離した純粋な関数なので、単体で検証できる。
import type { Table } from "./csv";

export type VarSpec =
  | { kind: "range"; name: string; min: string; max: string; step: string }
  | { kind: "list"; name: string; values: string }
  /** 組成: 複数の元素の値の合計が一定（または以下）になる組み合わせ */
  | { kind: "simplex"; names: string; total: string; step: string; allowLess: boolean }
  /** 値はあとで入力する列（1 通りとして数える） */
  | { kind: "blank"; name: string };

export const MAX_ROWS = 50000;

/** 変数 1 つ分の展開結果: 列名と、取りうる値の組（組成は複数列を同時に持つ） */
interface Expanded {
  names: string[];
  values: string[][];
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

/** 刻みや端点の小数桁数（0.1+0.2 のような誤差を丸めるため） */
function decimals(...xs: string[]): number {
  return Math.max(0, ...xs.map((x) => {
    const t = x.trim().toLowerCase();
    if (t.includes("e")) return 10;
    const i = t.indexOf(".");
    return i < 0 ? 0 : t.length - i - 1;
  }));
}

const fmt = (v: number, d: number) => String(Number(v.toFixed(d)));

/** 組成: units を k 個の非負整数に分ける方法（合計 = units）を列挙する */
function* compositions(units: number, k: number): Generator<number[]> {
  if (k === 1) {
    yield [units];
    return;
  }
  for (let i = units; i >= 0; i--) for (const rest of compositions(units - i, k - 1)) yield [i, ...rest];
}

const binom = (n: number, k: number) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};

/** 変数 1 つの値の数（エラーなら文字列）。生成前のプレビュー用に、展開せずに数える */
export function countOf(v: VarSpec): number | string {
  switch (v.kind) {
    case "blank":
      return 1;
    case "list": {
      const n = splitList(v.values).length;
      return n === 0 ? "値を 1 つ以上入れてください" : n;
    }
    case "range": {
      const [a, b, s] = [num(v.min), num(v.max), num(v.step)];
      if (![a, b, s].every(Number.isFinite)) return "最小・最大・刻みを数値で入れてください";
      if (s <= 0) return "刻みは正の数にしてください";
      if (b < a) return "最大は最小以上にしてください";
      return Math.floor((b - a) / s + 1e-9) + 1;
    }
    case "simplex": {
      const k = splitList(v.names).length;
      const [t, s] = [num(v.total), num(v.step)];
      if (k < 2) return "元素を 2 つ以上、カンマ区切りで入れてください";
      if (!Number.isFinite(t) || !Number.isFinite(s) || t <= 0 || s <= 0) return "合計・刻みを正の数で入れてください";
      const units = Math.round(t / s);
      if (Math.abs(units * s - t) > 1e-9 * Math.max(1, t)) return "合計が刻みで割り切れるようにしてください（例: 合計 1、刻み 0.05）";
      // 合計 = units の組成の数（allowLess なら 0〜units の合計）
      return v.allowLess ? binom(units + k, k) : binom(units + k - 1, k - 1);
    }
  }
}

export function splitList(s: string): string[] {
  return s
    .split(/[,、\s]+/)
    .map((x) => x.trim())
    .filter((x) => x !== "");
}

function expand(v: VarSpec): Expanded {
  switch (v.kind) {
    case "blank":
      return { names: [v.name], values: [[""]] };
    case "list":
      return { names: [v.name], values: splitList(v.values).map((x) => [x]) };
    case "range": {
      const [a, s] = [num(v.min), num(v.step)];
      const d = decimals(v.min, v.step);
      const n = countOf(v) as number;
      return { names: [v.name], values: Array.from({ length: n }, (_, i) => [fmt(a + i * s, d)]) };
    }
    case "simplex": {
      const names = splitList(v.names);
      const s = num(v.step);
      const units = Math.round(num(v.total) / s);
      const d = decimals(v.step, v.total);
      const values: string[][] = [];
      const totals = v.allowLess ? Array.from({ length: units + 1 }, (_, i) => units - i) : [units];
      for (const u of totals) for (const c of compositions(u, names.length)) values.push(c.map((x) => fmt(x * s, d)));
      return { names, values };
    }
  }
}

export function columnNames(vars: VarSpec[]): string[] {
  return vars.flatMap((v) => (v.kind === "simplex" ? splitList(v.names) : [v.name.trim()]));
}

export interface Plan {
  /** 変数ごとの値の数 */
  counts: number[];
  total: number;
  errors: string[];
}

/** 生成前のチェックと行数の見積もり */
export function plan(vars: VarSpec[], objectives: string[] = []): Plan {
  const errors: string[] = [];
  const counts: number[] = [];
  vars.forEach((v, i) => {
    const c = countOf(v);
    if (typeof c === "string") errors.push(`変数 ${i + 1}: ${c}`);
    counts.push(typeof c === "number" ? c : 0);
  });
  const names = [...columnNames(vars), ...objectives];
  if (vars.length === 0) errors.push("変数を 1 つ以上追加してください");
  if (names.some((n) => n === "")) errors.push("名前が空の変数があります");
  const dup = names.find((n, i) => n !== "" && names.indexOf(n) !== i);
  if (dup) errors.push(`列名「${dup}」が重複しています`);
  const total = counts.reduce((a, b) => a * b, 1);
  if (total > MAX_ROWS) errors.push(`${total.toLocaleString()} 行になります。${MAX_ROWS.toLocaleString()} 行以下になるよう、範囲を狭めるか刻みを粗くしてください`);
  return { counts, total, errors };
}

/** すべての組み合わせを作る。objectives の列は空欄（未実験）で付け足す */
export function generate(vars: VarSpec[], objectives: string[] = []): Table {
  const parts = vars.map(expand);
  let rows: string[][] = [[]];
  for (const p of parts) rows = rows.flatMap((r) => p.values.map((v) => [...r, ...v]));
  return { header: [...parts.flatMap((p) => p.names), ...objectives], rows: rows.map((r) => [...r, ...objectives.map(() => "")]) };
}

/**
 * 生成した行を、既存の表の列構成に合わせる（今の表に追加するとき）。
 * 既存の行と説明変数の値が同じ組み合わせは除く（数値として比較）。
 */
export function mergeInto(existing: Table, generated: Table): { rows: string[][]; skipped: number; missing: string[] } {
  const missing = generated.header.filter((h) => !existing.header.includes(h));
  if (missing.length) return { rows: [], skipped: 0, missing };
  const idx = generated.header.map((h) => existing.header.indexOf(h));
  const key = (vals: string[]) => vals.map((v) => (v.trim() !== "" && Number.isFinite(Number(v)) ? String(Number(v)) : v.trim())).join("\u0000");
  const seen = new Set(existing.rows.map((r) => key(idx.map((c) => r[c] ?? ""))));
  const rows: string[][] = [];
  let skipped = 0;
  for (const g of generated.rows) {
    const k = key(g);
    if (seen.has(k)) {
      skipped++;
      continue;
    }
    seen.add(k);
    const row = existing.header.map(() => "");
    idx.forEach((c, j) => (row[c] = g[j]));
    rows.push(row);
  }
  return { rows, skipped, missing };
}
