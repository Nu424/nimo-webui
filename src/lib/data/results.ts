// nimo の出力ファイル（proposals.csv / output_res.csv など）を読み取り、元の表の行に対応づける。
import Papa from "papaparse";
import type { RunResponse } from "../nimo/protocol";
import type { ModuleDef } from "../modules";
import { isNum, summarize, type Dataset } from "./dataset";

export type PredKind = "mean" | "sd" | "acq" | "prob" | "label" | "other";

export interface PredColumn {
  label: string;
  kind: PredKind;
  /** mean / sd のとき、対応する目的変数の列名 */
  target?: string;
}

export interface Proposal {
  rank: number;
  /** 元の表の行番号（0 始まり）。COMBI のように新しい条件のときは null */
  row: number | null;
  /** 説明変数の値（xNames の順） */
  values: string[];
}

export interface RunResult {
  id: string;
  method: string;
  at: string;
  seconds: number;
  /** 実行時の説明変数・目的変数の列名 */
  xNames: string[];
  yNames: string[];
  proposals: Proposal[];
  /** 予測値（行番号 → 値の並び）。予測を出さない手法では null */
  predictions: { columns: PredColumn[]; byRow: Record<number, (number | string)[]> } | null;
  log: string;
  /** SLESA などが次回に引き継ぐ状態ファイル */
  stateFiles: Record<string, string>;
  /** 実行時の設定（履歴表示用） */
  settingsText: string;
  /** 結果について利用者に伝えたい注意 */
  notes: string[];
}

const parse = (text: string) => Papa.parse<string[]>(text.trim(), { skipEmptyLines: true }).data;

const STATE_FILE = /^slesa_log_.*\.csv$/;

export function parseRun(
  ds: Dataset,
  mod: ModuleDef,
  res: RunResponse & { seconds: number },
  negate: boolean[],
  settingsText: string,
): RunResult {
  const s = summarize(ds);
  const xNames = s.xCols.map((c) => ds.header[c]);
  const yNames = s.yCols.map((c) => ds.header[c]);

  // --- 提案: 先頭列 actions が元の行番号（COMBI の新しい組成は -1）
  const prop = parse(res.files["proposals.csv"] ?? "");
  const proposals: Proposal[] = prop.slice(1).map((r, i) => {
    const a = Number(r[0]);
    return { rank: i + 1, row: Number.isInteger(a) && a >= 0 && a < ds.rows.length ? a : null, values: r.slice(1) };
  });

  // --- 予測: 多くの手法は「nimo が未実験とみなした行」だけを元の順で出力する。
  // nimo の未実験 = 末尾（最後の目的変数）の列が空欄・非数の行
  const lastY = s.yCols[s.yCols.length - 1];
  const testRows: number[] = [];
  const trainRows: number[] = [];
  ds.rows.forEach((r, i) => ((mod.objectiveKind === "label" ? (r[lastY] ?? "").trim() !== "" : isNum(r[lastY])) ? trainRows : testRows).push(i));

  let predictions: RunResult["predictions"] = null;
  const out = res.files["output_res.csv"];
  if (out && mod.predictions) {
    const table = parse(out);
    const header = table[0];
    const body = table.slice(1);
    const hasActions = header[0] === "actions";
    const start = (hasActions ? 1 : 0) + xNames.length; // 説明変数の後ろが予測の列
    const extra = header.slice(start);
    // PDC は確率の列名（probability_0 など）とラベルの対応表を別ファイルで出す
    const classMap: Record<string, string> = Object.fromEntries(
      parse(res.files["output_res_classes.csv"] ?? "").slice(1).map((r) => [r[0], r[1]]),
    );
    const keep = extra.map((name, k) => describe(mod, name, k, yNames, classMap)).map((d, k) => ({ d, k })).filter((e) => e.d !== null);
    const columns = keep.map((e) => e.d!.col);

    const rowOf = (i: number, r: string[]): number | null => {
      if (hasActions) return Number(r[0]);
      if (body.length === ds.rows.length) return i;
      if (body.length === testRows.length) return testRows[i];
      return null;
    };
    const byRow: Record<number, (number | string)[]> = {};
    const fill = (rows: string[][], map: (i: number, r: string[]) => number | null) => {
      rows.forEach((r, i) => {
        const row = map(i, r);
        if (row === null || Number.isNaN(row)) return;
        byRow[row] = keep.map((e) => convert(e.d!, r[start + e.k], negate, yNames));
      });
    };
    fill(body, rowOf);
    // PHYSBO / BOMP は実験済みの行の予測（training_res.csv）も出せる
    const tr = res.files["training_res.csv"];
    if (tr) {
      const tb = parse(tr).slice(1);
      if (tb.length === trainRows.length) fill(tb, (i) => trainRows[i]);
    }
    if (Object.keys(byRow).length > 0) predictions = { columns, byRow };
  }

  // 予測が全候補で同じ（データが少ない・関係が弱いと PHYSBO などで起こる）なら、提案に意味が薄いことを伝える
  const notes: string[] = [];
  if (predictions) {
    const acq = predictions.columns.findIndex((c) => c.kind === "acq");
    const vals = Object.values(predictions.byRow).map((r) => r[acq]).filter((v): v is number => typeof v === "number");
    if (acq >= 0 && vals.length > 1 && Math.max(...vals) - Math.min(...vals) <= 1e-12 * Math.max(1, Math.abs(vals[0]))) {
      notes.push(
        "予測がすべての候補で同じ値になりました。実験済みの点が少ないか、説明変数との関係がまだ見えていないため、モデルが「どこも同じ」と判断しています。" +
          "このときの提案は表の上から順になっているだけです。「まんべんなく選ぶ（DOE）」で実験点を増やしてから、もう一度試してください。",
      );
    }
  }

  const stateFiles = Object.fromEntries(Object.entries(res.files).filter(([k]) => STATE_FILE.test(k)));
  return {
    id: crypto.randomUUID(),
    method: mod.id,
    at: new Date().toISOString(),
    seconds: res.seconds,
    xNames,
    yNames,
    proposals,
    predictions,
    log: res.log,
    stateFiles,
    settingsText,
    notes,
  };
}

interface Desc {
  col: PredColumn;
  /** 値の変換: 符号を戻す目的変数の番号 / 分散→標準偏差 */
  negateIndex?: number;
  sqrt?: boolean;
  numeric: boolean;
}

/** output_res.csv の列名から、画面に出す名前と種類を決める。表示しない列は null */
function describe(mod: ModuleDef, name: string, _k: number, yNames: string[], classMap: Record<string, string>): Desc | null {
  const yi = yNames.indexOf(name);
  // LSE は独自の列構成
  if (mod.id === "LSE") {
    const y = yNames[0];
    if (name === "mean") return { col: { label: `予測: ${y}`, kind: "mean", target: y }, numeric: true };
    if (name === "variance") return { col: { label: `不確かさ σ: ${y}`, kind: "sd", target: y }, sqrt: true, numeric: true };
    if (name === "classification") return { col: { label: "判定", kind: "label" }, numeric: false };
    if (name === "prob_above") return { col: { label: "しきい値以上の確率", kind: "prob" }, numeric: true };
    if (name === "acquisition") return { col: { label: "獲得関数", kind: "acq" }, numeric: true };
    return null;
  }
  if (mod.id === "PDC") {
    if (yi === 0) return { col: { label: "推定ラベル", kind: "label" }, numeric: false };
    const m = name.match(/^probability_(.+)$/);
    if (m) return { col: { label: `確率: ${classMap[name] ?? m[1]}`, kind: "prob" }, numeric: true };
    return null;
  }
  if (yi >= 0) {
    const label = mod.id === "SLESA" ? `予測（規格化）: ${name}` : mod.id === "RSVM" ? "スコア" : `予測: ${name}`;
    return { col: { label, kind: "mean", target: name }, negateIndex: mod.id === "SLESA" ? undefined : yi, numeric: true };
  }
  const v = name.match(/^variance(\d*)$/);
  if (v) {
    const i = v[1] === "" ? 0 : Number(v[1]);
    const y = yNames[i] ?? yNames[0];
    return { col: { label: `不確かさ σ: ${y}`, kind: "sd", target: y }, sqrt: true, numeric: true };
  }
  if (name === "acquisition") return { col: { label: mod.id === "RSVM" ? "スコア" : "獲得関数", kind: "acq" }, numeric: true };
  return { col: { label: name, kind: "other" }, numeric: true };
}

function convert(d: Desc, raw: string | undefined, negate: boolean[], _y: string[]): number | string {
  if (!d.numeric) return LSE_LABELS[raw ?? ""] ?? raw ?? "";
  let v = Number(raw);
  if (!Number.isFinite(v)) return "";
  if (d.sqrt) v = Math.sqrt(Math.max(v, 0));
  if (d.negateIndex !== undefined && negate[d.negateIndex]) v = -v;
  return v;
}

const LSE_LABELS: Record<string, string> = { above: "上", below: "下", uncertain: "未確定", unclassified: "未確定" };
