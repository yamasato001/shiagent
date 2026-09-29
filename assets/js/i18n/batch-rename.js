// Batch Rename strings (page script and core).
export default {
  ja: {
    before: "変更前",
    after: "変更後",
    unsupported: "ファイルを選択してください。",
    status: n => `${n}件のファイル名を確定しました。`,
    handoff: (splitter, vector) => `画像分割へは${splitter}件、画像 → SVG変換へは${vector}件を渡せます。`,
    applied: "名前を確定しました",
    duplicate: name => `ファイル名が重複しています: ${name}`
  },
  en: {
    before: "Before",
    after: "After",
    unsupported: "Please choose files.",
    status: n => `Renamed ${n} file${n === 1 ? "" : "s"}.`,
    handoff: (splitter, vector) => `${splitter} file${splitter === 1 ? "" : "s"} can go to Image Splitter and ${vector} to Image to SVG.`,
    applied: "Names applied",
    duplicate: name => `Duplicate file name: ${name}`
  }
};
