# SHIAGENT

Local-first creative tools for images, SVG and PDF.

## Run locally

```powershell
npm run dev
```

Open `http://localhost:4173/ja/png-compressor/` for Japanese or
`http://localhost:4173/png-compressor/` for English.

The Japanese PNG-to-SVG tool is available at
`http://localhost:4173/ja/png-to-svg/`. It reproduces the Matopuri conversion
pipeline in the browser: white compositing, quality-specific preprocessing,
optional whitespace splitting, Potrace vectorization and 512 × 512 canvas
normalization.

The image splitter is available at `http://localhost:4173/ja/image-splitter/`.
It reproduces Matopuri's whitespace projection splitting with the same three
presets, 245 foreground threshold, 16 px crop padding, detection preview and
individual PNG or ZIP export.

The Local AI line-art experiment is currently pending. Its route remains as a
lightweight status page, but model/runtime dependencies are not installed.

## Checks

```powershell
npm run check
npm test
```

The PNG compressor performs decoding, analysis, compression and ZIP creation in
the browser. Exact mode sends the original PNG directly through the bundled
OxiPNG WebAssembly optimizer and does not change decoded pixel values. No image
data is sent to a server.

Auto mode classifies line art, flat illustrations and continuous-tone images.
Line art keeps alpha values and colored accents while gently consolidating
near-neutral grays; flat illustrations use the smaller palette preset and
continuous-tone images use the balanced preset.

Batch jobs run sequentially. Images above two million pixels use a bounded-memory
typed-array path, and cancelling a job terminates the active worker so processing
can restart cleanly.

