import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  // GitHub Pages のサブパスでも動くよう相対パスで出力する
  base: "./",
  plugins: [svelte()],
  // scripts/smoke.mjs・shot.mjs の既定 URL と合わせる。localhost だと IPv6（::1）だけで待ち受け、
  // Playwright やブラウザ拡張から届かないことがあったので 127.0.0.1 に固定する
  server: { host: "127.0.0.1", port: 5199, strictPort: true },
  worker: { format: "es" },
  // Handsontable・Plotly が大きいのは承知の上（Pyodide 本体の数十 MB に比べれば小さい）
  build: { chunkSizeWarningLimit: 2000 },
  // pyodide は自前で wasm を読むので事前バンドルから外す
  optimizeDeps: { exclude: ["pyodide"] },
});
