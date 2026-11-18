/// <reference lib="webworker" />
// Pyodide を起動して nimo を入れ、実行要求を受けて結果を返すワーカー。
// 重い計算中も画面が固まらないよう、Python はすべてここで動かす。
import type { PyodideAPI } from "pyodide";
import runnerSource from "../../python/runner.py?raw";
import { BUNDLED_WHEELS, PYODIDE_CDN, type FromWorker, type ToWorker } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;
const post = (m: FromWorker) => self.postMessage(m);

let py: PyodideAPI | null = null;
let runFn: ((json: string) => string) | null = null;

async function init(baseUrl: string) {
  const t0 = performance.now();
  // 段階ごとの重み（体感の進み具合に合わせた目安）
  post({ type: "progress", label: "Python 本体を読み込み中", ratio: 0.05 });
  const { loadPyodide } = (await import(/* @vite-ignore */ `${PYODIDE_CDN}pyodide.mjs`)) as typeof import("pyodide");
  py = await loadPyodide({ indexURL: PYODIDE_CDN });

  post({ type: "progress", label: "数値計算ライブラリを読み込み中（初回のみ数十 MB）", ratio: 0.25 });
  await py.loadPackage(["micropip", "numpy", "scipy", "scikit-learn", "matplotlib"]);

  post({ type: "progress", label: "nimo をインストール中", ratio: 0.8 });
  const micropip = py.pyimport("micropip");
  // nimo の依存の anthropic はブラウザで動かないので、同梱 wheel を依存解決なしで入れる
  // （JS から Python のキーワード引数を渡すには callKwargs を使う）
  await micropip.install.callKwargs(BUNDLED_WHEELS.map((w) => new URL(`wheels/${w}`, baseUrl).href), { deps: false });

  post({ type: "progress", label: "nimo を初期化中", ratio: 0.92 });
  py.FS.writeFile("/home/pyodide/nimo_webui_runner.py", runnerSource);
  const runner = py.pyimport("nimo_webui_runner");
  const versions = JSON.parse(runner.setup());
  runFn = runner.run;
  post({ type: "ready", versions, seconds: (performance.now() - t0) / 1000 });
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === "init") {
    try {
      await init(msg.baseUrl);
    } catch (err) {
      post({ type: "init-error", message: err instanceof Error ? err.message : String(err) });
    }
  } else if (msg.type === "run") {
    const t0 = performance.now();
    let res;
    try {
      res = JSON.parse(runFn!(JSON.stringify(msg.req)));
    } catch (err) {
      // runner.py の外（JSON 変換など）で失敗したときも、画面が「計算中」のまま止まらないよう結果として返す
      res = { ok: false, error: err instanceof Error ? err.message : String(err), log: "", files: {} };
    }
    post({ type: "result", id: msg.id, res, seconds: (performance.now() - t0) / 1000 });
  }
};
