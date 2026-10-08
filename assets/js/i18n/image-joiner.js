export default {
  ja: {
    decoderError: "画像デコーダーでエラーが発生しました",
    unsupported: "対応していない画像形式が含まれていました",
    duplicate: "同じファイルはすでに追加されています",
    invalidLayout: "出力サイズが大きすぎます。画像数、間隔、余白を減らしてください",
    encodeFailed: label => `${label}を書き出せませんでした`,
    encodeUnsupported: label => `このブラウザは${label}出力に対応していません`,
    files: n => `${n} ファイル`,
    status: { ready: "Ready", processing: "読み込み中…", done: "結合済み", error: "読み込めませんでした" },
    remove: "削除",
    moveEarlier: "前へ移動",
    moveLater: "後ろへ移動",
    progress: (done, total) => `${done} / ${total} 読み込み完了`,
    completed: (count, width, height) => `${count}枚を ${width} × ${height}px に結合しました`,
    cancelled: "画像結合を中止しました"
  },
  en: {
    decoderError: "The image decoder failed",
    unsupported: "Some files were in an unsupported format",
    duplicate: "That file is already in the list",
    invalidLayout: "The output is too large. Reduce the image count, gap, or padding",
    encodeFailed: label => `Could not export ${label}`,
    encodeUnsupported: label => `This browser cannot export ${label}`,
    files: n => `${n} file${n === 1 ? "" : "s"}`,
    status: { ready: "Ready", processing: "Loading…", done: "Joined", error: "Could not load" },
    remove: "Remove",
    moveEarlier: "Move earlier",
    moveLater: "Move later",
    progress: (done, total) => `${done} of ${total} loaded`,
    completed: (count, width, height) => `Joined ${count} images into ${width} × ${height}px`,
    cancelled: "Image joining cancelled"
  }
};
