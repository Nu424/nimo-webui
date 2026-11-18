// 候補の自動生成（src/lib/data/generate.ts）の単体テスト。npm test で実行する
import { plan, generate, mergeInto, countOf } from "../.tmp/generate.mjs";
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.log("FAIL", m, JSON.stringify(a), "!=", JSON.stringify(b)); process.exitCode = 1; } else console.log("ok  ", m); };
// 範囲: 小数の刻み誤差
const r = generate([{ kind: "range", name: "c", min: "0.1", max: "0.5", step: "0.1" }]);
eq(r.rows.map((x) => x[0]), ["0.1", "0.2", "0.3", "0.4", "0.5"], "range decimals");
eq(countOf({ kind: "range", name: "t", min: "60", max: "110", step: "10" }), 6, "range count");
// 直積 + 目的変数
const p = [{ kind: "range", name: "T", min: "60", max: "110", step: "10" }, { kind: "list", name: "t", values: "1, 2, 4, 6, 8" }, { kind: "range", name: "c", min: "0.1", max: "0.5", step: "0.1" }];
eq(plan(p, ["y"]).total, 150, "product count");
const g = generate(p, ["y"]); eq([g.header, g.rows.length, g.rows[0]], [["T", "t", "c", "y"], 150, ["60", "1", "0.1", ""]], "product rows");
// 組成: try-nimo 相当（7 元素・合計 0.15・刻み 0.05 / 0.075）
const els = "Ag, Au, Pt, Al, Ni, Fe, SnO2";
const s1 = generate([{ kind: "simplex", names: els, total: "0.15", step: "0.05", allowLess: false }]);
eq(s1.rows.length, 84, "simplex 0.05 (C(9,6)=84)");
eq(s1.rows.every((r) => Math.abs(r.reduce((a, v) => a + Number(v), 0) - 0.15) < 1e-9), true, "simplex sums");
const s2 = generate([{ kind: "simplex", names: els, total: "0.15", step: "0.075", allowLess: false }]);
eq(s2.rows.length, 28, "simplex 0.075 (C(8,6)=28)");
const m = mergeInto(s1, s2); eq([m.rows.length, m.skipped], [21, 7], "merge dedupe 0.075 into 0.05 (7 overlap: single-element 0.15)");
eq(plan([{ kind: "simplex", names: "A,B", total: "1", step: "0.3", allowLess: false }]).errors.length, 1, "simplex indivisible error");
eq(countOf({ kind: "simplex", names: "A,B,C", total: "1", step: "0.5", allowLess: true }), 10, "simplex <= count");
eq(generate([{ kind: "simplex", names: "A,B,C", total: "1", step: "0.5", allowLess: true }]).rows.length, 10, "simplex <= rows");
eq(plan([{ kind: "range", name: "a", min: "0", max: "1", step: "0.0001" }, { kind: "range", name: "b", min: "0", max: "1", step: "0.001" }]).errors.some((e) => e.includes("行以下")), true, "too many rows");
eq(plan([{ kind: "list", name: "a", values: "1" }], ["a"]).errors.some((e) => e.includes("重複")), true, "duplicate names");
