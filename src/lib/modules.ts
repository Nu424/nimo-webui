// nimo の選択モジュールの定義（説明・パラメータ・前提条件）を 1 か所にまとめたもの。
// 設定フォーム・実行前チェック・解説カードは、すべてこの定義から作る。
// 新しいモジュールを足すときは、ここに 1 項目追加すればよい。

import type { IconName } from "../components/Icon.svelte";

export type GoalId = "start" | "optimize" | "target" | "classify" | "explore" | "combi";

export interface Goal {
  id: GoalId;
  label: string;
  hint: string;
  icon: IconName;
}

export const GOALS: Goal[] = [
  { id: "optimize", label: "いちばん良い条件を探したい", hint: "目的変数を最大化・最小化する", icon: "target" },
  { id: "start", label: "まず最初の実験点を決めたい", hint: "データがまだ無い・少ないとき", icon: "sprout" },
  { id: "target", label: "狙った範囲に入る条件を探したい", hint: "目標値の範囲・しきい値の境目", icon: "ruler" },
  { id: "classify", label: "相図・分類の境界を描きたい", hint: "目的変数が「相」などのラベル", icon: "map" },
  { id: "explore", label: "物性の幅を広げたい", hint: "まだ見たことのない性質を探す", icon: "scope" },
  { id: "combi", label: "組成傾斜膜の実験を計画したい", hint: "2 元素の組成を連続的に変える", icon: "layers" },
];

/** 実行時に設定フォームへ渡す、データ側の情報 */
export interface ModuleContext {
  xCols: string[];
  yCols: string[];
  nObjectives: number;
  /** 観測済みの目的変数（数値）。目的変数ごと */
  observedValues: number[][];
}

interface ParamBase {
  key: string;
  label: string;
  help?: string;
  /** true なら「詳細設定」に畳んで表示する */
  advanced?: boolean;
}
export type ParamDef =
  | (ParamBase & { kind: "select"; options: { value: string; label: string; help?: string }[]; default: string | ((c: ModuleContext) => string) })
  | (ParamBase & { kind: "number"; min?: number; max?: number; step?: number; default: number | ((c: ModuleContext) => number) })
  | (ParamBase & { kind: "checkbox"; default: boolean })
  /** 目的変数ごとの [下限, 上限]。空欄は「観測値の最小/最大」 */
  | (ParamBase & { kind: "ranges" })
  /** 説明変数の中から複数を選ぶ */
  | (ParamBase & { kind: "columns" })
  /** 説明変数のペアを複数選ぶ */
  | (ParamBase & { kind: "pairs" })
  /** 説明変数ごとの [最小, 最大]（整数） */
  | (ParamBase & { kind: "colRanges"; default: [number, number] });

export type ParamValue = string | number | boolean | (number | "")[][] | number[] | number[][];
export type ParamValues = Record<string, ParamValue>;

export interface ModuleDef {
  id: string;
  /** 正式な手法名 */
  fullName: string;
  /** 日本語のひとこと名 */
  title: string;
  goals: GoalId[];
  /** カードに出す 1 行の説明 */
  catchphrase: string;
  /** しくみ（2〜3 文） */
  how: string;
  /** 使いどころ・注意 */
  tips: string[];
  figure: string;
  objectives: { min: number; max: number };
  objectiveKind: "number" | "label";
  /** 必要な観測済み行の数 */
  minObserved: number;
  /** ラベルの種類（PDC など）の最低数 */
  minClasses?: number;
  /**
   * 最大化/最小化の扱い。
   *  flag: nimo の minimization 引数がある（画面では目的変数ごとに指定し、内部で符号をそろえる）
   *  minimizes: 常に「小さいほど良い」とみなす手法
   *  none: 方向の概念がない
   */
  direction: "flag" | "minimizes" | "none";
  /** 予測値（output_res.csv）を出せるか */
  predictions: boolean;
  /** 提案が候補表の行ではなく、新しい条件として出てくる（COMBI） */
  proposesNewRows?: boolean;
  /** 実行をまたいで状態ファイルを持ち回る（SLESA） */
  stateful?: boolean;
  params: ParamDef[];
  /** 設定値のチェック。問題があればメッセージを返す */
  validate?: (v: ParamValues, c: ModuleContext) => string | null;
  /** 画面の設定値 → nimo.selection のキーワード引数 */
  toOptions: (v: ParamValues, c: ModuleContext, seed: number | null) => Record<string, unknown>;
  docUrl?: string;
  /** 出典（論文など） */
  reference?: string;
}

const DOC = "https://nims-da.github.io/nimo/en/ai_tools_manual_en.html#";

const median = (a: number[]) => {
  if (a.length === 0) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

const scoreSingle = [
  { value: "EI", label: "EI（期待改善量）", help: "今の最良値をどれだけ上回りそうかの期待値。迷ったらこれ" },
  { value: "PI", label: "PI（改善確率）", help: "最良値を上回る確率。堅実に少しずつ改善したいとき" },
  { value: "TS", label: "TS（トンプソンサンプリング）", help: "予測のばらつきから 1 回くじを引く。探索寄りで、複数提案が散らばりやすい" },
];
const scoreMulti = [
  { value: "TS", label: "TS（トンプソンサンプリング）", help: "多目的の既定。速い" },
  { value: "HVPI", label: "HVPI（超体積改善確率）", help: "パレート front を広げる確率" },
  { value: "EHVI", label: "EHVI（期待超体積改善量）", help: "パレート front の広がりの期待値。計算が重め" },
];

export const MODULES: ModuleDef[] = [
  {
    id: "PHYSBO",
    fullName: "PHYSBO（ベイズ最適化）",
    title: "ベイズ最適化",
    goals: ["optimize"],
    catchphrase: "これまでの結果から「次に良さそうな条件」を予測して選ぶ、いちばん定番の方法",
    how: "実験済みのデータから、すべての候補について「予測値」と「どれくらい自信がないか（不確かさ）」を見積もります（ガウス過程回帰）。予測値が良い候補と、まだよくわかっていない候補のバランスを取って次の実験点を選びます。",
    tips: [
      "目的変数は 1 つでも複数（多目的）でも使えます。複数のときは、どちらも良い「パレート解」を探します",
      "実験済みが数点（目安 3〜5 点以上）あると効果的です。無いときは「まず最初の実験点を決めたい」の手法から始めましょう",
      "実行後、表に予測値・不確かさ・獲得関数（次に選ぶ価値）が並びます",
    ],
    figure: "bo",
    objectives: { min: 1, max: 8 },
    objectiveKind: "number",
    minObserved: 2,
    direction: "flag",
    predictions: true,
    params: [
      {
        key: "score",
        label: "獲得関数（次の点の選び方）",
        kind: "select",
        options: [...scoreSingle, ...scoreMulti.filter((o) => o.value !== "TS")],
        default: (c) => (c.nObjectives > 1 ? "TS" : "EI"),
        help: "目的変数が 1 つなら EI/PI/TS、複数なら TS/HVPI/EHVI",
      },
    ],
    toOptions: (v) => ({ physbo_score: v.score, minimization: false, output_res: true, training_res: true }),
    docUrl: DOC + "physbo-bayesian-optimization",
    reference: "PHYSBO: Y. Motoyama et al., Comput. Phys. Commun. 278, 108405 (2022)",
  },
  {
    id: "NTS",
    fullName: "NTS（Nested Thompson Sampling）",
    title: "入れ子トンプソンサンプリング",
    goals: ["optimize"],
    catchphrase: "「今の最良値を超えそうな候補」を、確率の高さで選ぶベイズ最適化の一種",
    how: "実験済みの最良値をもとにしきい値を決め、それを超える確率が高い候補を選びます。予測のばらつきを使って何度もくじを引くので、選ばれる点が自然に散らばります。",
    tips: [
      "目的変数は 1 つだけ",
      "「攻める/ふつう/慎重」で、しきい値の厳しさを選べます",
      "ほかの手法より計算に時間がかかります（数秒〜十数秒）",
    ],
    figure: "bo",
    objectives: { min: 1, max: 1 },
    objectiveKind: "number",
    minObserved: 2,
    direction: "flag",
    predictions: true,
    params: [
      {
        key: "mode",
        label: "攻め具合",
        kind: "select",
        options: [
          { value: "aggressive", label: "攻める（0.99）", help: "最良値を大きく超える点を狙う" },
          { value: "moderate", label: "ふつう（0.95）" },
          { value: "conservative", label: "慎重（0.90）", help: "確実に改善しそうな点を選ぶ" },
        ],
        default: "moderate",
      },
    ],
    toOptions: (v, _c, seed) => ({ sample_mode: v.mode, minimization: false, re_seed: seed, output_res: true }),
    docUrl: DOC + "nts-nested-thompson-sampling",
  },
  {
    id: "BOMP",
    fullName: "BOMP（プロセス条件を固定したベイズ最適化）",
    title: "条件の一部を固定して最適化",
    goals: ["optimize"],
    catchphrase: "温度など「次の実験では変えにくい条件」をそろえたまま、残りの条件を最適化する",
    how: "PHYSBO と同じベイズ最適化ですが、指定した説明変数（プロセス条件）をまず 1 つの値に決め、その値で固定したまま残りの変数の中から次の点を選びます。1 回の実験でまとめて作る試料の条件をそろえたいときに便利です。",
    tips: ["固定したい列を「固定する説明変数」で選んでください", "目的変数が複数でも使えます"],
    figure: "process",
    objectives: { min: 1, max: 8 },
    objectiveKind: "number",
    minObserved: 2,
    direction: "flag",
    predictions: true,
    params: [
      { key: "process", label: "固定する説明変数", kind: "columns", help: "提案の中でそろえたい条件（例: 焼成温度）" },
      { key: "score", label: "獲得関数", kind: "select", options: scoreSingle, default: "EI" },
    ],
    validate: (v) => (((v.process as number[]) ?? []).length === 0 ? "「固定する説明変数」を 1 つ以上選んでください。" : null),
    toOptions: (v) => ({ physbo_score: v.score, process_X: v.process, minimization: false, output_res: true, training_res: true }),
    docUrl: DOC + "bomp-bayesian-optimization-with-material-process",
  },
  {
    id: "RSVM",
    fullName: "RSVM（ランキング SVM）",
    title: "順位で学ぶ最適化",
    goals: ["optimize"],
    catchphrase: "値そのものではなく「どちらが良いか」の順位を学んで候補を並べる",
    how: "実験済みのデータから「A は B より良い」という順位の関係を学び（ランキング SVM）、未実験の候補に良さのスコアを付けて上位を選びます。測定日や装置で値の基準がずれていても、順位は信頼できるときに向いています。",
    tips: ["目的変数は 1 つ", "予測は「スコア」で、目的変数の値そのものではありません"],
    figure: "rank",
    objectives: { min: 1, max: 1 },
    objectiveKind: "number",
    minObserved: 3,
    direction: "flag",
    predictions: true,
    params: [],
    toOptions: () => ({ other_datasets: [], minimization: false, output_res: true }),
    docUrl: DOC + "rsvm-ranking-support-vector-machine",
    reference: "Patterns 4, 100736 (2023)",
  },
  {
    id: "SLESA",
    fullName: "SLESA（焼きなまし型サンプリング）",
    title: "徐々に絞り込むサンプリング",
    goals: ["optimize"],
    catchphrase: "サイクルを重ねるごとに、良い候補の周りへ少しずつ集中していく",
    how: "1 回目はランダムに選びます。2 回目以降は予測値をエネルギーとみなし、「温度」を下げながら（焼きなまし）良い候補ほど選ばれやすい確率で抽選します。最初は広く、後半は良い領域に集中します。",
    tips: [
      "実行のたびに温度が 1 段下がります。前回までの状態はこのアプリが自動で引き継ぎます",
      "決めた回数（サイクル数）に達すると終了します。途中で提案数を変えないでください",
      "目的変数は 1 つ",
    ],
    figure: "anneal",
    objectives: { min: 1, max: 1 },
    objectiveKind: "number",
    minObserved: 0,
    direction: "minimizes",
    predictions: true,
    stateful: true,
    params: [
      { key: "betaMax", label: "最終的な絞り込みの強さ（β の最大値）", kind: "number", min: 1, step: 1, default: 20, help: "大きいほど、終盤に良い候補へ強く集中します" },
      { key: "betaNum", label: "サイクル数", kind: "number", min: 2, step: 1, default: 10, help: "何回の実行で絞り込みを終えるか" },
    ],
    toOptions: (v, _c, seed) => ({ slesa_beta_max: v.betaMax, slesa_beta_num: v.betaNum, re_seed: seed ?? undefined, output_res: true }),
  },
  {
    id: "RE",
    fullName: "RE（ランダム探索）",
    title: "ランダムに選ぶ",
    goals: ["start"],
    catchphrase: "未実験の候補からランダムに選ぶ。最初の数点や、比較の基準に",
    how: "まだ実験していない候補の中から、くじ引きのように選びます。データが無くても使えます。",
    tips: ["最初の数点を決めて、次からベイズ最適化（PHYSBO）に切り替えるのが定番の流れです"],
    figure: "random",
    objectives: { min: 1, max: 8 },
    objectiveKind: "number",
    minObserved: 0,
    direction: "none",
    predictions: false,
    params: [],
    toOptions: (_v, _c, seed) => ({ re_seed: seed }),
    docUrl: DOC + "re-random-exploration",
  },
  {
    id: "DOE",
    fullName: "DOE（実験計画法）",
    title: "まんべんなく選ぶ",
    goals: ["start"],
    catchphrase: "探索空間の全体にまんべんなく散らばるように選ぶ",
    how: "候補どうし・実験済みの点との距離などを手がかりに、偏りなく空間を覆う点を選びます。ランダムより少ない点数で全体の傾向をつかめます。",
    tips: [
      "「距離」がおすすめ。実験済みの点から遠い候補を順に選びます",
      "「D 最適」は、後で直線的な回帰モデルを作るのに効率の良い点を選びます",
    ],
    figure: "spread",
    objectives: { min: 1, max: 8 },
    objectiveKind: "number",
    minObserved: 0,
    direction: "none",
    predictions: false,
    params: [
      {
        key: "mode",
        label: "選び方",
        kind: "select",
        options: [
          { value: "distance", label: "距離（おすすめ）", help: "既存の点から最も遠い候補を順に選ぶ" },
          { value: "lhs", label: "ラテン超方格（LHS）", help: "各変数の範囲を均等に区切って割り当てる" },
          { value: "d_optimal", label: "D 最適", help: "回帰モデルの係数を精度よく決められる点を選ぶ" },
          { value: "greedy", label: "貪欲法", help: "1 点ずつ最も効く点を足していく" },
        ],
        default: "distance",
      },
      { key: "maxIter", label: "交換の反復回数", kind: "number", min: 1, step: 100, default: 1000, advanced: true, help: "D 最適などの探索の反復回数" },
    ],
    toOptions: (v) => ({ mode: v.mode, max_iter: v.maxIter }),
    docUrl: DOC + "doe-design-of-experiments",
  },
  {
    id: "ES",
    fullName: "ES（全探索）",
    title: "上から順に選ぶ",
    goals: ["start"],
    catchphrase: "候補表の上から順に、未実験の行を選ぶ",
    how: "最適化はせず、候補表の並び順どおりに提案します。候補が少なく全部試す予定のときや、決まった順で進めたいときに使います。",
    tips: ["表を並べ替えておくと、その順に提案されます"],
    figure: "order",
    objectives: { min: 1, max: 8 },
    objectiveKind: "number",
    minObserved: 0,
    direction: "none",
    predictions: false,
    params: [],
    toOptions: () => ({}),
    docUrl: DOC + "es-exhaustive-search",
  },
  {
    id: "PTR",
    fullName: "PTR（目標範囲に入る確率）",
    title: "目標範囲に入れる",
    goals: ["target"],
    catchphrase: "「この値からこの値の間に入れたい」という条件を満たしそうな候補を選ぶ",
    how: "ガウス過程回帰で各候補の値を予測し、目標範囲に入る確率がいちばん高い候補を選びます。最大・最小ではなく「ちょうどいい値」を狙うときに使います。",
    tips: [
      "目的変数ごとに下限・上限を入れます。片側だけなら、もう片方は空欄（＝制限なし）にします",
      "目的変数が複数なら、すべての範囲に同時に入る確率で選びます",
    ],
    figure: "range",
    objectives: { min: 1, max: 8 },
    objectiveKind: "number",
    minObserved: 2,
    direction: "none",
    predictions: true,
    params: [{ key: "ranges", label: "目標範囲", kind: "ranges", help: "空欄は制限なし" }],
    toOptions: (v, c) => ({
      ptr_ranges: c.yCols.map((_, i) => {
        const r = (v.ranges as (number | "")[][] | undefined)?.[i] ?? ["", ""];
        return [r[0] === "" ? "min" : r[0], r[1] === "" ? "max" : r[1]];
      }),
      output_res: true,
    }),
    docUrl: DOC + "ptr-probability-of-target-range",
  },
  {
    id: "LSE",
    fullName: "LSE（レベル集合推定）",
    title: "しきい値の境目を調べる",
    goals: ["target"],
    catchphrase: "目的変数が「しきい値より上か下か」の境目を、少ない実験で見きわめる",
    how: "ガウス過程回帰で各候補がしきい値より上か下かの確率を見積もり、どちらとも言い切れない候補（境目の近く）を優先して選びます。最適値ではなく「基準を満たす領域」を知りたいときに使います。",
    tips: [
      "目的変数は 1 つ。実験済みが 2 点以上必要です",
      "結果の表で、各候補が「上」「下」「未確定」のどれと判定されたかが見られます",
    ],
    figure: "threshold",
    objectives: { min: 1, max: 1 },
    objectiveKind: "number",
    minObserved: 2,
    direction: "none",
    predictions: true,
    params: [
      { key: "threshold", label: "しきい値", kind: "number", default: (c) => median(c.observedValues[0] ?? []), help: "初期値は実験済みの値の中央値" },
      { key: "epsilon", label: "許容幅（空欄で自動）", kind: "number", min: 0, default: NaN, advanced: true, help: "しきい値の前後でどこまでを「境目」とみなすか" },
    ],
    validate: (v) => (Number.isFinite(v.threshold as number) ? null : "しきい値を入力してください。"),
    toOptions: (v) => ({
      lse_threshold: v.threshold,
      lse_epsilon: typeof v.epsilon === "number" && Number.isFinite(v.epsilon) && v.epsilon > 0 ? v.epsilon : null,
      output_res: true,
    }),
  },
  {
    id: "PDC",
    fullName: "PDC（相図作成）",
    title: "相図を描く",
    goals: ["classify"],
    catchphrase: "「どの条件でどの相になるか」の境界を、少ない実験で描く",
    how: "実験済みの点のラベル（相の名前など）を近くの候補へ伝えていき（ラベル伝播）、すべての候補の相を推定します。そのうえで「どの相か自信がない」候補、つまり相境界の近くを優先して選びます。",
    tips: [
      "目的変数は相などのラベル 1 列（数字でも文字でも可）",
      "2 種類以上のラベルが観測済みである必要があります",
      "実行後、各候補がどの相と推定されたかと、その確率が表に並びます",
    ],
    figure: "phase",
    objectives: { min: 1, max: 1 },
    objectiveKind: "label",
    minObserved: 2,
    minClasses: 2,
    direction: "none",
    predictions: true,
    params: [
      {
        key: "estimation",
        label: "推定の方法",
        kind: "select",
        options: [
          { value: "LP", label: "ラベル伝播（LP）", help: "観測済みのラベルを固定して伝える" },
          { value: "LS", label: "ラベル拡散（LS）", help: "観測ラベルの誤りも少し許す。ノイズがあるとき向け" },
        ],
        default: "LP",
      },
      {
        key: "sampling",
        label: "選び方",
        kind: "select",
        options: [
          { value: "LC", label: "最も自信がない（LC）", help: "いちばん確率の高い相でも確率が低い候補" },
          { value: "MS", label: "1 位と 2 位が僅差（MS）", help: "2 つの相のどちらか迷っている候補" },
          { value: "EA", label: "エントロピー（EA）", help: "全部の相に確率が散らばっている候補" },
        ],
        default: "LC",
      },
    ],
    toOptions: (v) => ({ pdc_estimation: v.estimation, pdc_sampling: v.sampling, output_res: true }),
    docUrl: DOC + "pdc-phase-diagram-construction",
  },
  {
    id: "BALD",
    fullName: "BALD（ベイズ能動学習）",
    title: "分類が割れる点を調べる",
    goals: ["classify"],
    catchphrase: "分類モデルの「意見が割れる」候補を選び、ラベルの境界を効率よく決める",
    how: "ラベル（相など）を予測する分類モデルを、もっともらしいものを何千通りも用意して考えます。それらの予測がばらばらになる候補ほど、実験すると多くのことがわかるので優先して選びます。",
    tips: [
      "目的変数はラベル 1 列。観測済みのラベルが 1 種類しかないうちはランダムに選びます",
      "PDC と目的は同じです。結果を比べてみるのもおすすめ",
    ],
    figure: "classify",
    objectives: { min: 1, max: 1 },
    objectiveKind: "label",
    minObserved: 0,
    direction: "none",
    predictions: false,
    params: [
      { key: "lengthscale", label: "滑らかさ（長さスケール）", kind: "number", min: 0.01, step: 0.05, default: 0.25, advanced: true, help: "各変数を 0〜1 に縮めたときの、ラベルが変わる距離の目安" },
    ],
    toOptions: (v, _c, seed) => ({ bald_lengthscale: v.lengthscale, bald_seed: seed ?? 0 }),
  },
  {
    id: "BLOX",
    fullName: "BLOX（目的を決めない探索）",
    title: "未知の物性を探す",
    goals: ["explore"],
    catchphrase: "「最大」ではなく、これまでと違う性質の組み合わせを示しそうな候補を選ぶ",
    how: "ランダムフォレストで各候補の物性を予測し、物性の空間でこれまでの観測から最も離れた（新しさが大きい）候補を選びます（Stein novelty）。目的変数を 2 つ以上にすると、物性どうしの組み合わせの新しさで探索します。",
    tips: ["目的変数は 2 つ以上がおすすめ（1 つでも動きます）", "観測済みが数点必要です"],
    figure: "novelty",
    objectives: { min: 1, max: 8 },
    objectiveKind: "number",
    minObserved: 3,
    direction: "none",
    predictions: true,
    params: [
      {
        key: "batch",
        label: "まとめて提案するときの更新",
        kind: "select",
        options: [
          { value: "fixed", label: "固定（速い）" },
          { value: "refit", label: "1 点ごとに学習し直す（丁寧）" },
        ],
        default: "fixed",
        advanced: true,
      },
    ],
    toOptions: (v) => ({ blox_batch_mode: v.batch, output_res: true }),
    docUrl: DOC + "blox-boundless-objective-free-exploration",
  },
  {
    id: "COMBI",
    fullName: "COMBI（組成傾斜の探索）",
    title: "組成傾斜膜を設計する",
    goals: ["combi"],
    catchphrase: "最も良さそうな組成から、2 元素の比を連続的に変える「組成傾斜」を提案する",
    how: "まずベイズ最適化で最も良さそうな組成を選びます。次に、そこから 2 つの元素の比だけを連続的に変えた組成の列を作り、効果が大きそうな元素ペアを選んで提案します。提案数は傾斜を何分割するかを表します。",
    tips: [
      "説明変数は元素の組成（百分率の整数、合計 100）にしてください",
      "提案は候補表の行ではなく、新しい組成として出てきます",
    ],
    figure: "combi",
    objectives: { min: 1, max: 1 },
    objectiveKind: "number",
    minObserved: 2,
    direction: "flag",
    predictions: false,
    proposesNewRows: true,
    params: [
      { key: "pairs", label: "傾斜させる元素のペア", kind: "pairs", help: "既定はすべての組み合わせ" },
      { key: "ranges", label: "各元素の組成範囲（%）", kind: "colRanges", default: [0, 100], advanced: true },
      { key: "score", label: "獲得関数", kind: "select", options: scoreSingle, default: "EI", advanced: true },
    ],
    validate: (v) => (((v.pairs as number[][]) ?? []).length === 0 ? "傾斜させる元素のペアを 1 つ以上選んでください。" : null),
    toOptions: (v, c) => ({
      physbo_score: v.score,
      minimization: false,
      spread_elements: v.pairs,
      combi_ranges: (v.ranges as number[][] | undefined) ?? c.xCols.map(() => [0, 100]),
    }),
    docUrl: DOC + "combi-composition-spread-exploration",
  },
];

export const DEFAULT_MODULE = "PHYSBO";

export function getModule(id: string): ModuleDef {
  return MODULES.find((m) => m.id === id) ?? MODULES[0];
}

/** パラメータの初期値をデータに合わせて作る */
export function defaultParams(mod: ModuleDef, c: ModuleContext): ParamValues {
  const v: ParamValues = {};
  for (const p of mod.params) {
    switch (p.kind) {
      case "select":
      case "number":
        v[p.key] = typeof p.default === "function" ? p.default(c) : p.default;
        break;
      case "checkbox":
        v[p.key] = p.default;
        break;
      case "ranges":
        v[p.key] = c.yCols.map(() => ["", ""] as (number | "")[]);
        break;
      case "columns":
        v[p.key] = [];
        break;
      case "pairs":
        v[p.key] = allPairs(c.xCols.length);
        break;
      case "colRanges":
        v[p.key] = c.xCols.map(() => [...p.default]);
        break;
    }
  }
  return v;
}

export function allPairs(n: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
}

/** 多目的かどうかで選べる獲得関数が変わるので、表示する選択肢を絞る */
export function visibleOptions(mod: ModuleDef, p: ParamDef, c: ModuleContext) {
  if (p.kind !== "select") return [];
  if (mod.id === "PHYSBO" && p.key === "score") return c.nObjectives > 1 ? scoreMulti : scoreSingle;
  return p.options;
}
