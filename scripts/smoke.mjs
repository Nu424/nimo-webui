// 開発用スモークテスト: 開発サーバー上で、全手法をサンプルデータに対して画面の状態経由で実行する。
// 画面の設定 → nimo 引数への変換（modules.ts の toOptions）と結果の読み取りまで通しで確かめる。
// 使い方: npm run dev（別ターミナル）→ node scripts/smoke.mjs [http://127.0.0.1:5199/]
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:5199/";
const CASES = [
  // [サンプル, 手法, 追加の設定]
  ["synthesis_yield.csv", "RE", {}],
  ["synthesis_yield.csv", "DOE", { mode: "distance" }],
  ["synthesis_yield.csv", "DOE", { mode: "lhs" }],
  ["synthesis_yield.csv", "DOE", { mode: "d_optimal" }],
  ["synthesis_yield.csv", "DOE", { mode: "greedy" }],
  ["synthesis_yield.csv", "ES", {}],
  ["synthesis_yield.csv", "PHYSBO", { score: "EI" }],
  ["synthesis_yield.csv", "PHYSBO", { score: "PI" }],
  ["synthesis_yield.csv", "PHYSBO", { score: "TS" }],
  ["synthesis_yield.csv", "NTS", {}],
  ["synthesis_yield.csv", "BOMP", { process: [0] }],
  ["synthesis_yield.csv", "RSVM", {}],
  ["synthesis_yield.csv", "SLESA", {}],
  ["synthesis_yield.csv", "SLESA", { __fill: true }], // 2 回目: 仮想実験で結果を入れてから、状態ファイルを引き継いで実行
  ["synthesis_yield.csv", "PTR", { ranges: [[60, 80]] }],
  ["synthesis_yield.csv", "LSE", {}],
  ["synthesis_yield.csv", "BLOX", {}],
  ["two_properties.csv", "PHYSBO", { score: "TS" }],
  ["two_properties.csv", "PHYSBO", { score: "HVPI" }],
  ["two_properties.csv", "PHYSBO", { score: "EHVI" }],
  ["two_properties.csv", "BLOX", {}],
  ["two_properties.csv", "PTR", { ranges: [[400, ""], [80, ""]] }],
  ["ternary_phase.csv", "PDC", {}],
  ["ternary_phase.csv", "PDC", { estimation: "LS", sampling: "EA" }],
  ["ternary_phase.csv", "BALD", {}],
  ["combi_film.csv", "COMBI", {}],
  ["cookie_recipe.csv", "PHYSBO", { score: "EI" }],
];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => globalThis.__app, null, { timeout: 30000 });

const results = await page.evaluate(async (cases) => {
  const app = globalThis.__app;
  const samples = await fetch("samples/index.json").then((r) => r.json());
  const out = [];
  let current = "";
  for (const [file, method, params] of cases) {
    if (file !== current || method === "SLESA" && !out.some((o) => o.method === "SLESA")) {
      await app.openSample(samples.find((s) => s.file === file));
      current = file;
    }
    app.selectModule(method);
    if (params.__fill) app.fillVirtual();
    for (const [k, v] of Object.entries(params)) if (!k.startsWith("__")) app.setParam(k, v);
    const errors = app.issues.filter((i) => i.level === "error").map((i) => i.message);
    if (errors.length) {
      out.push({ file, method, params, ok: false, detail: "check: " + errors.join(" / ") });
      continue;
    }
    const n = app.runs.length;
    const t0 = performance.now();
    await app.run();
    const sec = ((performance.now() - t0) / 1000).toFixed(1);
    const run = app.runs.length > n ? app.runs.at(-1) : null;
    out.push({
      file,
      method,
      params,
      ok: !!run,
      detail: run
        ? `${sec}s rows=[${run.proposals.map((p) => p.row ?? "new").join(",")}] preds=${run.predictions ? run.predictions.columns.map((c) => c.label).join("|") : "-"} state=${Object.keys(run.stateFiles).join(",")}${run.notes.length ? " NOTE" : ""}`
        : (app.lastError?.message ?? "no result").split("\n").slice(0, 3).join(" "),
    });
  }
  return out;
}, CASES);

let fail = 0;
for (const r of results) {
  if (!r.ok) fail++;
  console.log(`${r.ok ? "OK  " : "FAIL"} ${r.method.padEnd(6)} ${r.file.padEnd(20)} ${JSON.stringify(r.params).padEnd(34)} ${r.detail}`);
}
console.log(`\n${results.length - fail}/${results.length} passed`);
await browser.close();
process.exit(fail ? 1 : 0);
