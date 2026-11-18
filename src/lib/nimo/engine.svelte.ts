// 画面側から見た「nimo 実行エンジン」。ワーカーの起動・状態・実行・中断をまとめる。
// 中断は Python を止める手段がない（SharedArrayBuffer は GitHub Pages で使えない）ため、
// ワーカーごと破棄して起動し直す。2 回目以降の起動はブラウザのキャッシュで速い。
import type { FromWorker, RunRequest, RunResponse, Versions } from "./protocol";

export type EngineStatus = "idle" | "loading" | "ready" | "running" | "error";

class NimoEngine {
  status = $state<EngineStatus>("idle");
  progressLabel = $state("");
  progress = $state(0);
  versions = $state<Versions | null>(null);
  errorMessage = $state("");
  /** 実行開始時刻（経過時間の表示用） */
  runStartedAt = $state<number | null>(null);

  #worker: Worker | null = null;
  #nextId = 1;
  #pending = new Map<number, { resolve: (r: RunResponse & { seconds: number }) => void; reject: (e: Error) => void }>();

  start() {
    if (this.#worker) return;
    this.status = "loading";
    this.progress = 0;
    this.errorMessage = "";
    const worker = new Worker(new URL("./nimo.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<FromWorker>) => this.#onMessage(e.data);
    worker.onerror = (e) => {
      this.status = "error";
      this.errorMessage = e.message || "ワーカーの起動に失敗しました";
      this.#rejectPending("Python の実行環境が停止しました。右上の表示をクリックして再読み込みしてください");
    };
    worker.postMessage({ type: "init", baseUrl: new URL("./", document.baseURI).href });
    this.#worker = worker;
  }

  #onMessage(m: FromWorker) {
    switch (m.type) {
      case "progress":
        this.progressLabel = m.label;
        this.progress = m.ratio;
        break;
      case "ready":
        this.versions = m.versions;
        this.progress = 1;
        this.status = "ready";
        break;
      case "init-error":
        this.status = "error";
        this.errorMessage = m.message;
        break;
      case "result": {
        const p = this.#pending.get(m.id);
        this.#pending.delete(m.id);
        this.status = "ready";
        this.runStartedAt = null;
        p?.resolve({ ...m.res, seconds: m.seconds });
        break;
      }
    }
  }

  /** 起動完了を待つ（起動前なら起動する） */
  async whenReady(): Promise<void> {
    this.start();
    while (this.status === "loading") await new Promise((r) => setTimeout(r, 100));
    if (this.status === "error") throw new Error(this.errorMessage);
  }

  async run(req: RunRequest): Promise<RunResponse & { seconds: number }> {
    await this.whenReady();
    const id = this.#nextId++;
    this.status = "running";
    this.runStartedAt = Date.now();
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      try {
        // 画面側の状態（Svelte の Proxy）が混ざっていると複製できないので、素のデータにしてから送る
        this.#worker!.postMessage({ type: "run", id, req: JSON.parse(JSON.stringify(req)) });
      } catch (e) {
        this.#pending.delete(id);
        this.status = "ready";
        this.runStartedAt = null;
        reject(e);
      }
    });
  }

  #rejectPending(message: string) {
    for (const p of this.#pending.values()) p.reject(new Error(message));
    this.#pending.clear();
    this.runStartedAt = null;
  }

  /** 実行中の計算を中断する（ワーカーを作り直す） */
  cancel() {
    this.#worker?.terminate();
    this.#worker = null;
    this.#rejectPending("中断しました");
    this.start();
  }

  retry() {
    this.#worker?.terminate();
    this.#worker = null;
    this.#rejectPending("中断しました");
    this.start();
  }
}

export const engine = new NimoEngine();
