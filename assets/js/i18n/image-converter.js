// Image Converter strings, plus the shared HEIC/TIFF decoder worker.
export default {
  ja: {
    decoderError: "画像デコーダーでエラーが発生しました",
    cancelled: "変換を中止しました",
    encodeFailed: label => `${label}を書き出せませんでした`,
    encodeUnsupported: label => `このブラウザは${label}出力に対応していません`,
    unsupported: "対応していない画像形式が含まれていました",
    duplicate: "同じファイルはすでに追加されています",
    files: n => `${n} ファイル`,
    status: { processing: "変換中…", done: "完了", error: "変換できませんでした", ready: "Ready" },
    before: "変換前",
    after: "変換後",
    download: "保存",
    remove: "削除",
    progress: (done, total) => `${done} / ${total} 完了`,
    completed: (done, total) => `${done} / ${total} ファイル変換完了`,
    tiffEmpty: "TIFFに画像が見つかりませんでした",
    decoderUnsupported: format => `未対応のデコーダー形式です: ${format}`,
    sameFormat: {
      lossy: (label, count) => `${label}の画像が${count}枚あります。同じ形式への変換は再圧縮になり、画質が少し変わります。サイズを小さくしたい場合は`,
      lossless: (label, count) => `${label}の画像が${count}枚あります。同じ形式への変換は書き出し直しになり、サイズはほとんど変わりません。サイズを小さくしたい場合は`,
      link: "画像圧縮",
      after: "を使ってください。"
    }
  },
  en: {
    decoderError: "The image decoder failed",
    cancelled: "Conversion cancelled",
    encodeFailed: label => `Could not export ${label}`,
    encodeUnsupported: label => `This browser cannot export ${label}`,
    unsupported: "Some files were in an unsupported format",
    duplicate: "That file is already in the list",
    files: n => `${n} file${n === 1 ? "" : "s"}`,
    status: { processing: "Converting…", done: "Complete", error: "Could not convert", ready: "Ready" },
    before: "Before",
    after: "After",
    download: "Download",
    remove: "Remove",
    progress: (done, total) => `${done} of ${total} complete`,
    completed: (done, total) => `${done} of ${total} files converted`,
    tiffEmpty: "No image was found in the TIFF",
    decoderUnsupported: format => `Unsupported decoder format: ${format}`,
    sameFormat: {
      lossy: (label, count) => `${count} of your images ${count === 1 ? "is" : "are"} already ${label}. Converting to the same format re-compresses ${count === 1 ? "it" : "them"} and changes the quality slightly. To make files smaller, use `,
      lossless: (label, count) => `${count} of your images ${count === 1 ? "is" : "are"} already ${label}. Converting to the same format only rewrites ${count === 1 ? "it" : "them"} at about the same size. To make files smaller, use `,
      link: "Image Compressor",
      after: "."
    }
  }
};
