export const ICON_SPECS = Object.freeze([
  { name: "favicon-16x16.png", size: 16, group: "favicon" },
  { name: "favicon-32x32.png", size: 32, group: "favicon" },
  { name: "favicon-48x48.png", size: 48, group: "favicon" },
  { name: "apple-touch-icon.png", size: 180, group: "apple" },
  { name: "android-chrome-192x192.png", size: 192, group: "pwa" },
  { name: "android-chrome-512x512.png", size: 512, group: "pwa" },
  { name: "pwa-maskable-192x192.png", size: 192, group: "maskable", padding: 10 },
  { name: "pwa-maskable-512x512.png", size: 512, group: "maskable", padding: 10 }
]);

const positive = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error("Invalid dimensions");
  return number;
};

export function iconPlacement(sourceWidth, sourceHeight, size, options = {}) {
  const width = positive(sourceWidth), height = positive(sourceHeight), output = positive(size);
  const padding = Math.max(0, Math.min(40, Number(options.padding) || 0)) / 100 * output;
  const inner = output - padding * 2;
  if (options.fit === "cover") {
    const sourceSize = Math.min(width, height);
    return { sx: (width - sourceSize) / 2, sy: (height - sourceSize) / 2, sw: sourceSize, sh: sourceSize, dx: padding, dy: padding, dw: inner, dh: inner };
  }
  const scale = Math.min(inner / width, inner / height);
  const drawWidth = width * scale, drawHeight = height * scale;
  return { sx: 0, sy: 0, sw: width, sh: height, dx: (output - drawWidth) / 2, dy: (output - drawHeight) / 2, dw: drawWidth, dh: drawHeight };
}

export function createIco(images) {
  const entries = [...images].sort((a, b) => a.size - b.size).map(image => ({ size: image.size, data: image.data instanceof Uint8Array ? image.data : new Uint8Array(image.data) }));
  if (!entries.length || entries.length > 65535) throw new Error("ICO requires one or more images");
  const headerSize = 6 + entries.length * 16;
  const output = new Uint8Array(headerSize + entries.reduce((sum, entry) => sum + entry.data.length, 0));
  const view = new DataView(output.buffer);
  view.setUint16(0, 0, true); view.setUint16(2, 1, true); view.setUint16(4, entries.length, true);
  let dataOffset = headerSize;
  entries.forEach((entry, index) => {
    const offset = 6 + index * 16;
    output[offset] = entry.size >= 256 ? 0 : entry.size;
    output[offset + 1] = entry.size >= 256 ? 0 : entry.size;
    output[offset + 2] = 0; output[offset + 3] = 0;
    view.setUint16(offset + 4, 1, true); view.setUint16(offset + 6, 32, true);
    view.setUint32(offset + 8, entry.data.length, true); view.setUint32(offset + 12, dataOffset, true);
    output.set(entry.data, dataOffset); dataOffset += entry.data.length;
  });
  return output;
}

export function createManifest(options = {}) {
  return JSON.stringify({
    name: options.name || "My App",
    short_name: options.shortName || options.name || "My App",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ],
    theme_color: options.themeColor || "#ffffff",
    background_color: options.backgroundColor || "#ffffff",
    display: "standalone"
  }, null, 2);
}

export function faviconLinks() {
  return `<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">`;
}
