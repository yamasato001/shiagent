import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

await mkdir("assets/dist", { recursive: true });
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

await build({
  entryPoints: ["src/png-to-svg.js"],
  outfile: "assets/dist/png-to-svg.js",
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

await copyFile(
  "node_modules/@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm",
  "assets/dist/squoosh_oxipng_bg.wasm"
);
