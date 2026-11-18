import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  // GitHub Pages のサブパスでも動くよう相対パスで出力する
  base: "./",
  plugins: [svelte()],
  worker: { format: "es" },
  // Handsontable・Plotly が大きいのは承知の上（Pyodide 本体の数十 MB に比べれば小さい）
  build: { chunkSizeWarningLimit: 2000 },
  // pyodide は自前で wasm を読むので事前バンドルから外す
  optimizeDeps: { exclude: ["pyodide"] },
});
