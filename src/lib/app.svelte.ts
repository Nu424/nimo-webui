// アプリ全体の状態と操作。画面の部品はここを読み書きする。
// 表のデータは大きくなりうるので $state.raw で持ち、編集時は version を進めて再描画を知らせる。
import { get, set } from "idb-keyval";
import { baseName, decode, downloadText, parseTable, today, toCsv, type Encoding, type Table } from "./data/csv";
import { buildNimoCsv, checkReady, isBlank, makeDataset, moduleContext, summarize, type Dataset, type Direction, type Role } from "./data/dataset";
import { parseRun, type RunResult } from "./data/results";
import { defaultParams, DEFAULT_MODULE, getModule, type ParamValues } from "./modules";
import { engine } from "./nimo/engine.svelte";

export type Tab = "input" | "proposals" | "chart";

export interface SampleInfo {
  file: string;
  truth: string;
  title: string;
  description: string;
  module: string;
  goal: string;
  rows: number;
}

interface Toast {
  id: number;
  kind: "info" | "success" | "error";
  text: string;
}

interface Saved {
  dataset: Dataset | null;
  moduleId: string;
  paramsByModule: Record<string, ParamValues>;
  nProposals: number;
  seed: number | null;
  runs: RunResult[];
  settings: Settings;
  truth: Table | null;
}

export interface Settings {
  /** 書き出す CSV に BOM を付ける（Excel で文字化けしない） */
  bom: boolean;
  /** 入力タブに予測の列を表示する */
  showPredictions: boolean;
}

const STORAGE_KEY = "nimo-webui:v1";

class AppState {
  dataset = $state.raw<Dataset | null>(null);
  /** 表の中身が変わるたびに進む（再描画・自動保存のきっかけ） */
  version = $state(0);
  encoding = $state<Encoding>("utf-8");
  moduleId = $state(DEFAULT_MODULE);
  paramsByModule = $state<Record<string, ParamValues>>({});
  nProposals = $state(3);
  seed = $state<number | null>(null);
  runs = $state.raw<RunResult[]>([]);
  tab = $state<Tab>("input");
  settings = $state<Settings>({ bom: true, showPredictions: true });
  toasts = $state<Toast[]>([]);
  helpOpen = $state<string | null>(null);
  /** 入力タブで選択・表示したい行（グラフや提案からのジャンプ用） */
  focusRow = $state<{ row: number; nonce: number } | null>(null);
  savedAt = $state<Date | null>(null);
  /** サンプルの真の値（仮想実験用）。利用者のファイルでは null */
  truth = $state.raw<Table | null>(null);
  restored = $state(false);

  // ------------------------------------------------------------ 派生値
  module = $derived(getModule(this.moduleId));
  summary = $derived.by(() => (this.version, this.dataset ? summarize(this.dataset) : null));
  context = $derived.by(() => (this.version, this.dataset ? moduleContext(this.dataset) : null));
  params = $derived.by(() => {
    const ctx = this.context;
    if (!ctx) return {};
    // 未設定の値は、データに合わせた初期値で補う
    return { ...defaultParams(this.module, ctx), ...(this.paramsByModule[this.moduleId] ?? {}) };
  });
  issues = $derived.by(() => {
    this.version;
    if (!this.dataset || !this.context) return [];
    const out = checkReady(this.dataset, this.module, this.nProposals);
    const msg = this.module.validate?.(this.params, this.context);
    if (msg) out.push({ level: "error" as const, message: msg });
    // 状態を持ち回る手法（SLESA）は、前回の提案がすべて測定済みでないと続けられない
    if (this.module.stateful) {
      const prev = [...this.runs].reverse().find((r) => r.method === this.module.id);
      const ys = this.summary?.yCols ?? [];
      const missing = (prev?.proposals ?? []).filter((p) => p.row !== null && ys.some((c) => isBlank(this.dataset!.rows[p.row!][c])));
      if (missing.length)
        out.push({
          level: "error" as const,
          message: `${this.module.id} を続けるには、前回の提案（行 ${missing.map((p) => p.row! + 1).join(", ")}）の結果を先に入力してください。`,
        });
    }
    return out;
  });
  lastRun = $derived(this.runs.at(-1) ?? null);
  /** 最新の提案に含まれる行番号 → 順位 */
  proposedRows = $derived.by(() => {
    const m = new Map<number, number>();
    for (const p of this.lastRun?.proposals ?? []) if (p.row !== null) m.set(p.row, p.rank);
    return m;
  });

  // ------------------------------------------------------------ 読み込み
  async openFile(file: File) {
    try {
      const { text, encoding } = decode(await file.arrayBuffer());
      this.load(file.name, text);
      this.encoding = encoding;
      const enc = encoding === "shift_jis" ? "（Shift_JIS として読み込みました）" : "";
      this.toast("success", `${file.name} を開きました${enc}`);
    } catch (e) {
      this.toast("error", `読み込めませんでした: ${e instanceof Error ? e.message : e}`);
    }
  }

  load(name: string, text: string) {
    const table = parseTable(text);
    this.dataset = makeDataset(name, table);
    this.truth = null;
    this.runs = [];
    this.tab = "input";
    this.encoding = "utf-8";
    this.touch();
  }

  async openSample(s: SampleInfo) {
    const url = (f: string) => new URL(`samples/${f}`, document.baseURI);
    const [text, truth] = await Promise.all([fetch(url(s.file)).then((r) => r.text()), fetch(url(s.truth)).then((r) => r.text())]);
    this.load(s.file, text);
    this.truth = parseTable(truth);
    this.selectModule(s.module);
    this.toast("success", `サンプル「${s.title}」を開きました`);
  }

  /**
   * サンプル用の「仮想実験」: 最新の提案の行に、真の値を書き込む。
   * 実験しなくてもサイクルを回して、手法の動きを体験できるようにするためのもの
   */
  fillVirtual() {
    const ds = this.dataset;
    const truth = this.truth;
    const run = this.lastRun;
    if (!ds || !truth || !run) return;
    let n = 0;
    for (const p of run.proposals) {
      if (p.row === null) continue;
      truth.header.forEach((name, k) => {
        const c = ds.header.indexOf(name);
        if (c >= 0 && ds.rows[p.row!][c] === "") {
          ds.rows[p.row!][c] = truth.rows[p.row!][k];
          n++;
        }
      });
    }
    this.touch();
    this.toast("success", n > 0 ? `仮想実験の結果を ${n} マスに入れました。もう一度「実行」で次の提案へ` : "入れる場所がありませんでした（入力済み）");
  }

  close() {
    this.dataset = null;
    this.truth = null;
    this.runs = [];
    this.touch();
  }

  // ------------------------------------------------------------ 編集
  touch() {
    this.version++;
    this.scheduleSave();
  }

  setRole(col: number, role: Role) {
    const ds = this.dataset;
    if (!ds) return;
    const roles = [...ds.roles];
    roles[col] = role;
    this.dataset = { ...ds, roles };
    this.touch();
  }

  /** 見出しのクリックで 説明変数 → 目的変数 → 使わない → … と切り替える */
  cycleRole(col: number) {
    const r = this.dataset?.roles[col];
    this.setRole(col, r === "x" ? "y" : r === "y" ? "ignore" : "x");
  }

  setDirection(col: number, d: Direction) {
    const ds = this.dataset;
    if (!ds) return;
    const directions = [...ds.directions];
    directions[col] = d;
    this.dataset = { ...ds, directions };
    this.touch();
  }

  setCell(row: number, col: number, value: string) {
    const ds = this.dataset;
    if (!ds) return;
    ds.rows[row][col] = value;
    this.touch();
  }

  setParam(key: string, value: ParamValues[string]) {
    this.paramsByModule = { ...this.paramsByModule, [this.moduleId]: { ...this.params, [key]: value } };
    this.scheduleSave();
  }

  selectModule(id: string) {
    this.moduleId = id;
    this.scheduleSave();
  }

  jumpToRow(row: number) {
    this.tab = "input";
    this.focusRow = { row, nonce: Math.random() };
  }

  // ------------------------------------------------------------ 実行
  canRun = $derived(!!this.dataset && !this.issues.some((i) => i.level === "error") && engine.status !== "running");

  async run() {
    const ds = this.dataset;
    if (!ds || !this.canRun || !this.context) return;
    const mod = this.module;
    const ctx = this.context;
    const { csv, negate } = buildNimoCsv(ds, mod);
    const options = mod.toOptions(this.params, ctx, this.seed);
    // SLESA は前回の状態ファイルを引き継ぐ
    const prev = mod.stateful ? [...this.runs].reverse().find((r) => r.method === mod.id) : undefined;
    try {
      const res = await engine.run({
        method: mod.id,
        csv,
        num_objectives: ctx.nObjectives,
        num_proposals: this.nProposals,
        options,
        state_files: prev?.stateFiles,
        seed: this.seed,
      });
      if (!res.ok) {
        this.toast("error", `${mod.id} の実行に失敗しました。下の「ログ」に詳細があります。`);
        this.lastError = { method: mod.id, message: res.error ?? "", log: res.log };
        return;
      }
      this.lastError = null;
      const settingsText = describeSettings(options, this.nProposals);
      const result = parseRun(ds, mod, res, negate, settingsText);
      this.runs = [...this.runs, result];
      this.tab = "proposals";
      this.toast("success", `${result.proposals.length} 件の提案が出ました（${res.seconds.toFixed(1)} 秒）`);
      this.scheduleSave();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.toast(msg === "中断しました" ? "info" : "error", msg);
    }
  }

  lastError = $state<{ method: string; message: string; log: string } | null>(null);

  /** COMBI のように候補表にない条件が提案されたとき、表の末尾に行として追加する（結果を入力できるように） */
  addNewProposalsToTable() {
    const ds = this.dataset;
    const run = this.lastRun;
    if (!ds || !run) return;
    const proposals = run.proposals.map((p) => {
      if (p.row !== null) return p;
      const row = ds.header.map((h) => {
        const i = run.xNames.indexOf(h);
        return i >= 0 ? String(Number(p.values[i])) : "";
      });
      ds.rows.push(row);
      return { ...p, row: ds.rows.length - 1 };
    });
    this.runs = [...this.runs.slice(0, -1), { ...run, proposals }];
    this.touch();
    this.toast("success", `${proposals.length} 行を候補表の末尾に追加しました。結果を入力してください`);
  }

  // ------------------------------------------------------------ 書き出し
  exportCandidates() {
    const ds = this.dataset;
    if (!ds) return;
    downloadText(`${baseName(ds.name)}.csv`, toCsv(ds), this.settings.bom);
  }

  exportProposals() {
    const ds = this.dataset;
    const run = this.lastRun;
    if (!ds || !run) return;
    // 提案は元の表と同じ列構成で書き出す（そのまま結果を書き込んで使えるように）
    const rows = run.proposals.map((p) =>
      p.row !== null ? [String(p.row + 1), ...ds.rows[p.row]] : ["", ...ds.header.map((h) => p.values[run.xNames.indexOf(h)] ?? "")],
    );
    const text = toCsv({ header: ["行番号", ...ds.header], rows });
    downloadText(`${baseName(ds.name)}_proposals_${run.method}_${today()}.csv`, text, this.settings.bom);
  }

  // ------------------------------------------------------------ 通知
  toast(kind: Toast["kind"], text: string) {
    const id = Date.now() + Math.random();
    this.toasts = [...this.toasts, { id, kind, text }];
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), kind === "error" ? 8000 : 4000);
  }

  // ------------------------------------------------------------ 自動保存（ブラウザ内の IndexedDB）
  #saveTimer: ReturnType<typeof setTimeout> | null = null;

  scheduleSave() {
    if (!this.restored) return;
    if (this.#saveTimer) clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => this.save(), 600);
  }

  async save() {
    const data: Saved = $state.snapshot({
      dataset: this.dataset,
      moduleId: this.moduleId,
      paramsByModule: this.paramsByModule,
      nProposals: this.nProposals,
      seed: this.seed,
      runs: this.runs,
      settings: this.settings,
      truth: this.truth,
    }) as Saved;
    try {
      await set(STORAGE_KEY, data);
      this.savedAt = new Date();
    } catch {
      /* 保存できない環境（プライベートモード等）では黙って諦める */
    }
  }

  async restore() {
    try {
      const s = (await get(STORAGE_KEY)) as Saved | undefined;
      if (s) {
        this.dataset = s.dataset;
        this.moduleId = s.moduleId ?? DEFAULT_MODULE;
        this.paramsByModule = s.paramsByModule ?? {};
        this.nProposals = s.nProposals ?? 3;
        this.seed = s.seed ?? null;
        this.runs = s.runs ?? [];
        this.truth = s.truth ?? null;
        this.settings = { ...this.settings, ...s.settings };
        this.version++;
      }
    } catch {
      /* 読めなければ空から始める */
    }
    this.restored = true;
  }
}

function describeSettings(options: Record<string, unknown>, n: number): string {
  const skip = new Set(["output_res", "training_res", "minimization", "other_datasets"]);
  const parts = Object.entries(options)
    .filter(([k, v]) => !skip.has(k) && v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`);
  return [`提案数=${n}`, ...parts].join(", ");
}

export const app = new AppState();

// 開発時だけ、ブラウザの自動テスト（scripts/smoke.mjs）から状態を操作できるようにする
if (import.meta.env.DEV) (globalThis as unknown as { __app: AppState }).__app = app;
