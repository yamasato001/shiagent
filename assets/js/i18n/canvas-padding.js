export default {
  ja: {
    decoderError: "画像デコーダーでエラーが発生しました",
    unsupported: "対応していない画像形式が含まれていました",
    duplicate: "同じファイルはすでに追加されています",
    invalidSize: "Canvasサイズまたは余白の値を確認してください",
    tooLarge: "出力Canvasが大きすぎます。サイズや余白を小さくしてください",
    encodeFailed: label => `${label}を書き出せませんでした`,
    encodeUnsupported: label => `このブラウザは${label}出力に対応していません`,
    files: n => `${n} ファイル`,
    status: { ready: "待機中", processing: "処理中…", done: "完了", error: "処理できませんでした" },
    remove: "削除",
    save: "保存",
    progress: (done, total) => `${done} / ${total} 完了`,
    completed: (done, total) => `${done} / ${total} ファイルの余白追加完了`,
    cancelled: "処理を中止しました"
  },
  en: {
    decoderError: "The image decoder failed",
    unsupported: "Some files were in an unsupported format",
    duplicate: "That file is already in the list",
    invalidSize: "Check the canvas size and padding values",
    tooLarge: "The output canvas is too large. Reduce its size or padding",
    encodeFailed: label => `Could not export ${label}`,
    encodeUnsupported: label => `This browser cannot export ${label}`,
    files: n => `${n} file${n === 1 ? "" : "s"}`,
    status: { ready: "Ready", processing: "Processing…", done: "Complete", error: "Could not process" },
    remove: "Remove",
    save: "Download",
    progress: (done, total) => `${done} of ${total} complete`,
    completed: (done, total) => `${done} of ${total} files padded`,
    cancelled: "Processing cancelled"
  }
};
