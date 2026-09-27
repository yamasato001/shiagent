import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

await mkdir("assets/dist", { recursive: true });
await build({
  entryPoints: ["src/line-art-worker.js"],
  outfile: "assets/dist/line-art-worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await build({
  entryPoints: ["src/png-optimizer-worker.js"],
  outfile: "assets/dist/png-optimizer-worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

for (const file of ["ort-wasm-simd-threaded.jsep.wasm", "ort-wasm-simd-threaded.jsep.mjs"]) {
  await copyFile(`node_modules/onnxruntime-web/dist/${file}`, `assets/dist/${file}`);
}

await copyFile(
  "node_modules/@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm",
  "assets/dist/squoosh_oxipng_bg.wasm"
);
