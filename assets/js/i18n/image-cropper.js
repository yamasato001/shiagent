export default {
  ja: { unsupported:"対応していない画像形式が含まれていました", empty:"対象物を検出できませんでした", files:n=>`${n} ファイル`, ready:"待機中", processing:"処理中…", done:"完了", failed:"処理できませんでした", save:"保存", remove:"削除", completed:(n,t)=>`${n} / ${t} ファイル完了`, progress:(n,t)=>`${n} / ${t} 完了`, noManual:"手動範囲を指定してください", decode:"画像を読み込めませんでした" },
  en: { unsupported:"Some files were unsupported", empty:"No content was detected", files:n=>`${n} file${n===1?"":"s"}`, ready:"Ready", processing:"Processing…", done:"Complete", failed:"Could not process", save:"Download", remove:"Remove", completed:(n,t)=>`${n} of ${t} files complete`, progress:(n,t)=>`${n} of ${t} complete`, noManual:"Select a manual crop area", decode:"Could not decode the image" }
};
