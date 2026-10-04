import { build } from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const bundledAssets = resolve(projectRoot, "assets/dist");

await rm(bundledAssets, { recursive: true, force: true });
await mkdir(bundledAssets, { recursive: true });

await build({
  absWorkingDir: projectRoot,
  entryPoints: [resolve("src/png-optimizer-worker.js")],
  outfile: resolve(bundledAssets, "png-optimizer-worker.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await build({
  absWorkingDir: projectRoot,
  entryPoints: [resolve("src/pdf-workspace.js")],
  outfile: resolve(bundledAssets, "pdf-workspace.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  supported: { "template-literal": false },
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await build({
  absWorkingDir: projectRoot,
  entryPoints: [resolve("src/pdf-compare.js")],
  outfile: resolve(bundledAssets, "pdf-compare.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await build({
  absWorkingDir: projectRoot,
  entryPoints: [resolve("src/pdf-ocr.js")],
  outfile: resolve(bundledAssets, "pdf-ocr.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await build({
  absWorkingDir: projectRoot,
  entryPoints: [resolve("src/pdf-compressor.js")],
  outfile: resolve(bundledAssets, "pdf-compressor.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await build({
  absWorkingDir: projectRoot,
  entryPoints: [resolve("src/pdf-page-order-workflow.js")],
  outfile: resolve(bundledAssets, "pdf-page-order-workflow.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await build({
  absWorkingDir: projectRoot,
  entryPoints: [resolve("src/scan-pdf-optimizer-workflow.js")],
  outfile: resolve(bundledAssets, "scan-pdf-optimizer-workflow.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await build({
  absWorkingDir: projectRoot,
  entryPoints: [resolve("src/png-to-svg.js")],
  outfile: resolve(bundledAssets, "png-to-svg.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  define: { "globalThis.process": "undefined", "__filename": "undefined" },
  external: ["node:fs"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await build({
  absWorkingDir: projectRoot,
  entryPoints: [resolve("src/line-art-svg-workflow.js")],
  outfile: resolve(bundledAssets, "line-art-svg-workflow.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  define: { "globalThis.process": "undefined", "__filename": "undefined" },
  external: ["node:fs"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await build({
  absWorkingDir: projectRoot,
  entryPoints: [resolve("src/image-decoder-worker.js")],
  outfile: resolve(bundledAssets, "image-decoder-worker.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await copyFile(
  "node_modules/@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm",
  resolve(bundledAssets, "squoosh_oxipng_bg.wasm")
);

await copyFile(
  "node_modules/@squoosh-kit/imagequant/dist/wasm/imagequant/imagequant.wasm",
  resolve(bundledAssets, "imagequant.wasm")
);
await copyFile(
  "node_modules/@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm",
  resolve(bundledAssets, "mozjpeg_enc.wasm")
);

await copyFile(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  resolve(bundledAssets, "pdf.worker.min.mjs")
);

await mkdir(resolve(bundledAssets, "ocr/core"), { recursive: true });
await mkdir(resolve(bundledAssets, "ocr/lang"), { recursive: true });
await copyFile("node_modules/tesseract.js/dist/worker.min.js", resolve(bundledAssets, "ocr/worker.min.js"));
for (const file of [
  "tesseract-core.wasm.js", "tesseract-core.wasm", "tesseract-core-simd.wasm.js", "tesseract-core-simd.wasm",
  "tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm"
]) await copyFile(`node_modules/tesseract.js-core/${file}`, resolve(bundledAssets, `ocr/core/${file}`));
for (const language of ["jpn", "eng"]) await copyFile(
  `node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`,
  resolve(bundledAssets, `ocr/lang/${language}.traineddata.gz`)
);

await copyFile(
  "node_modules/@discourse/heic/codec/dec/heic_dec.wasm",
  resolve(bundledAssets, "heic_dec.wasm")
);

await import("./generate-pdf-tool-pages.mjs");
await import("./refresh-seo-metadata.mjs");
