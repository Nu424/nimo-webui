<script lang="ts">
  // 提案タブ: 直近の提案を一覧し、実験結果をここから直接入力できるようにする。
  // 入力は元の候補表の同じ行に書き込まれる（候補表タブを探し回らなくてよい）。
  import { app } from "../lib/app.svelte";
  import { isBlank } from "../lib/data/dataset";
  import { getModule } from "../lib/modules";

  const run = $derived(app.lastRun);
  const ds = $derived(app.dataset!);
  const yCols = $derived((app.version, ds.roles.flatMap((r, i) => (r === "y" ? [i] : []))));
  const filled = $derived.by(() => {
    app.version;
    if (!run) return 0;
    return run.proposals.filter((p) => p.row !== null && yCols.every((c) => !isBlank(ds.rows[p.row!][c]))).length;
  });
  const total = $derived(run?.proposals.filter((p) => p.row !== null).length ?? 0);
  const fmt = (v: unknown) => (typeof v === "number" ? (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2) : v.toPrecision(4).replace(/\.?0+$/, "")) : String(v ?? ""));
  const time = (iso: string) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  const predCols = $derived(run?.predictions?.columns.map((c, k) => ({ ...c, k })).filter((c) => c.kind !== "other") ?? []);
</script>

<div class="wrap">
  {#if app.lastError}
    <div class="error">
      <b>⚠ {app.lastError.method} の実行に失敗しました</b>
      <pre>{app.lastError.message}</pre>
      <details><summary>ログ全体</summary><pre>{app.lastError.log}</pre></details>
    </div>
  {/if}

  {#if !run}
    <div class="none">
      <div class="big">✨</div>
      <p>まだ提案はありません。</p>
      <p class="muted">右側で手法を選んで <b>「提案を出す」</b> を押すと、ここに次の実験条件が並びます。</p>
    </div>
  {:else}
    <div class="head">
      <div>
        <h2>{getModule(run.method).fullName} の提案 <span class="muted">· {run.proposals.length} 件 · {time(run.at)}・{run.seconds.toFixed(1)} 秒</span></h2>
        <div class="settings muted mono">{run.settingsText}</div>
      </div>
      <div class="btns">
        {#if app.truth && total > 0}
          <button onclick={() => app.fillVirtual()} title="サンプル専用: 提案された行に真の値を入れる">🧪 仮想実験で結果を入れる</button>
        {/if}
        <button onclick={() => app.exportProposals()}>⬇ 提案を CSV で保存</button>
      </div>
    </div>

    {#each run.notes ?? [] as n}
      <div class="note">
        ⚠ {n}
        <button class="small" onclick={() => app.selectModule("DOE")}>DOE に切り替える</button>
      </div>
    {/each}

    {#if total > 0}
      <div class="progress" class:done={filled === total}>
        {#if filled < total}
          <b>次にすること:</b> 提案された条件で実験し、結果を下の
          <span class="chip y">目的変数</span> の欄に入力してください（{filled} / {total} 件入力済み）。
        {:else}
          <b>✓ すべて入力しました。</b> 右下の「提案を出す」（<kbd>Ctrl</kbd>+<kbd>Enter</kbd>）で、次の提案へ進めます。
        {/if}
      </div>
    {:else}
      <div class="progress">
        この手法の提案は候補表にない新しい条件です。
        <button class="small" onclick={() => app.addNewProposalsToTable()}>＋ 候補表の末尾に追加して結果を入力する</button>
      </div>
    {/if}

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>順位</th>
            <th>行</th>
            {#each run.xNames as x}<th class="x">{x}</th>{/each}
            {#each yCols as c}<th class="y">{ds.header[c]}</th>{/each}
            {#each predCols as p}<th class="pred">{p.label}</th>{/each}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each run.proposals as p (p.rank)}
            <tr>
              <td class="rank">★{p.rank}</td>
              <td class="muted">{p.row !== null ? p.row + 1 : "新規"}</td>
              {#each run.xNames as x, i}
                <td class="num">{p.row !== null && ds.header.indexOf(x) >= 0 ? ds.rows[p.row][ds.header.indexOf(x)] : p.values[i]}</td>
              {/each}
              {#each yCols as c}
                <td class="yin">
                  {#if p.row !== null}
                    {#key app.version}
                      <input
                        value={ds.rows[p.row][c]}
                        placeholder="結果を入力"
                        onchange={(e) => app.setCell(p.row!, c, (e.target as HTMLInputElement).value.trim())}
                        onkeydown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                      />
                    {/key}
                  {:else}
                    <span class="muted">—</span>
                  {/if}
                </td>
              {/each}
              {#each predCols as pc}
                <td class="num pred">{p.row !== null ? fmt(run.predictions?.byRow[p.row]?.[pc.k]) : ""}</td>
              {/each}
              <td>
                {#if p.row !== null}
                  <button class="ghost small" onclick={() => app.jumpToRow(p.row!)}>表で見る</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if app.runs.length > 1}
      <details class="history">
        <summary>これまでの実行（{app.runs.length} 回）</summary>
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
      <summary>nimo のログ</summary>
      <pre>{run.log}</pre>
    </details>
  {/if}
</div>

<style>
  .wrap { position: absolute; inset: 0; overflow: auto; padding: 14px 16px; }
  .none { text-align: center; margin-top: 80px; }
  .big { font-size: 40px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  h2 { font-size: 15px; margin: 0 0 2px; }
  .settings { font-size: 11px; }
  .btns { display: flex; gap: 6px; flex: none; }
  .progress {
    margin: 12px 0;
    padding: 9px 12px;
    border-radius: 8px;
    background: var(--accent-weak);
    border: 1px solid #d3dcfb;
    font-size: 13px;
  }
  .progress.done { background: var(--ok-bg); border-color: #b8e2c1; }
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; font-size: 13px; min-width: 100%; }
  th, td { border-bottom: 1px solid var(--line); padding: 6px 10px; white-space: nowrap; }
  th { text-align: left; font-size: 12px; background: #fafbfc; position: sticky; top: 0; }
  th.x { color: var(--x); box-shadow: inset 0 -2px 0 var(--x); }
  th.y { color: var(--y); box-shadow: inset 0 -2px 0 var(--y); }
  th.pred { color: var(--pred); box-shadow: inset 0 -2px 0 var(--pred); font-weight: 500; }
  tbody tr:hover { background: #fcfcfd; }
  .rank { color: #b07d00; font-weight: 700; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .pred { color: var(--pred); }
  .yin input { width: 110px; text-align: right; border-color: #f2c99a; background: #fffaf4; }
  .yin input:placeholder-shown { background: #fff; }
  .history, .log { margin-top: 16px; font-size: 12px; }
  .history ol { margin: 6px 0; padding-left: 20px; display: grid; gap: 3px; }
  pre {
    background: #f6f7f9;
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 8px;
    font-size: 11px;
    max-height: 260px;
    overflow: auto;
    white-space: pre-wrap;
  }
  summary { cursor: pointer; color: var(--muted); }
  .note { margin-top: 12px; padding: 9px 12px; border-radius: 8px; background: var(--warn-bg); border: 1px solid #f1d9a6; color: #6d4a0c; font-size: 13px; line-height: 1.6; }
  .note button { margin-left: 6px; }
  .error { border: 1px solid #f3c0c0; background: var(--err-bg); border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; }
</style>
