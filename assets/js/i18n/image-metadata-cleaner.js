export default {
  ja: {
    unsupported: "PNG・JPEG・WebP以外のファイルは追加できません",
    duplicate: "同じファイルはすでに追加されています",
    files: n => `${n} ファイル`,
    status: { ready: "待機中", processing: "削除中…", done: "削除完了", clean: "メタデータなし", error: "処理できませんでした" },
    removed: labels => `${labels.join("・")}を削除`,
    unchanged: "削除対象のメタデータは見つかりませんでした",
    remove: "削除",
    download: "保存",
    progress: (done, total) => `${done} / ${total} 完了`,
    completed: (done, total) => `${done} / ${total} ファイルの処理完了`,
    cancelled: "処理を中止しました"
  },
  en: {
    unsupported: "Only PNG, JPEG, and WebP files can be added",
    duplicate: "That file is already in the list",
    files: n => `${n} file${n === 1 ? "" : "s"}`,
    status: { ready: "Ready", processing: "Cleaning…", done: "Cleaned", clean: "No metadata", error: "Could not process" },
    removed: labels => `Removed ${labels.join(", ")}`,
    unchanged: "No removable metadata was found",
    remove: "Remove",
    download: "Download",
    progress: (done, total) => `${done} of ${total} complete`,
    completed: (done, total) => `${done} of ${total} files processed`,
    cancelled: "Cleaning cancelled"
  }
};
