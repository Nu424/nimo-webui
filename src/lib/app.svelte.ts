// アプリ全体の状態と操作。画面の部品はここを読み書きする。
// 表のデータは大きくなりうるので $state.raw で持ち、編集時は version を進めて再描画を知らせる。
import { get, set } from "idb-keyval";
import { baseName, decode, downloadText, parseTable, today, toCsv, type Encoding, type Table } from "./data/csv";
import { buildNimoCsv, checkReady, isBlank, makeDataset, moduleContext, summarize, type Dataset, type Direction, type Role } from "./data/dataset";
import { parseRun, type RunResult } from "./data/results";
import { defaultParams, DEFAULT_MODULE, getModule, visibleOptions, type ParamValues } from "./modules";
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
  /** 読み込み直後に「列の役割を確認してください」と案内する */
  showRoleNotice = $state(false);
  /** サンプルの真の値（仮想実験用）。利用者のファイルでは null */
  truth = $state.raw<Table | null>(null);
  restored = $state(false);
  /** ファイルを開くたびに進む番号。実行中に別のファイルを開いたら、戻ってきた結果を捨てるために使う */
  #loadId = 0;
  /** 実行ボタンを押してから結果が返るまで true（Python の準備待ちを含む）。二重実行を防ぐ */
  busy = $state(false);

  // ------------------------------------------------------------ 派生値
  module = $derived(getModule(this.moduleId));
  summary = $derived.by(() => (this.version, this.dataset ? summarize(this.dataset) : null));
  context = $derived.by(() => (this.version, this.dataset ? moduleContext(this.dataset) : null));
  params = $derived.by(() => {
    const ctx = this.context;
    if (!ctx) return {};
    // 未設定の値は、データに合わせた初期値で補う。保存値が今のデータに合わない（選択肢にない・列数が違う）なら初期値を使う
    const defaults = defaultParams(this.module, ctx);
    const saved = this.paramsByModule[this.moduleId] ?? {};
    const out: ParamValues = { ...defaults };
    for (const p of this.module.params) {
      const v = saved[p.key];
      if (v === undefined) continue;
      if (p.kind === "select" && !visibleOptions(this.module, p, ctx).some((o) => o.value === v)) continue;
      if (p.kind === "ranges" && (v as unknown[]).length !== ctx.yCols.length) continue;
      if (p.kind === "colRanges" && (v as unknown[]).length !== ctx.xCols.length) continue;
      if ((p.kind === "columns" || p.kind === "pairs") && (v as number[] | number[][]).flat().some((i) => i >= ctx.xCols.length)) continue;
      out[p.key] = v;
    }
    return out;
  });
  issues = $derived.by(() => {
    this.version;
    if (!this.dataset || !this.context) return [];
    const out = checkReady(this.dataset, this.module, this.nProposals);
    if (!Number.isInteger(this.nProposals) || this.nProposals < 1) out.unshift({ level: "error" as const, message: "提案数は 1 以上の整数にしてください。" });
    const msg = this.module.validate?.(this.params, this.context);
    if (msg) out.push({ level: "error" as const, message: msg });
    // 状態を持ち回る手法（SLESA）は、前回の提案がすべて測定済みでないと続けられない
    if (this.module.stateful) {
      const prev = [...this.runs].reverse().find((r) => r.method === this.module.id);
      const ds = this.dataset;
      const ys = (prev?.yNames ?? []).map((n) => ds.header.indexOf(n)).filter((c) => c >= 0);
      const missing = (prev?.proposals ?? []).filter((p) => p.row !== null && ys.some((c) => isBlank(ds.rows[p.row!]?.[c])));
      if (missing.length)
        out.push({
          level: "error" as const,
          message: `${this.module.id} を続けるには、前回の提案（行 ${missing.map((p) => p.row! + 1).join(", ")}）の結果を先に入力してください。`,
        });
    }
    return out;
  });
  lastRun = $derived(this.runs.at(-1) ?? null);
  /** 直近の実行のあとで列の役割が変わり、提案・予測が今の設定と合わなくなっている */
  runStale = $derived.by(() => {
    const run = this.lastRun;
    const ctx = this.context;
    if (!run || !ctx) return false;
    return run.xNames.join("\u0000") !== ctx.xCols.join("\u0000") || run.yNames.join("\u0000") !== ctx.yCols.join("\u0000");
  });
  /** 最新の提案に含まれる行番号 → 順位（古い結果なら空） */
  proposedRows = $derived.by(() => {
    const m = new Map<number, number>();
    if (this.runStale) return m;
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
    this.#loadId++;
    this.restored = true; // 復元より後に開いたファイルを優先する
    this.dataset = makeDataset(name, table);
    this.paramsByModule = {};
    this.lastError = null;
    this.showRoleNotice = true;
    this.truth = null;
    this.runs = [];
    this.tab = "input";
    this.encoding = "utf-8";
    this.touch();
  }

  async openSample(s: SampleInfo) {
    const get = async (f: string) => {
      const r = await fetch(new URL(`samples/${f}`, document.baseURI));
      if (!r.ok) throw new Error(`${f} を取得できませんでした（${r.status}）`);
      return r.text();
    };
    try {
      const [text, truth] = await Promise.all([get(s.file), get(s.truth)]);
      this.load(s.file, text);
      this.truth = parseTable(truth);
      this.selectModule(s.module);
      this.toast("success", `サンプル「${s.title}」を開きました`);
    } catch (e) {
      this.toast("error", `サンプルを開けませんでした: ${e instanceof Error ? e.message : e}`);
    }
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
    let noTruth = 0;
    for (const p of run.proposals) {
      if (p.row === null || p.row >= truth.rows.length) {
        noTruth++;
        continue;
      }
      truth.header.forEach((name, k) => {
        const c = ds.header.indexOf(name);
        if (c >= 0 && ds.rows[p.row!][c] === "") {
          ds.rows[p.row!][c] = truth.rows[p.row!][k];
          n++;
        }
      });
    }
    this.touch();
    if (n > 0) this.toast("success", `仮想実験の結果を ${n} マスに入れました。もう一度「提案を出す」で次の提案へ`);
    else if (noTruth > 0) this.toast("info", "この提案はサンプルの候補にない新しい条件なので、仮想実験の値がありません");
    else this.toast("info", "すべて入力済みです");
  }

  close() {
    this.#loadId++;
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
    if (!ds.rows[row]) return;
    ds.rows[row][col] = value;
    this.touch();
  }

  setParam(key: string, value: ParamValues[string]) {
    this.paramsByModule = { ...this.paramsByModule, [this.moduleId]: { ...(this.paramsByModule[this.moduleId] ?? {}), [key]: value } };
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
  canRun = $derived(!!this.dataset && !this.issues.some((i) => i.level === "error") && !this.busy);

  async run() {
    const ds = this.dataset;
    if (!ds || !this.canRun || !this.context) return;
    this.busy = true; // 押した瞬間に固定（Python の準備待ちの間に何度押されても 1 回だけ）
    const loadId = this.#loadId;
    const mod = this.module;
    const ctx = this.context;
    // 実行中に表が編集されても結果の対応づけがずれないよう、実行時点の表を写しておく
    const snapshot: Dataset = { ...ds, rows: ds.rows.map((r) => [...r]) };
    const { csv, negate } = buildNimoCsv(snapshot, mod);
    const options = mod.toOptions(this.params, ctx, this.seed);
    const nProposals = this.nProposals;
    // SLESA は前回の状態ファイルを引き継ぐ
    const prev = mod.stateful ? [...this.runs].reverse().find((r) => r.method === mod.id) : undefined;
    try {
      const res = await engine.run({
        method: mod.id,
        csv,
        num_objectives: ctx.nObjectives,
        num_proposals: nProposals,
        options,
        state_files: prev?.stateFiles,
        seed: this.seed,
      });
      if (loadId !== this.#loadId) {
        this.toast("info", "計算中に別のファイルが開かれたため、結果を破棄しました");
        return;
      }
      if (!res.ok) {
        this.lastError = { method: mod.id, message: res.error ?? "", log: res.log };
        this.tab = "proposals";
        this.toast("error", `${mod.id} の実行に失敗しました。「提案」タブに理由を表示しています。`);
        return;
      }
      this.lastError = null;
      const settingsText = describeSettings(options, nProposals);
      const result = parseRun(snapshot, mod, res, negate, settingsText);
      this.runs = [...this.runs, result];
      this.tab = "proposals";
      this.toast("success", `${result.proposals.length} 件の提案が出ました（${res.seconds.toFixed(1)} 秒）`);
      this.scheduleSave();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.toast(msg === "中断しました" ? "info" : "error", msg);
    } finally {
      this.busy = false;
    }
  }

  lastError = $state<{ method: string; message: string; log: string } | null>(null);

  /** COMBI のように候補表にない条件が提案されたとき、表の末尾に行として追加する（結果を入力できるように） */
  addNewProposalsToTable() {
    const ds = this.dataset;
    const run = this.lastRun;
    if (!ds || !run || !run.proposals.some((p) => p.row === null)) return;
    const added = run.proposals.filter((p) => p.row === null).length;
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
    this.toast("success", `${added} 行を候補表の末尾に追加しました。結果を入力してください`);
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
      if (s && !this.restored) {
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
