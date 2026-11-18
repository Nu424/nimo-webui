// 画面（メインスレッド）と Pyodide ワーカーの間でやりとりするメッセージの型

export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/** 同梱している純 Python wheel（public/wheels/）。physbo / odat-se は PyPI に wheel が無いため自前ビルド */
export const BUNDLED_WHEELS = [
  "physbo-3.2.1-py3-none-any.whl",
  "odat_se-4.0.1-py3-none-any.whl",
  "pydoe3-1.6.2-py2.py3-none-any.whl",
  "nimo-2.1.8-py3-none-any.whl",
];

export interface RunRequest {
  method: string;
  csv: string;
  num_objectives: number;
  num_proposals: number;
  options: Record<string, unknown>;
  state_files?: Record<string, string>;
  seed?: number | null;
}

export interface RunResponse {
  ok: boolean;
  error: string | null;
  log: string;
  /** 生成されたファイル名 → 中身（proposals.csv, output_res.csv など） */
  files: Record<string, string>;
}

export interface Versions {
  python: string;
  nimo: string;
  physbo: string;
  numpy: string;
}

export type ToWorker =
  | { type: "init"; baseUrl: string }
  | { type: "run"; id: number; req: RunRequest };

export type FromWorker =
  | { type: "progress"; label: string; ratio: number }
  | { type: "ready"; versions: Versions; seconds: number }
  | { type: "init-error"; message: string }
  | { type: "result"; id: number; res: RunResponse; seconds: number };
