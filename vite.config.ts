import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  // GitHub Pages のサブパスでも動くよう相対パスで出力する
  base: "./",
  plugins: [svelte()],
  worker: { format: "es" },
  // pyodide は自前で wasm を読むので事前バンドルから外す
  optimizeDeps: { exclude: ["pyodide"] },
});
