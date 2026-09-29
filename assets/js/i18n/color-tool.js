export default {
  ja: {
    unsupported: "PNG・JPEG・WebP・SVG以外のファイルは追加できません",
    invalidSvg: name => `${name}をSVGとして読み込めませんでした`,
    duplicate: "同じファイルはすでに追加されています",
    files: n => `${n} ファイル`,
    status: { ready: "待機中", processing: "処理中…", done: "完了", error: "処理できませんでした" },
    remove: "削除", download: "保存",
    progress: (done, total) => `${done} / ${total} 完了`,
    completed: (done, total) => `${done} / ${total} ファイルの処理完了`,
    encodeFailed: "画像を書き出せませんでした",
    webpUnsupported: "このブラウザはWebP出力に対応していません",
    tooLarge: "画像サイズが大きすぎます",
    cancelled: "処理を中止しました"
  },
  en: {
    unsupported: "Only PNG, JPEG, WebP, and SVG files can be added",
    invalidSvg: name => `Could not read ${name} as SVG`,
    duplicate: "That file is already in the list",
    files: n => `${n} file${n === 1 ? "" : "s"}`,
    status: { ready: "Ready", processing: "Processing…", done: "Complete", error: "Could not process" },
    remove: "Remove", download: "Download",
    progress: (done, total) => `${done} of ${total} complete`,
    completed: (done, total) => `${done} of ${total} files processed`,
    encodeFailed: "Could not export the image",
    webpUnsupported: "This browser cannot export WebP",
    tooLarge: "The image dimensions are too large",
    cancelled: "Processing cancelled"
  }
};
