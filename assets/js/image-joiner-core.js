function positiveInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

export function joinLayout(images, options = {}) {
  if (!Array.isArray(images) || images.length === 0) throw new Error("At least one image is required");
  const sizes = images.map(image => {
    const width = positiveInteger(image.width);
    const height = positiveInteger(image.height);
    if (!width || !height) throw new Error("Invalid image dimensions");
    return { width, height };
  });
  const mode = ["horizontal", "vertical", "grid"].includes(options.mode) ? options.mode : "horizontal";
  const gap = positiveInteger(options.gap);
  const padding = positiveInteger(options.padding);
  let width;
  let height;
  let placements;

  if (mode === "horizontal") {
    const contentHeight = Math.max(...sizes.map(size => size.height));
    width = sizes.reduce((sum, size) => sum + size.width, 0) + gap * (sizes.length - 1) + padding * 2;
    height = contentHeight + padding * 2;
    let x = padding;
    placements = sizes.map(size => {
      const placement = { x, y: padding + Math.round((contentHeight - size.height) / 2), ...size };
      x += size.width + gap;
      return placement;
    });
  } else if (mode === "vertical") {
    const contentWidth = Math.max(...sizes.map(size => size.width));
    width = contentWidth + padding * 2;
    height = sizes.reduce((sum, size) => sum + size.height, 0) + gap * (sizes.length - 1) + padding * 2;
    let y = padding;
    placements = sizes.map(size => {
      const placement = { x: padding + Math.round((contentWidth - size.width) / 2), y, ...size };
      y += size.height + gap;
      return placement;
    });
  } else {
    const columns = Math.min(sizes.length, Math.max(1, positiveInteger(options.columns, 2)));
    const rows = Math.ceil(sizes.length / columns);
    const cellWidth = Math.max(...sizes.map(size => size.width));
    const cellHeight = Math.max(...sizes.map(size => size.height));
    width = cellWidth * columns + gap * (columns - 1) + padding * 2;
    height = cellHeight * rows + gap * (rows - 1) + padding * 2;
    placements = sizes.map((size, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return {
        x: padding + column * (cellWidth + gap) + Math.round((cellWidth - size.width) / 2),
        y: padding + row * (cellHeight + gap) + Math.round((cellHeight - size.height) / 2),
        ...size
      };
    });
  }
  return { mode, width, height, placements };
}

export function joinedName(format) {
  const extension = format === "jpeg" ? "jpg" : format;
  if (!new Set(["png", "jpg", "webp"]).has(extension)) throw new Error("Unsupported output format");
  return `shiagent-joined-image.${extension}`;
}
