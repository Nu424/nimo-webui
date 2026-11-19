<script lang="ts">
  // 手法ごとの考え方を示す小さな模式図（色の約束: 観測=青、予測=紫、提案=黄の★）
  let { figure, size = "md" }: { figure: string; size?: "xs" | "sm" | "md" } = $props();
  const star = (x: number, y: number, r = 6) => {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(" ");
  };
  const grid = Array.from({ length: 6 }, (_, i) => Array.from({ length: 4 }, (_, j) => [16 + i * 18, 12 + j * 13])).flat();
</script>

<svg viewBox="0 0 120 64" class={size} role="img" aria-label="手法の模式図">
  <rect width="120" height="64" rx="6" fill="#f6f8f7" />
  {#if figure === "bo"}
    <!-- 予測の平均と不確かさの帯、観測点、獲得関数の山に★ -->
    <path d="M6 44 C 22 40, 30 18, 46 22 S 70 50, 86 30 S 108 12, 116 20 L116 34 C 108 26, 96 46, 86 44 S 64 60, 46 34 S 22 54, 6 54 Z" fill="#ece6f8" />
    <path d="M6 49 C 22 47, 30 26, 46 28 S 70 55, 86 37 S 108 19, 116 27" fill="none" stroke="#7c5cc4" stroke-width="1.6" />
    {#each [[14, 48], [46, 28], [64, 47]] as [x, y]}<circle cx={x} cy={y} r="3" fill="#2a78d6" stroke="#fff" stroke-width="1" />{/each}
    <polygon points={star(104, 20)} fill="#eda100" stroke="#6b4e00" stroke-width=".6" />
  {:else if figure === "random"}
    {#each grid as [x, y], i}<circle cx={x} cy={y} r="2.2" fill="#cdd2da" />{/each}
    {#each [[34, 12], [88, 38], [52, 51], [106, 25]] as [x, y]}<polygon points={star(x, y, 5)} fill="#eda100" stroke="#6b4e00" stroke-width=".5" />{/each}
  {:else if figure === "spread"}
    {#each grid as [x, y]}<circle cx={x} cy={y} r="2.2" fill="#cdd2da" />{/each}
    <circle cx="16" cy="12" r="3" fill="#2a78d6" />
    {#each [[106, 51], [16, 51], [106, 12], [61, 32]] as [x, y]}<polygon points={star(x, y, 5)} fill="#eda100" stroke="#6b4e00" stroke-width=".5" />{/each}
  {:else if figure === "order"}
    {#each [0, 1, 2, 3, 4] as i}
      <rect x="22" y={6 + i * 11} width="60" height="8" rx="2" fill={i < 2 ? "#cde2fb" : i < 4 ? "#fff6d6" : "#eef0f3"} stroke={i >= 2 && i < 4 ? "#eda100" : "none"} />
    {/each}
    <path d="M94 10 V 50 M90 45 L94 51 L98 45" stroke="#6b7280" stroke-width="1.4" fill="none" />
  {:else if figure === "range"}
    <rect x="4" y="22" width="112" height="14" fill="#fdefe0" />
    <line x1="4" x2="116" y1="22" y2="22" stroke="#d9730d" stroke-dasharray="3 2" />
    <line x1="4" x2="116" y1="36" y2="36" stroke="#d9730d" stroke-dasharray="3 2" />
    <path d="M6 54 C 30 50, 40 10, 60 12 S 90 56, 116 44" fill="none" stroke="#7c5cc4" stroke-width="1.6" />
    {#each [[14, 52], [60, 12]] as [x, y]}<circle cx={x} cy={y} r="3" fill="#2a78d6" stroke="#fff" />{/each}
    <polygon points={star(33, 29)} fill="#eda100" stroke="#6b4e00" stroke-width=".6" />
  {:else if figure === "threshold"}
    <line x1="4" x2="116" y1="30" y2="30" stroke="#d9730d" stroke-width="1.4" />
    <path d="M6 52 C 30 48, 42 10, 62 14 S 92 50, 116 46" fill="none" stroke="#7c5cc4" stroke-width="1.6" />
    {#each [[10, 51], [62, 14], [112, 46]] as [x, y]}<circle cx={x} cy={y} r="3" fill="#2a78d6" stroke="#fff" />{/each}
    <polygon points={star(36, 30)} fill="#eda100" stroke="#6b4e00" stroke-width=".6" />
    <polygon points={star(85, 30)} fill="#eda100" stroke="#6b4e00" stroke-width=".6" />
  {:else if figure === "phase" || figure === "classify"}
    <path d="M4 4 H 60 C 50 24, 70 40, 54 60 H 4 Z" fill="#cde2fb" />
    <path d="M60 4 H 116 V 60 H 54 C 70 40, 50 24, 60 4 Z" fill="#fde3d4" />
    {#each [[20, 18], [26, 46], [92, 16], [100, 48]] as [x, y], i}<circle cx={x} cy={y} r="3" fill={i < 2 ? "#2a78d6" : "#eb6834"} stroke="#fff" />{/each}
    <polygon points={star(58, 22)} fill="#eda100" stroke="#6b4e00" stroke-width=".6" />
    <polygon points={star(61, 46)} fill="#eda100" stroke="#6b4e00" stroke-width=".6" />
    {#if figure === "classify"}<text x="72" y="36" font-size="9" fill="#6b7280">?</text>{/if}
  {:else if figure === "novelty"}
    <line x1="10" y1="56" x2="114" y2="56" stroke="#cfd4dc" /><line x1="10" y1="56" x2="10" y2="6" stroke="#cfd4dc" />
    {#each [[24, 44], [30, 38], [36, 46], [42, 40], [28, 50], [46, 34]] as [x, y]}<circle cx={x} cy={y} r="3" fill="#2a78d6" stroke="#fff" />{/each}
    <circle cx="35" cy="42" r="16" fill="none" stroke="#2a78d6" stroke-dasharray="2 2" opacity=".5" />
    <polygon points={star(96, 16)} fill="#eda100" stroke="#6b4e00" stroke-width=".6" />
    <path d="M52 34 L 88 20" stroke="#6b7280" stroke-dasharray="2 2" />
  {:else if figure === "anneal"}
    <path d="M6 54 C 30 44, 90 44, 114 54" fill="none" stroke="#b7d3f6" stroke-width="1.5" />
    <path d="M6 56 C 40 54, 50 26, 62 26 S 84 54, 114 56" fill="none" stroke="#5598e7" stroke-width="1.5" />
    <path d="M6 57 C 50 57, 56 8, 62 8 S 74 57, 114 57" fill="none" stroke="#1c5cab" stroke-width="1.8" />
    <polygon points={star(62, 8, 5)} fill="#eda100" stroke="#6b4e00" stroke-width=".5" />
  {:else if figure === "rank"}
    {#each [40, 30, 22, 14] as w, i}
      <rect x="18" y={8 + i * 12} width={w * 2} height="8" rx="2" fill={i === 0 ? "#eda100" : "#86b6ef"} />
      <text x="8" y={15 + i * 12} font-size="8" fill="#6b7280">{i + 1}</text>
    {/each}
  {:else if figure === "process"}
    {#each grid as [x, y]}<circle cx={x} cy={y} r="2.2" fill="#cdd2da" />{/each}
    <rect x="8" y="32" width="106" height="14" rx="3" fill="none" stroke="#d9730d" stroke-dasharray="3 2" />
    {#each [[34, 38], [70, 38], [88, 38]] as [x, y]}<polygon points={star(x, y, 5)} fill="#eda100" stroke="#6b4e00" stroke-width=".5" />{/each}
  {:else if figure === "combi"}
    <polygon points="60,6 112,58 8,58" fill="#f4f6fa" stroke="#cfd4dc" />
    <line x1="40" y1="40" x2="86" y2="40" stroke="#eda100" stroke-width="2" />
    {#each [40, 55, 70, 86] as x}<polygon points={star(x, 40, 4)} fill="#eda100" stroke="#6b4e00" stroke-width=".5" />{/each}
    <circle cx="62" cy="30" r="3" fill="#2a78d6" stroke="#fff" />
  {/if}
</svg>

<style>
  svg { display: block; flex: none; }
  .xs { width: 56px; height: 30px; }
  .sm { width: 72px; height: 38px; }
  .md { width: 100%; max-width: 240px; height: auto; }
</style>
