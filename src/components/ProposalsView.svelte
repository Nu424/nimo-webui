<script lang="ts">
  // 提案タブ「次の実験」: 直近の提案を表で並べ、実験結果をここから直接入力できるようにする。
  // 入力は元の候補表の同じ行に書き込まれる（候補表タブを探し回らなくてよい）。
  // 予測は「予測値 ± 不確かさ」の横棒で示し、これまでの最良値（破線）と比べられるようにする。
  import { app } from "../lib/app.svelte";
  import { isBlank } from "../lib/data/dataset";
  import { getModule } from "../lib/modules";
  import Icon from "./Icon.svelte";

  const run = $derived(app.lastRun);
  /** 表のセルの値（app.version を読んで、編集のたびに追従させる） */
  const cell = (row: number, col: number) => (app.version >= 0 ? (ds.rows[row]?.[col] ?? "") : "");
  const ds = $derived(app.dataset!);
  const yCols = $derived((app.version, ds.roles.flatMap((r, i) => (r === "y" ? [i] : []))));
  const filled = $derived.by(() => {
    app.version;
    if (!run) return 0;
    return run.proposals.filter((p) => p.row !== null && yCols.every((c) => !isBlank(ds.rows[p.row!]?.[c]))).length;
  });
  const total = $derived(run?.proposals.filter((p) => p.row !== null).length ?? 0);
  const fmt = (v: unknown) => (typeof v === "number" ? (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2) : v.toPrecision(4).replace(/\.?0+$/, "")) : String(v ?? ""));
  const time = (iso: string) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  const allPred = $derived(run?.predictions?.columns.map((c, k) => ({ ...c, k })) ?? []);
  const toNum = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

  /** 目的変数ごとの予測の横棒（予測値と不確かさの列がそろっているときだけ） */
  const bars = $derived.by(() => {
    app.version;
    if (!run?.predictions) return [];
    return yCols.flatMap((c) => {
      const name = ds.header[c];
      const mean = allPred.find((p) => p.kind === "mean" && p.target === name);
      if (!mean) return [];
      const sd = allPred.find((p) => p.kind === "sd" && p.target === name);
      const val = (row: number, k: number | undefined) => (k === undefined ? null : toNum(run.predictions!.byRow[row]?.[k]));
      const observed = ds.rows.map((r) => toNum(r[c])).filter((v): v is number => v !== null);
      // 「これまでの最良」は提案より前の値で決める（提案の行に入れた結果は含めない）
      const proposedRows = new Set(run.proposals.flatMap((p) => (p.row === null ? [] : [p.row])));
      const before = ds.rows.flatMap((r, i) => (proposedRows.has(i) ? [] : [toNum(r[c])])).filter((v): v is number => v !== null);
      const ends: number[] = [...observed];
      for (const p of run.proposals) {
        if (p.row === null) continue;
        const m = val(p.row, mean.k);
        const s = val(p.row, sd?.k) ?? 0;
        if (m !== null) ends.push(m - s, m + s);
      }
      if (!ends.length) return [];
      let lo = Math.min(...ends);
      let hi = Math.max(...ends);
      const pad = (hi - lo || Math.abs(hi) || 1) * 0.04;
      lo -= pad;
      hi += pad;
      const dir = ds.directions[c];
      const hasBest = getModule(run.method).direction !== "none";
      const best = hasBest && before.length ? (dir === "min" ? Math.min(...before) : Math.max(...before)) : null;
      return [{ col: c, name, meanK: mean.k, sdK: sd?.k, lo, hi, best, val }];
    });
  });
  const barKs = $derived(new Set(bars.flatMap((b) => [b.meanK, b.sdK])));
  /** 横棒にしなかった予測の列（獲得関数・確率・推定ラベルなど）は数値のまま出す */
  const extraPred = $derived(allPred.filter((p) => p.kind !== "other" && !barKs.has(p.k)));
  const pct = (b: (typeof bars)[number], v: number) => `${Math.max(0, Math.min(100, ((v - b.lo) / (b.hi - b.lo)) * 100))}%`;
</script>

<div class="wrap">
  {#if app.lastError}
    <div class="error">
      <b><Icon name="alert" /> {app.lastError.method} の実行に失敗しました</b>
      <pre>{app.lastError.message}</pre>
      <details><summary>ログ全体</summary><pre>{app.lastError.log}</pre></details>
    </div>
  {/if}

  {#if !run}
    <div class="none">
      <div class="big"><Icon name="spark" size={28} /></div>
      <p><b>まだ提案はありません</b></p>
      <p class="muted">右側で設定を確認して <b>「提案を出す」</b> を押すと、ここに次の実験条件が並びます。</p>
    </div>
  {:else}
    <div class="head">
      <div class="ttl">
        <h2>次の実験</h2>
        <div class="meta">{getModule(run.method).fullName} · {run.proposals.length} 件 · {time(run.at)} に実行 · {run.seconds.toFixed(1)} 秒</div>
      </div>
      {#if app.truth && total > 0}
        <button class="small" onclick={() => app.fillVirtual()} title="サンプル専用: 提案された行に真の値を入れる"><Icon name="flask" size={15} />仮想実験で結果を入れる</button>
      {/if}
      <button class="ghost small" onclick={() => app.exportProposals()}><Icon name="download" size={15} />CSV で保存</button>
    </div>

    {#if app.runStale}
      <div class="note">
        <Icon name="alert" />
        <span>この提案のあとで列の役割（説明変数・目的変数）が変わりました。表示は実行時の設定のままです。今の設定で提案し直すには、もう一度「提案を出す」を押してください。</span>
      </div>
    {/if}

    {#each run.notes ?? [] as n}
      <div class="note">
        <Icon name="alert" />
        <span>{n}</span>
        <button class="small" onclick={() => app.selectModule("DOE")}>DOE に切り替える</button>
      </div>
    {/each}

    {#if total > 0}
      <div class="progress" class:done={filled === total}>
        <span class="bar"><span style:width={`${(filled / total) * 100}%`}></span></span>
        <span class="txt">
          {#if filled < total}
            <b class="num">{filled} / {total} 件入力済み</b> — 提案の条件で実験し、<span class="yname">目的変数</span>の結果を入力してください。
          {:else}
            <b>すべて入力しました。</b> 右下の「提案を出す」（<kbd>Ctrl</kbd>+<kbd>Enter</kbd>）で次の提案へ進めます。
          {/if}
        </span>
      </div>
    {:else if getModule(run.method).proposesNewRows}
      <div class="progress">
        <span class="txt">この手法の提案は候補表にない新しい条件です。</span>
        <button class="small" onclick={() => app.addNewProposalsToTable()}><Icon name="plus" size={14} />候補表の末尾に追加して結果を入力する</button>
      </div>
    {:else}
      <div class="progress">提案を候補表の行に対応づけられませんでした。「実行の詳細」のログを確認してください。</div>
    {/if}

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>順位</th>
            <th>行</th>
            {#each run.xNames as x}<th class="x r">{x}</th>{/each}
            {#each yCols as c}
              {@const b = bars.find((x) => x.col === c)}
              {#if b}
                <th class="pred">
                  <div>予測 {b.name}</div>
                  <div class="sub">± 不確かさ{#if b.best !== null}<span class="best-key"><i></i>最良 {fmt(b.best)}</span>{/if}</div>
                </th>
              {/if}
              <th class="y">結果 {ds.header[c]}</th>
            {/each}
            {#each extraPred as p}<th class="pred r">{p.label}</th>{/each}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each run.proposals as p (p.rank)}
            {@const done = p.row !== null && yCols.every((c) => !isBlank(cell(p.row!, c)))}
            <tr class:done>
              <td><span class="rank">★ {p.rank}</span></td>
              <td class="rowno">{p.row !== null ? p.row + 1 : "新規"}</td>
              {#each run.xNames as x, i}
                <td class="n">{p.row !== null && ds.header.indexOf(x) >= 0 ? ds.rows[p.row][ds.header.indexOf(x)] : p.values[i]}</td>
              {/each}
              {#each yCols as c}
                {@const b = bars.find((x) => x.col === c)}
                {#if b}
                  {@const m = p.row !== null ? b.val(p.row, b.meanK) : null}
                  {@const s = p.row !== null ? (b.val(p.row, b.sdK) ?? 0) : 0}
                  {@const actual = p.row !== null ? toNum(cell(p.row, b.col)) : null}
                  <td class="predcell">
                    {#if m !== null}
                      <div class="pbar" title={`予測 ${fmt(m)}${s ? ` ± ${fmt(s)}` : ""}`}>
                        <span class="track"></span>
                        {#if s}<span class="band" style:left={pct(b, m - s)} style:right={`calc(100% - ${pct(b, m + s)})`}></span>{/if}
                        {#if b.best !== null}<span class="best" style:left={pct(b, b.best)}></span>{/if}
                        <span class="pt" style:left={pct(b, m)}></span>
                        {#if actual !== null}<span class="actual" style:left={pct(b, actual)} title={`実測 ${fmt(actual)}`}></span>{/if}
                      </div>
                      <div class="pval num"><b>{fmt(m)}</b>{#if s}<span>± {fmt(s)}</span>{/if}</div>
                    {/if}
                  </td>
                {/if}
                <td class="yin">
                  {#if p.row !== null}
                    <!-- 値は version 経由で追従させる（入力欄を作り直すと Tab での連続入力が途切れるため） -->
                    <input
                      class="num"
                      value={cell(p.row, c)}
                      placeholder="結果を入力"
                      onchange={(e) => app.setCell(p.row!, c, (e.target as HTMLInputElement).value.trim())}
                      onkeydown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  {:else}
                    <span class="muted">—</span>
                  {/if}
                </td>
              {/each}
              {#each extraPred as pc}
                <td class="n small pred">{p.row !== null ? fmt(run.predictions?.byRow[p.row]?.[pc.k]) : ""}</td>
              {/each}
              <td class="go">
                {#if done}<span class="ok"><Icon name="check" size={14} /></span>{/if}
                {#if p.row !== null}
                  <button class="ghost small" onclick={() => app.jumpToRow(p.row!)}>表で見る<Icon name="right" size={14} /></button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if bars.length}
      <div class="legend">
        <span><i class="lg-pt"></i>予測</span>
        <span><i class="lg-band"></i>不確かさ（± σ）</span>
        {#if bars.some((b) => b.best !== null)}<span><i class="lg-best"></i>これまでの最良</span>{/if}
        <span><i class="lg-act"></i>入力した結果</span>
      </div>
    {/if}

    {#if app.runs.length > 1}
      <details class="history">
        <summary><Icon name="right" size={14} />これまでの実行（{app.runs.length} 回）</summary>
        <ol>
          {#each [...app.runs].reverse() as r, i}
            <li>
              <b>{r.method}</b> <span class="muted">{time(r.at)}</span>
              → {r.proposals.map((p) => (p.row !== null ? `行${p.row + 1}` : "新規")).join(", ")}
              {#if i === 0}<span class="chip proposal">最新</span>{/if}
            </li>
          {/each}
        </ol>
      </details>
    {/if}

    <details class="log">
      <summary><Icon name="right" size={14} />実行の詳細・nimo のログ</summary>
      <div class="settings mono">{run.settingsText}</div>
      <pre>{run.log}</pre>
    </details>
  {/if}
</div>

<style>
  .wrap { position: absolute; inset: 0; overflow: auto; padding: 20px 24px 32px; }
  .none { text-align: center; margin-top: 90px; color: var(--text); }
  .none p { margin: 4px 0; }
  .big { width: 52px; height: 52px; border-radius: 14px; background: var(--accent-weak); color: var(--accent); display: grid; place-items: center; margin: 0 auto 12px; }
  .head { display: flex; align-items: center; gap: 8px; }
  .ttl { flex: 1; min-width: 0; }
  h2 { font-size: 20px; margin: 0; line-height: 1.3; }
  .meta { font-size: 12px; color: var(--faint); margin-top: 2px; }
  .progress { margin: 16px 0; padding: 11px 14px; border-radius: 10px; background: var(--accent-weak); color: var(--accent-ink); display: flex; align-items: center; gap: 14px; }
  .progress .bar { flex: none; width: 120px; height: 6px; border-radius: 3px; background: #c8e3df; overflow: hidden; }
  .progress .bar span { display: block; height: 100%; background: var(--accent); transition: width 0.3s; }
  .progress .txt { flex: 1; }
  .progress.done { background: var(--ok-bg); color: #1e6b31; }
  .progress.done .bar { background: #c6e8cf; }
  .progress.done .bar span { background: var(--ok); }
  .yname { color: var(--y); font-weight: 600; }

  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; min-width: 100%; font-variant-numeric: tabular-nums; }
  th, td { padding: 0 12px; white-space: nowrap; }
  th { text-align: left; font-size: 12px; font-weight: 600; color: var(--muted); padding-bottom: 8px; border-bottom: 1px solid var(--line); vertical-align: bottom; }
  th.r { text-align: right; }
  th.x { color: var(--x); }
  th.y { color: var(--y); }
  th.pred { color: var(--pred); }
  th .sub { font-weight: 400; color: var(--faint); font-size: 11px; }
  .best-key { margin-left: 10px; color: var(--muted); font-weight: 400; display: inline-flex; align-items: center; gap: 4px; }
  .best-key i { width: 0; height: 12px; border-left: 2px dashed var(--faint); }
  td { height: 56px; border-bottom: 1px solid var(--line-soft); }
  tbody tr:hover td { background: #fbfcfc; }
  tr.done td:first-child { box-shadow: inset 3px 0 0 var(--ok); }
  .rank { display: inline-flex; background: var(--proposal-bg); color: var(--proposal-ink); font-weight: 700; border-radius: 999px; padding: 0 10px; }
  .rowno { color: var(--faint); }
  .n { text-align: right; font-size: 15px; font-weight: 600; }
  .n.small { font-size: 13px; font-weight: 400; }
  .pred { color: var(--pred); }

  .predcell { width: 220px; min-width: 160px; }
  .pbar { position: relative; height: 18px; }
  .pbar span { position: absolute; }
  .track { left: 0; right: 0; top: 8px; height: 2px; background: var(--line); border-radius: 1px; }
  .band { top: 4px; height: 10px; background: var(--pred-band); border-radius: 5px; }
  .best { top: 0; bottom: 0; width: 0; border-left: 2px dashed var(--faint); }
  .pt { top: 3px; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: var(--pred); border: 2px solid #fff; box-shadow: 0 0 0 1px var(--pred); }
  .actual { top: 2px; width: 14px; height: 14px; margin-left: -7px; transform: rotate(45deg); background: var(--y); border: 2px solid #fff; box-shadow: 0 0 0 1px var(--y); }
  .pval { font-size: 12px; display: flex; gap: 6px; align-items: baseline; }
  .pval b { color: var(--pred); font-size: 13px; }
  .pval span { color: var(--faint); }

  .yin input { width: 100px; text-align: right; border-color: #f0c99c; background: #fffdfa; }
  .yin input:placeholder-shown { background: #fff; }
  .go { text-align: right; }
  .go .ok { color: var(--ok); margin-right: 4px; vertical-align: middle; }

  .legend { display: flex; gap: 16px; margin-top: 10px; font-size: 12px; color: var(--muted); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .lg-pt { width: 10px; height: 10px; border-radius: 50%; background: var(--pred); }
  .lg-band { width: 18px; height: 8px; border-radius: 4px; background: var(--pred-band); }
  .lg-best { width: 0; height: 12px; border-left: 2px dashed var(--faint); }
  .lg-act { width: 9px; height: 9px; transform: rotate(45deg); background: var(--y); }

  .history, .log { margin-top: 18px; font-size: 12px; }
  summary { cursor: pointer; color: var(--muted); list-style: none; display: inline-flex; align-items: center; gap: 4px; }
  summary::-webkit-details-marker { display: none; }
  details[open] > summary :global(.icon) { transform: rotate(90deg); }
  .history ol { margin: 6px 0; padding-left: 20px; display: grid; gap: 3px; }
  .settings { margin: 8px 0 0; font-size: 12px; color: var(--muted); }
  pre {
    background: var(--surface);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 11px;
    max-height: 260px;
    overflow: auto;
    white-space: pre-wrap;
  }
  .note { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: var(--warn-bg); color: #6d4a0c; line-height: 1.6; display: flex; gap: 8px; align-items: flex-start; }
  .note :global(.icon) { color: var(--warn); margin-top: 3px; }
  .note span { flex: 1; }
  .error { background: var(--err-bg); border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; color: var(--err); }
  .error pre { color: var(--text); }
</style>
