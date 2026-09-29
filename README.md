# SHIAGENT

Local-first creative tools for images, SVG and PDF.

## Run locally

```powershell
npm run dev
```

Open `http://localhost:4173/ja/image-compressor/` for Japanese or
`http://localhost:4173/image-compressor/` for English.

The Japanese PNG/JPEG/WebP-to-SVG tool is available at
`http://localhost:4173/ja/image-to-svg/`. It detects mixed input from file
signatures and reproduces the Matopuri conversion pipeline in the browser:
white compositing, quality-specific preprocessing, optional whitespace
splitting, Potrace vectorization and canvas normalization.

The image splitter is available at `http://localhost:4173/ja/image-splitter/`.
It reproduces Matopuri's whitespace projection splitting with the same three
presets, 245 foreground threshold, 16 px crop padding, detection preview and
individual PNG or ZIP export.

The image format converter is available at
`http://localhost:4173/ja/image-converter/`. It accepts mixed PNG, JPEG, WebP,
HEIC/HEIF, AVIF, GIF, BMP and TIFF input and converts the batch to PNG, JPEG or
WebP. HEIC/HEIF and TIFF use bundled local decoders; files are never uploaded.

The image resizer is available at `http://localhost:4173/ja/image-resizer/`.
It resizes mixed image batches by a pixel bounding box or by a percentage of
each original, with optional aspect-ratio preservation and PNG, JPEG or WebP
output. It uses the same local HEIC/HEIF and TIFF decoders as the converter.

The image cropper is available at `http://localhost:4173/ja/image-cropper/`.
It supports manual crop selection, batch Auto Trim against transparent, white,
detected or custom backgrounds, and Normalize mode for consistent padding,
canvas dimensions and object occupancy.

The canvas padding tool is available at
`http://localhost:4173/ja/canvas-padding/`. It adds percentage or pixel margins
around images, or centers them on a fixed canvas with transparent, white, black
or custom backgrounds and batch ZIP export.

The metadata cleaner is available at
`http://localhost:4173/ja/metadata-cleaner/`. It removes EXIF/GPS, XMP, IPTC,
comments, text and timestamps from PNG, JPEG and WebP files without re-encoding
image pixels, while preserving display-critical color profiles.

The SVG rasterizer is available at `http://localhost:4173/ja/svg-to-image/`.
It batch-converts SVG to PNG or WebP with percentage, pixel-bound or DPI-based
sizing, transparent or solid backgrounds, WebP quality and ZIP export. PNG DPI
mode also writes physical pixel-density metadata.

The color tool is available at `http://localhost:4173/ja/color-tool/`. It batch
replaces a selected color, makes matching colors transparent with per-channel
tolerance, or converts PNG, JPEG, WebP and SVG files to grayscale or monochrome.
SVG paint colors remain vector data; raster results export as PNG or WebP.

The favicon generator is available at
`http://localhost:4173/ja/favicon-generator/`. From one PNG, JPEG, WebP or SVG
it creates favicon PNG sizes and a multi-image ICO, Apple Touch Icon, standard
and maskable PWA icons, a web manifest, HTML link tags and a ZIP package.

The image joiner is available at `http://localhost:4173/ja/image-joiner/`.
It combines mixed image formats horizontally, vertically or into a configurable
grid, with ordering, gaps, padding, background and PNG/JPEG/WebP export options.

The Local AI line-art experiment is currently pending. Its route remains as a
lightweight status page, but model/runtime dependencies are not installed.

## Checks

```powershell
npm run check
npm test
```

The image compressor detects PNG, JPEG and WebP from their file signatures and
performs decoding, analysis, compression and ZIP creation in the browser. Exact
mode sends PNG directly through the bundled OxiPNG WebAssembly optimizer and
leaves JPEG and WebP unchanged. Other modes re-encode JPEG and WebP with
mode-specific quality. No image data is sent to a server.

Auto mode classifies line art, flat illustrations and continuous-tone images.
Line art keeps alpha values and colored accents while gently consolidating
near-neutral grays; flat illustrations use the smaller palette preset and
continuous-tone images use the balanced preset.

Batch jobs run sequentially. Images above two million pixels use a bounded-memory
typed-array path, and cancelling a job terminates the active worker so processing
can restart cleanly.
