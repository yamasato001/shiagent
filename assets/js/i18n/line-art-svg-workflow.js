export default {
  ja: {
    unsupported: "PNG、JPEG、WebPの線画を選択してください。",
    duplicate: "同じファイルはすでに追加されています。",
    noContent: name => `${name}: 線画を検出できませんでした。`,
    renderFailed: "SVGの白塗り用画像を生成できませんでした。",
    progress: (index, total, name, step) => `${index}/${total} ${name} — ${step}`,
    steps: { trim: "トリミング", background: "背景処理", vectorize: "SVG変換", autoFill: "自動白塗り", clean: "SVG整理" },
    status: { ready: "待機中", processing: "処理中…", done: "完了", error: "処理できませんでした" },
    completed: (done, total) => `${total}件中${done}件のSVG素材を作成しました。`,
    partial: (done, total) => `${total}件中${done}件を作成しました。処理できなかったファイルを確認してください。`,
    manualHandoff: count => `${count}件をSVG手動白塗りへ引き継ぎます。`,
    download: "保存",
    complete: "処理完了",
    failed: "ワークフローを完了できませんでした。"
  },
  en: {
    unsupported: "Choose PNG, JPEG or WebP line art.",
    duplicate: "That file is already in the list.",
    noContent: name => `${name}: no line art was detected.`,
    renderFailed: "Could not render the SVG for white fill detection.",
    progress: (index, total, name, step) => `${index}/${total} ${name} — ${step}`,
    steps: { trim: "Trimming", background: "Background", vectorize: "Vectorizing", autoFill: "Auto white fill", clean: "Cleaning SVG" },
    status: { ready: "Ready", processing: "Processing…", done: "Complete", error: "Could not process" },
    completed: (done, total) => `Created ${done} of ${total} SVG assets.`,
    partial: (done, total) => `Created ${done} of ${total}. Check the files that could not be processed.`,
    manualHandoff: count => `Sending ${count} file${count === 1 ? "" : "s"} to Manual SVG White Fill.`,
    download: "Download",
    complete: "Complete",
    failed: "The workflow could not be completed."
  }
};
