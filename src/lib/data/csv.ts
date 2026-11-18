// CSV の読み込み・書き出し。
// Excel（日本語 Windows）で保存した CSV は Shift_JIS のことが多いので、
// まず UTF-8 として厳密に解釈し、失敗したら Shift_JIS とみなす。
import Papa from "papaparse";

export interface Table {
  header: string[];
  rows: string[][];
}

export type Encoding = "utf-8" | "shift_jis";

export function decode(buf: ArrayBuffer): { text: string; encoding: Encoding } {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return { text: text.replace(/^﻿/, ""), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("shift_jis").decode(buf), encoding: "shift_jis" };
  }
}

/** CSV / TSV の文字列を表に変換する。区切り文字は自動判別、セルは前後の空白を除く */
export function parseTable(text: string): Table {
  const res = Papa.parse<string[]>(text.trim(), { skipEmptyLines: "greedy", delimiter: "" });
  const data = res.data.map((r) => r.map((c) => (c ?? "").trim()));
  if (data.length === 0) throw new Error("CSV が空です");
  const header = data[0].map((h, i) => h || `列${i + 1}`);
  // 列数がそろっていない行は空セルで埋める / 切り詰める
  const rows = data.slice(1).map((r) => header.map((_, i) => r[i] ?? ""));
  return { header, rows };
}

export function toCsv(table: Table): string {
  return Papa.unparse([table.header, ...table.rows], { newline: "\r\n" });
}

/** ブラウザからファイルとして保存させる。bom=true なら Excel で文字化けしない UTF-8（BOM 付き） */
export function downloadText(filename: string, text: string, bom = true) {
  const blob = new Blob([bom ? "﻿" : "", text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** 拡張子を除いたファイル名 */
export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
