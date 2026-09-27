# SHIAGENT

Local-first creative tools for images, SVG and PDF.

## Run locally

```powershell
npm run dev
```

Open `http://localhost:4173/ja/png-compressor/` for Japanese or
`http://localhost:4173/png-compressor/` for English.

The Local AI line-art proof of concept is available at
`http://localhost:4173/ja/line-art-generator/`. Run `npm run build` after
changing its worker source.

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

The current line-art generator is a technical proof of concept based on an
SD-Turbo ONNX model. Its model download is about 2.58 GB and uses a
non-commercial model license; replace it with a commercially usable,
line-art-specific model before production release.
