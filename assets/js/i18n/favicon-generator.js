export default {
  ja: {
    unsupported: "PNG・JPEG・WebP・SVGを選択してください",
    invalidSvg: "SVGのサイズを取得できませんでした",
    ready: "生成の準備ができました",
    processing: "アイコンを生成中…",
    completed: n => `${n}ファイルを生成しました`,
    download: "保存",
    copied: "設置タグをコピーしました",
    copyFailed: "コピーできませんでした",
    encodeFailed: "PNGを書き出せませんでした",
    tooLarge: "元画像のサイズが大きすぎます"
  },
  en: {
    unsupported: "Choose a PNG, JPEG, WebP, or SVG file",
    invalidSvg: "Could not read the SVG dimensions",
    ready: "Ready to generate",
    processing: "Generating icons…",
    completed: n => `Generated ${n} files`,
    download: "Download",
    copied: "Link tags copied",
    copyFailed: "Could not copy the tags",
    encodeFailed: "Could not export PNG",
    tooLarge: "The source image is too large"
  }
};
