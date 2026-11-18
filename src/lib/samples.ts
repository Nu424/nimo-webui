import type { SampleInfo } from "./app.svelte";

let cache: Promise<SampleInfo[]> | null = null;

/** public/samples/index.json（scripts/make_samples.py が作る）を読む */
export function loadSamples(): Promise<SampleInfo[]> {
  cache ??= fetch(new URL("samples/index.json", document.baseURI))
    .then((r) => r.json())
    .catch(() => []);
  return cache;
}
