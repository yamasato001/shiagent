export default {
  ja: {
    selectSvg: "SVGファイルを選択してください",
    invalidSvg: name => `${name}のサイズを取得できませんでした`,
    duplicate: "同じファイルはすでに追加されています",
    files: n => `${n} ファイル`,
    status: { ready: "Ready", processing: "変換中…", done: "完了", error: "変換できませんでした" },
    remove: "削除",
    download: "保存",
    progress: (done, total) => `${done} / ${total} 完了`,
    completed: (done, total) => `${done} / ${total} ファイルの変換完了`,
    output: (width, height, format) => `${width} × ${height}px · ${format}`,
    invalidSize: "出力サイズを正しく入力してください",
    tooLarge: "出力サイズが大きすぎます",
    encodeFailed: "画像を書き出せませんでした",
    webpUnsupported: "このブラウザはWebP出力に対応していません",
    cancelled: "変換を中止しました"
  },
  en: {
    selectSvg: "Choose SVG files",
    invalidSvg: name => `Could not read the size of ${name}`,
    duplicate: "That file is already in the list",
    files: n => `${n} file${n === 1 ? "" : "s"}`,
    status: { ready: "Ready", processing: "Converting…", done: "Complete", error: "Could not convert" },
    remove: "Remove",
    download: "Download",
    progress: (done, total) => `${done} of ${total} complete`,
    completed: (done, total) => `${done} of ${total} files converted`,
    output: (width, height, format) => `${width} × ${height}px · ${format}`,
    invalidSize: "Enter a valid output size",
    tooLarge: "The output size is too large",
    encodeFailed: "Could not export the image",
    webpUnsupported: "This browser cannot export WebP",
    cancelled: "Conversion cancelled"
  }
};
