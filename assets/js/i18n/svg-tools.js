// SVG Cleaner and SVG White Fill page strings.
export default {
  ja: {
    cleaner: {
      saved: rate => `${rate.toFixed(1)}% 削減`,
      larger: rate => `${rate.toFixed(1)}% 増加`,
      status: n => `${n}件のSVGを整理しました。`,
      beforeAlt: "整理前",
      afterAlt: "整理後",
      removed: (nodes, attributes) => `${nodes}ノード・${attributes}属性を削除`,
      done: "整理完了"
    },
    whiteFill: {
      status: n => `${n}領域を白塗りしました。`,
      beforeAlt: "変換前",
      afterAlt: "白塗り後",
      regions: n => `${n}領域`,
      done: "白塗り完了"
    }
  },
  en: {
    cleaner: {
      saved: rate => `${rate.toFixed(1)}% smaller`,
      larger: rate => `${rate.toFixed(1)}% larger`,
      status: n => `Cleaned ${n} SVG file${n === 1 ? "" : "s"}.`,
      beforeAlt: "Before cleaning",
      afterAlt: "After cleaning",
      removed: (nodes, attributes) => `Removed ${nodes} nodes and ${attributes} attributes`,
      done: "Cleanup complete"
    },
    whiteFill: {
      status: n => `Filled ${n} region${n === 1 ? "" : "s"} with white.`,
      beforeAlt: "Before",
      afterAlt: "After white fill",
      regions: n => `${n} region${n === 1 ? "" : "s"}`,
      done: "White fill complete"
    }
  }
};
