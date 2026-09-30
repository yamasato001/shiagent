// Image to SVG (src/png-to-svg.js) and the manual white-fill editor.
export default {
  ja: {
    vectorizer: {
      unsupported: "PNG、JPEG、WebPファイルを選択してください。",
      noLines: "黒い線を検出できませんでした。",
      nothingFound: "イラストを検出できませんでした。",
      status: (files, svgs) => `${files}ファイルから${svgs}件のSVGを生成しました。`,
      beforeAlt: name => `${name}の変換前`,
      afterAlt: name => `${name}の変換後`,
      preparing: "Potraceを準備中…",
      done: "変換完了",
      failed: "変換に失敗しました",
      error: "変換中にエラーが発生しました。",
      loadFailed: "画像を読み込めませんでした。"
    },
    editor: {
      displayFailed: "SVGを表示できませんでした。",
      parseFailed: name => `${name}: SVGを解析できません。`,
      updating: "自動更新中…",
      regions: (n, stale) => `${n}個${stale ? "（更新中）" : ""}`,
      detecting: "検出中…",
      lines: n => `${n}本`,
      excludes: n => `${n}箇所`,
      status: (index, total, name, stale) => `${index}/${total}  ${name}${stale ? "  ● 自動更新中" : ""}`,
      choose: "SVGを選択してください",
      folderSave: "表示中を保存",
      folderSaveAll: "すべて保存",
      changeFolder: "保存先を変更",
      folderSelected: name => `保存先を「${name}」に設定しました。`,
      folderSaved: (name, folder) => `${name} を「${folder}」に保存しました。`,
      folderSavedAll: (count, folder) => `${count}件のSVGを「${folder}」に保存しました。`,
      folderFailed: "フォルダへの保存に失敗しました。",
      allDone: "すべてのSVGを確定しました。結果は作業トレイに入っています。"
    }
  },
  en: {
    vectorizer: {
      unsupported: "Please choose PNG, JPEG or WebP files.",
      noLines: "No dark lines were detected.",
      nothingFound: "No illustrations were detected.",
      status: (files, svgs) => `Created ${svgs} SVG file${svgs === 1 ? "" : "s"} from ${files} image${files === 1 ? "" : "s"}.`,
      beforeAlt: name => `${name} before conversion`,
      afterAlt: name => `${name} after conversion`,
      preparing: "Preparing Potrace…",
      done: "Conversion complete",
      failed: "Conversion failed",
      error: "An error occurred during conversion.",
      loadFailed: "Could not load the image."
    },
    editor: {
      displayFailed: "Could not display the SVG.",
      parseFailed: name => `${name}: could not parse the SVG.`,
      updating: "Updating…",
      regions: (n, stale) => `${n}${stale ? " (updating)" : ""}`,
      detecting: "Detecting…",
      lines: n => `${n} line${n === 1 ? "" : "s"}`,
      excludes: n => `${n} area${n === 1 ? "" : "s"}`,
      status: (index, total, name, stale) => `${index}/${total}  ${name}${stale ? "  ● Updating" : ""}`,
      choose: "Choose SVG files",
      folderSave: "Save current",
      folderSaveAll: "Save all",
      changeFolder: "Change folder",
      folderSelected: name => `Output folder set to “${name}”.`,
      folderSaved: (name, folder) => `Saved ${name} to “${folder}”.`,
      folderSavedAll: (count, folder) => `Saved ${count} SVG file${count === 1 ? "" : "s"} to “${folder}”.`,
      folderFailed: "Could not save to the selected folder.",
      allDone: "All SVG files are finalized. The results are in the work tray."
    }
  }
};
