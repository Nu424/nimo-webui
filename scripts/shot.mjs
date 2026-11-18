// 開発用: ページを開いてスクリーンショットを撮る（目視確認用）
// 使い方: node scripts/shot.mjs <url> <out.png> [待機ms] [幅x高さ] [--script=file.mjs]
//   --script: page を受け取る default export 関数を実行してから撮る（クリック等の操作用）
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const script = args.find((a) => a.startsWith("--script="))?.slice(9);
const [url, out, wait = "1500", size = "1440x900"] = args.filter((a) => !a.startsWith("--"));
const [width, height] = size.split("x").map(Number);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(`[${m.type()}] ${m.text()}`); });
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForTimeout(Number(wait));
if (script) {
  const mod = await import(pathToFileURL(resolve(script)).href);
  await mod.default(page);
}
await page.screenshot({ path: out });
await browser.close();
console.log(`saved ${out}`);
