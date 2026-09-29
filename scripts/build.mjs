import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir("assets/dist", { recursive: true });
await build({
  absWorkingDir: process.cwd(),
  entryPoints: [resolve("src/png-optimizer-worker.js")],
  outfile: resolve("assets/dist/png-optimizer-worker.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await build({
  absWorkingDir: process.cwd(),
  entryPoints: [resolve("src/pdf-workspace.js")],
  outfile: resolve("assets/dist/pdf-workspace.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await build({
  absWorkingDir: process.cwd(),
  entryPoints: [resolve("src/pdf-page-order-workflow.js")],
  outfile: resolve("assets/dist/pdf-page-order-workflow.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome121", "edge122", "safari26"],
  minify: true,
  sourcemap: true,
  legalComments: "linked"
});

await build({
  absWorkingDir: process.cwd(),
  entryPoints: [resolve("src/png-to-svg.js")],
  outfile: resolve("assets/dist/png-to-svg.js"),
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
  absWorkingDir: process.cwd(),
  entryPoints: [resolve("src/line-art-svg-workflow.js")],
  outfile: resolve("assets/dist/line-art-svg-workflow.js"),
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
  absWorkingDir: process.cwd(),
  entryPoints: [resolve("src/image-decoder-worker.js")],
  outfile: resolve("assets/dist/image-decoder-worker.js"),
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
  "assets/dist/squoosh_oxipng_bg.wasm"
);

await copyFile(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "assets/dist/pdf.worker.min.mjs"
);

await copyFile(
  "node_modules/@discourse/heic/codec/dec/heic_dec.wasm",
  "assets/dist/heic_dec.wasm"
);
