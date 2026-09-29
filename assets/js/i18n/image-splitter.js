// Image Splitter strings.
export default {
  ja: {
    unsupported: "PNGまたはJPGファイルを選択してください。",
    pngFailed: "PNGを書き出せませんでした。",
    analyzing: "画像を解析中",
    nothingFound: name => `${name}: イラストを検出できませんでした。`,
    writing: (index, total) => `${index}/${total}を書き出し中`,
    status: (files, pieces) => `${files}ファイルから${pieces}枚に分割しました。`,
    detectionAlt: name => `${name}の検出結果`,
    detected: (name, count) => `${name} — ${count}個を検出`,
    savePng: "PNGを保存",
    done: "分割完了",
    failed: "分割に失敗しました",
    error: "分割中にエラーが発生しました。"
  },
  en: {
    unsupported: "Please choose PNG or JPG files.",
    pngFailed: "Could not export the PNG.",
    analyzing: "Analyzing image",
    nothingFound: name => `${name}: no illustrations were detected.`,
    writing: (index, total) => `Exporting ${index}/${total}`,
    status: (files, pieces) => `Split ${files} file${files === 1 ? "" : "s"} into ${pieces} image${pieces === 1 ? "" : "s"}.`,
    detectionAlt: name => `Detection result for ${name}`,
    detected: (name, count) => `${name} — ${count} detected`,
    savePng: "Save PNG",
    done: "Split complete",
    failed: "Split failed",
    error: "An error occurred while splitting."
  }
};
