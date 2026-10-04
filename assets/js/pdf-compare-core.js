export function comparePdfPixels(first, second, threshold = 18) {
  const width = Math.max(first?.width || 0, second?.width || 0);
  const height = Math.max(first?.height || 0, second?.height || 0);
  const output = new Uint8ClampedArray(width * height * 4);
  const limit = Math.max(0, Math.min(255, Number(threshold) || 0));
  let changed = 0;
  const read = (image, x, y, channel) => {
    if (!image?.data || x >= image.width || y >= image.height) return 255;
    return image.data[(y * image.width + x) * 4 + channel];
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const a = [read(first, x, y, 0), read(first, x, y, 1), read(first, x, y, 2)];
      const b = [read(second, x, y, 0), read(second, x, y, 1), read(second, x, y, 2)];
      const delta = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
      const different = delta > limit;
      if (different) changed += 1;
      const gray = Math.round((a[0] + a[1] + a[2]) / 3);
      output[offset] = different ? 225 : Math.round(235 + gray * 0.08);
      output[offset + 1] = different ? 38 : Math.round(235 + gray * 0.08);
      output[offset + 2] = different ? 38 : Math.round(235 + gray * 0.08);
      output[offset + 3] = 255;
    }
  }
  const total = Math.max(1, width * height);
  return { width, height, data: output, changed, total, ratio: changed / total };
}

export function pdfDifferenceLabel(ratio, language = "ja") {
  const percent = (Math.max(0, Number(ratio) || 0) * 100).toFixed(ratio > 0 && ratio < 0.001 ? 3 : 2);
  return language === "ja" ? `差分 ${percent}%` : `${percent}% different`;
}

export function pdfCompareOutputName(pageNumber) {
  return `pdf-difference-${String(Math.max(1, Number(pageNumber) || 1)).padStart(3, "0")}.png`;
}
