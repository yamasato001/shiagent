import { mkdir, readFile, writeFile } from "node:fs/promises";

const tools = [
  {
    slug: "pdf-to-images",
    mode: "pdf-to-images",
    ja: { title: "PDFを画像に変換", short: "PDF → 画像", lead: "PDFの全ページまたは指定ページを、PNG・JPEG・WebPへ一括変換します。", description: "PDFをPNG・JPEG・WebP画像へ一括変換。対象ページ、解像度、画質を指定し、アップロードせずブラウザ内でZIP保存できます。", example: "例：資料PDFの全ページを150 DPIのWebPへ変換し、画像トレイから圧縮やリネームへ続けます。" },
    en: { title: "Convert PDF to Images", short: "PDF to Images", lead: "Convert every page or selected pages to PNG, JPEG or WebP images.", description: "Convert PDF pages to PNG, JPEG or WebP with page selection, resolution and quality controls. Process locally and download a ZIP.", example: "Example: render every page of a document as 150 DPI WebP, then continue to compression or renaming from the image tray." }
  },
  {
    slug: "page-numbers",
    mode: "page-numbers",
    ja: { title: "PDFにページ番号を追加", short: "ページ番号追加", lead: "開始番号・形式・位置・文字サイズを指定して、PDFへページ番号を追加します。", description: "PDFへページ番号を追加。対象ページ、開始番号、1 / 全ページなどの形式、位置、余白、文字サイズを指定してブラウザ内で保存できます。", example: "例：表紙を除く2ページ目から、下中央へ「1 / 12」形式の番号を追加します。" },
    en: { title: "Add Page Numbers to PDF", short: "Add Page Numbers", lead: "Add page numbers with a chosen start, format, position, font size and margin.", description: "Add page numbers to selected PDF pages with a custom starting number, format, position, margin and font size, entirely in your browser.", example: "Example: skip the cover and number the remaining pages at the bottom center in 1 / 12 format." }
  },
  {
    slug: "watermark",
    mode: "watermark",
    ja: { title: "PDFに透かしを追加", short: "透かし追加", lead: "文字または画像の透かしを、透明度・角度・位置・大きさを指定して追加します。", description: "PDFへ文字・画像の透かしを追加。対象ページ、透明度、角度、位置、大きさを指定し、ファイルをアップロードせず保存できます。", example: "例：全ページ中央へ「社外秘」を薄い斜め文字で追加します。" },
    en: { title: "Add Watermark to PDF", short: "Add Watermark", lead: "Place a text or image watermark with adjustable opacity, angle, position and size.", description: "Add text or image watermarks to selected PDF pages with opacity, angle, position and size controls, processed locally in your browser.", example: "Example: place a faint diagonal CONFIDENTIAL watermark across every page." }
  },
  {
    slug: "crop",
    mode: "crop",
    ja: { title: "PDFの余白をクロップ", short: "PDFクロップ", lead: "白い余白を自動検出するか、上下左右の寸法を指定してページを切り抜きます。", description: "PDFの白い余白を自動検出して削除、または上下左右をmm指定してクロップ。対象ページを選び、画質を変えずブラウザ内で保存できます。", example: "例：スキャンPDFの白い外周を自動検出し、内容の周囲に3mmだけ残して切り抜きます。" },
    en: { title: "Crop PDF Margins", short: "Crop PDF", lead: "Detect white margins automatically or enter exact top, right, bottom and left crop values.", description: "Automatically remove white PDF margins or crop each side by an exact millimeter value. Select pages and process locally without re-rendering content.", example: "Example: detect a scanned document's white border and keep 3 mm of padding around its content." }
  },
  {
    slug: "metadata-cleaner",
    mode: "metadata-cleaner",
    ja: { title: "PDFの文書情報を削除", short: "文書情報削除", lead: "タイトル・作成者・件名など、PDFに含まれる文書情報を取り除きます。", description: "PDFのタイトル、作成者、件名、キーワードなどの文書情報を端末内で削除。ファイルをアップロードせず、新しいPDFとして保存できます。", example: "例：外部共有前の資料から、作成者名や編集ソフト名などの文書情報を削除します。" },
    en: { title: "Remove PDF Metadata", short: "Remove Metadata", lead: "Remove document information such as title, author, subject and keywords from a PDF.", description: "Remove PDF title, author, subject, keywords and other document metadata locally in your browser, then save a clean PDF without uploading it.", example: "Example: remove author and editing-software information before sharing a document externally." }
  },
  {
    slug: "n-up",
    mode: "n-up",
    ja: { title: "PDFを複数ページ／1枚に配置", short: "複数ページ／1枚", lead: "2・4・6ページをA4用紙1枚へ面付けし、配布・印刷向けPDFを作成します。", description: "PDFの2・4・6ページをA4用紙1枚に配置。縦横、余白、間隔、境界線を指定して、ブラウザ内で面付けPDFを作成できます。", example: "例：講義資料をA4横の4ページ／1枚に配置し、紙の使用量を抑えて印刷します。" },
    en: { title: "Multiple PDF Pages per Sheet", short: "Pages per Sheet", lead: "Arrange 2, 4 or 6 PDF pages on each A4 sheet for compact printing and handouts.", description: "Place 2, 4 or 6 PDF pages on each A4 sheet. Choose orientation, margins, gaps and borders, and create the N-up PDF locally.", example: "Example: arrange lecture slides four per landscape A4 sheet to reduce paper use." }
  },
  {
    slug: "form-fill",
    mode: "form-fill",
    ja: { title: "PDFフォームに入力", short: "PDFフォーム入力", lead: "PDFに設定された入力欄を読み取り、ブラウザ上で記入して保存します。", description: "入力可能なPDFフォームのテキスト欄、チェックボックス、選択欄へブラウザ上で記入。必要なら入力内容を固定し、端末内で保存できます。", example: "例：申請書PDFの氏名・住所・選択項目を入力し、内容を固定して提出用に保存します。" },
    en: { title: "Fill PDF Forms", short: "Fill PDF Forms", lead: "Read fillable fields from a PDF, complete them in the browser and save the result.", description: "Fill PDF text fields, checkboxes and choice fields locally in your browser. Optionally flatten the values before saving the completed PDF.", example: "Example: complete an application form, flatten the values and save a submission-ready copy." }
  },
  {
    slug: "signature",
    mode: "signature",
    ja: { title: "PDFに署名を配置", short: "署名配置", lead: "文字・画像・手書きの署名を、選択したPDFページの指定位置へ配置します。", description: "文字入力、PNG・JPEG画像、手書きで作った署名をPDFへ配置。対象ページ、位置、大きさ、余白を指定して端末内で保存できます。", example: "例：最終ページの右下へ手書き署名を配置し、確認用PDFとして保存します。" },
    en: { title: "Place a Signature on PDF", short: "Place Signature", lead: "Place a typed, uploaded or hand-drawn visual signature on selected PDF pages.", description: "Add a typed, PNG/JPEG or hand-drawn visual signature to selected PDF pages with position, size and margin controls, all locally.", example: "Example: place a hand-drawn signature at the bottom right of the final page and save a review copy." }
  }
];

function update(template, language, tool) {
  const copy = tool[language];
  const prefix = language === "ja" ? "/ja" : "";
  let html = template
    .replaceAll("/ja/pdf/merge/", `/ja/pdf/${tool.slug}/`)
    .replaceAll("/pdf/merge/", `/pdf/${tool.slug}/`);
  html = html.replace(/<title>.*?<\/title>/, `<title>${copy.title} | SHIAGENT</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${copy.description}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${copy.title} | SHIAGENT">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${copy.description}">`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${copy.title} | SHIAGENT">`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${copy.description}">`);
  html = html.replace(/data-pdf-mode="merge"/, `data-pdf-mode="${tool.mode}"`);
  html = html.replace(/(<p class="breadcrumb">[\s\S]*?\/ )[^<]*(<\/p>)/, `$1${copy.short}$2`);
  html = html.replace(/<h1>.*?<\/h1>/, `<h1>${copy.title}</h1>`);
  html = html.replace(/<p class="lead">.*?<\/p>/, `<p class="lead">${copy.lead}</p>`);
  html = html.replace(/<p>例：.*?<\/p>/, `<p>${copy.example}</p>`).replace(/<p>Example:.*?<\/p>/, `<p>${copy.example}</p>`);
  html = html.replace(/<script type="application\/ld\+json" data-seo="software-application">[\s\S]*?<\/script>/, "");
  return html;
}

for (const language of ["en", "ja"]) {
  const templatePath = language === "ja" ? "ja/pdf/merge/index.html" : "pdf/merge/index.html";
  const template = await readFile(templatePath, "utf8");
  for (const tool of tools) {
    const directory = language === "ja" ? `ja/pdf/${tool.slug}` : `pdf/${tool.slug}`;
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/index.html`, update(template, language, tool));
  }
}

const finisherCopy = {
  ja: {
    title: "PDF一括仕上げ｜余白・向き・番号・文書情報・連番名 | SHIAGENT",
    heading: "PDF一括仕上げ",
    lead: "余白除去、向き自動補正、ページ番号、文書情報削除、ファイル名整理を一度に実行します。",
    description: "PDFの余白除去、向き自動補正、ページ番号追加、文書情報削除、連番ファイル名への整理をブラウザ内で一括処理します。",
    breadcrumb: `<p class="breadcrumb"><a href="/ja/">ホーム</a> / <a href="/ja/tools/?tab=workflows#tools">ワークフロー</a> / PDF一括仕上げ</p>`,
    pipeline: [["01", "余白除去", "白余白を自動検出"], ["02", "向き補正", "文章の上下を判定"], ["03", "ページ番号", "形式と位置を指定"], ["04", "文書情報削除", "作成者などを除去"], ["05", "ファイル名整理", "連番名へ統一"], ["06", "PDF保存", "単体またはZIP"]],
    example: "例：複数のスキャンPDFを追加し、余白と向きを整え、ページ番号を付けて document-001.pdf からの連番で保存します。"
  },
  en: {
    title: "PDF Finishing Workflow | SHIAGENT",
    heading: "PDF Finishing Workflow",
    lead: "Remove margins, correct orientation, add page numbers, clear metadata and organize file names in one run.",
    description: "Batch-finish PDFs locally by removing margins, correcting orientation, adding page numbers, clearing metadata and applying sequential file names.",
    breadcrumb: `<p class="breadcrumb"><a href="/">Home</a> / <a href="/tools/?tab=workflows#tools">Workflows</a> / PDF Finishing</p>`,
    pipeline: [["01", "Remove margins", "Detect white borders"], ["02", "Correct orientation", "Detect page direction"], ["03", "Add page numbers", "Choose format and position"], ["04", "Remove metadata", "Clear author details"], ["05", "Organize names", "Apply a sequence"], ["06", "Save PDF", "Single file or ZIP"]],
    example: "Example: add several scanned PDFs, fix margins and orientation, add page numbers, then save them from document-001.pdf onward."
  }
};

for (const language of ["en", "ja"]) {
  const templatePath = language === "ja" ? "ja/pdf/merge/index.html" : "pdf/merge/index.html";
  const directory = language === "ja" ? "ja/workflows/pdf-finisher" : "workflows/pdf-finisher";
  const copy = finisherCopy[language];
  let html = await readFile(templatePath, "utf8");
  html = html.replaceAll("/ja/pdf/merge/", "/ja/workflows/pdf-finisher/").replaceAll("/pdf/merge/", "/workflows/pdf-finisher/");
  html = html.replace(/<title>.*?<\/title>/, `<title>${copy.title}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${copy.description}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${copy.title}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${copy.description}">`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${copy.title}">`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${copy.description}">`);
  html = html.replace(/data-pdf-mode="merge"/, `data-pdf-mode="pdf-finisher"`);
  html = html.replace(/<p class="breadcrumb">[\s\S]*?<\/p>/, copy.breadcrumb);
  html = html.replace(/<h1>.*?<\/h1>/, `<h1>${copy.heading}</h1>`);
  html = html.replace(`<p class="eyebrow">PDF TOOL</p>`, `<p class="eyebrow">PDF WORKFLOW</p>`);
  html = html.replace(/<p class="lead">.*?<\/p>/, `<p class="lead">${copy.lead}</p>`);
  const pipeline = `<ol class="workflow-pipeline workflow-pipeline-six">${copy.pipeline.map(([number, label, detail]) => `<li><span>${number}</span><b>${label}</b><small>${detail}</small></li>`).join("")}</ol>`;
  const contractTemplate = `<template data-agent-contract><input id="pdfInput" type="file" accept="application/pdf,.pdf"><button id="pdfExport"></button><div id="pdfPages"></div><p id="pdfStatus"></p><input id="pdfCropPadding"><input id="pdfNumberStart"><select id="pdfNumberStyle"></select><select id="pdfPosition"></select><input id="pdfRenameBase"><input id="pdfRenameStart"><select id="pdfRenameDigits"></select></template>`;
  html = html.replace(`<div id="pdfWorkspaceRoot"></div>`, `${pipeline}${contractTemplate}<div id="pdfWorkspaceRoot"></div>`);
  html = html.replace(/<p>例：.*?<\/p>/, `<p>${copy.example}</p>`).replace(/<p>Example:.*?<\/p>/, `<p>${copy.example}</p>`);
  const faq = language === "ja"
    ? `<section class="content-section faq-section"><div class="section-kicker">FAQ</div><h2>よくある質問</h2><details><summary>PDFはアップロードされますか？<span>＋</span></summary><p>いいえ。余白検出からZIP作成まで、すべてブラウザ内で処理します。</p></details><details><summary>複数のPDFは結合されますか？<span>＋</span></summary><p>結合しません。各PDFを独立して仕上げ、連番名で保存します。複数件はZIPにまとめます。</p></details><details><summary>向きの判定は必ず正確ですか？<span>＋</span></summary><p>文字情報とページ画像から判定しますが、文字が少ないページや特殊なレイアウトでは誤判定する場合があります。</p></details><details><summary>元のPDFは変更されますか？<span>＋</span></summary><p>変更されません。処理結果は新しいPDFとして保存されます。</p></details></section>`
    : `<section class="content-section faq-section"><div class="section-kicker">FAQ</div><h2>Common questions</h2><details><summary>Are PDFs uploaded?<span>＋</span></summary><p>No. Everything from margin detection through ZIP creation runs in your browser.</p></details><details><summary>Are multiple PDFs merged?<span>＋</span></summary><p>No. Each PDF is finished separately and saved with a sequential name. Multiple outputs are bundled in a ZIP.</p></details><details><summary>Is orientation detection always exact?<span>＋</span></summary><p>It uses text information and page pixels, but sparse or unusual pages may still be misdetected.</p></details><details><summary>Is the original PDF changed?<span>＋</span></summary><p>No. The result is saved as a new PDF.</p></details></section>`;
  html = html.replace("</main>", `${faq}</main>`);
  html = html.replace(/<script type="application\/ld\+json" data-seo="software-application">[\s\S]*?<\/script>/, "");
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/index.html`, html);
}

const scanOptimizerCopy = {
  ja: {
    title: "スキャンPDF最適化｜OCR・余白・向き・圧縮を一括処理 | SHIAGENT",
    heading: "スキャンPDF最適化",
    lead: "紙資料やスキャンPDFを、向きと余白を整えた検索可能・軽量な共有用PDFへ変換します。",
    description: "スキャン画像やPDFをまとめ、向き補正、余白除去、OCR、軽量化、文書情報削除、連番名まで端末内で一括処理します。",
    breadcrumb: `<p class="breadcrumb"><a href="/ja/">ホーム</a> / <a href="/ja/tools/?tab=workflows#tools">ワークフロー</a> / スキャンPDF最適化</p>`,
    pipeline: [["01", "PDF化", "画像をまとめる"], ["02", "向き補正", "上下を自動判定"], ["03", "余白除去", "白い外周を整理"], ["04", "OCR", "検索可能にする"], ["05", "軽量化", "解像度を最適化"], ["06", "情報削除", "文書情報を消去"], ["07", "保存", "連番PDF・ZIP"]],
    example: "例：紙資料のスキャン画像をまとめ、向きと余白を整えてOCRし、軽量な検索可能PDFとして保存します。"
  },
  en: {
    title: "Scanned PDF Optimizer — OCR, Crop and Compress | SHIAGENT",
    heading: "Scanned PDF Optimizer",
    lead: "Turn paper scans and scanned PDFs into corrected, searchable and compact PDFs ready to share.",
    description: "Combine scans and locally correct orientation, crop white margins, run OCR, reduce size, clear metadata and apply sequential names.",
    breadcrumb: `<p class="breadcrumb"><a href="/">Home</a> / <a href="/tools/?tab=workflows#tools">Workflows</a> / Scanned PDF Optimizer</p>`,
    pipeline: [["01", "Make PDF", "Combine images"], ["02", "Orient", "Detect page direction"], ["03", "Crop", "Remove white borders"], ["04", "OCR", "Make it searchable"], ["05", "Reduce size", "Optimize resolution"], ["06", "Clear info", "Remove metadata"], ["07", "Save", "Numbered PDF or ZIP"]],
    example: "Example: combine document scans, correct their orientation and margins, run OCR, then save a compact searchable PDF."
  }
};

for (const language of ["en", "ja"]) {
  const templatePath = language === "ja" ? "ja/pdf/merge/index.html" : "pdf/merge/index.html";
  const directory = language === "ja" ? "ja/workflows/scan-pdf-optimizer" : "workflows/scan-pdf-optimizer";
  const copy = scanOptimizerCopy[language];
  let html = await readFile(templatePath, "utf8");
  html = html.replaceAll("/ja/pdf/merge/", "/ja/workflows/scan-pdf-optimizer/").replaceAll("/pdf/merge/", "/workflows/scan-pdf-optimizer/");
  html = html.replace(/<title>.*?<\/title>/, `<title>${copy.title}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${copy.description}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${copy.title}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${copy.description}">`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${copy.title}">`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${copy.description}">`);
  html = html.replace(`/assets/dist/pdf-workspace.js`, `/assets/dist/scan-pdf-optimizer-workflow.js`);
  html = html.replace(/data-pdf-mode="merge"/, `data-pdf-mode="scan-pdf-optimizer"`);
  html = html.replace(/<p class="breadcrumb">[\s\S]*?<\/p>/, copy.breadcrumb);
  html = html.replace(/<h1>.*?<\/h1>/, `<h1>${copy.heading}</h1>`);
  html = html.replace(`<p class="eyebrow">PDF TOOL</p>`, `<p class="eyebrow">PDF WORKFLOW</p>`);
  html = html.replace(/<p class="lead">.*?<\/p>/, `<p class="lead">${copy.lead}</p>`);
  const pipeline = `<ol class="workflow-pipeline workflow-pipeline-seven">${copy.pipeline.map(([number, label, detail]) => `<li><span>${number}</span><b>${label}</b><small>${detail}</small></li>`).join("")}</ol>`;
  const contractTemplate = `<template data-agent-contract><input id="scanPdfInput" type="file" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"><button id="scanPdfRun"></button><div id="scanPdfResults"></div><p id="scanPdfStatus"></p><select id="scanPdfLanguage"></select><select id="scanPdfQuality"></select><input id="scanPdfPadding"><input id="scanPdfBase"><input id="scanPdfStart"><select id="scanPdfDigits"></select><button id="scanPdfDownloadAll"></button></template>`;
  html = html.replace(`<div id="pdfWorkspaceRoot"></div>`, `${pipeline}${contractTemplate}<div id="scanPdfWorkflowRoot"></div>`);
  html = html.replace(/<p>例：.*?<\/p>/, `<p>${copy.example}</p>`).replace(/<p>Example:.*?<\/p>/, `<p>${copy.example}</p>`);
  const faq = language === "ja"
    ? `<section class="content-section faq-section"><div class="section-kicker">FAQ</div><h2>よくある質問</h2><details><summary>PDFや画像はアップロードされますか？<span>＋</span></summary><p>いいえ。向き補正、余白除去、OCR、軽量化、ZIP作成まで、すべてブラウザ内で処理します。</p></details><details><summary>画像を複数選ぶとどうなりますか？<span>＋</span></summary><p>選択順に1つの検索可能PDFへまとめます。PDFファイルはそれぞれ独立した結果になります。</p></details><details><summary>元のファイルは変更されますか？<span>＋</span></summary><p>変更されません。処理結果は新しいPDFとして保存されます。</p></details></section>`
    : `<section class="content-section faq-section"><div class="section-kicker">FAQ</div><h2>Common questions</h2><details><summary>Are PDFs or images uploaded?<span>＋</span></summary><p>No. Orientation, cropping, OCR, compression and ZIP creation all run in your browser.</p></details><details><summary>What happens when I select multiple images?<span>＋</span></summary><p>They are combined in selection order into one searchable PDF. PDF files remain separate outputs.</p></details><details><summary>Are the original files changed?<span>＋</span></summary><p>No. Each result is saved as a new PDF.</p></details></section>`;
  html = html.replace("</main>", `${faq}</main>`);
  html = html.replace(/<script type="application\/ld\+json" data-seo="software-application">[\s\S]*?<\/script>/, "");
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/index.html`, html);
}

const ocrCopy = {
  ja: { title: "OCR・検索可能PDF｜スキャンPDFへ透明文字層を追加 | SHIAGENT", heading: "OCR・検索可能PDF", short: "OCR・検索可能PDF", lead: "スキャンPDFへ透明な文字層を追加し、検索・選択・コピーできるPDFを作成します。", description: "スキャンPDFを日本語・英語OCRで認識し、元の見た目を保った検索可能PDFをブラウザ内で作成。PDFは外部へアップロードしません。", example: "例：紙資料をスキャンしたPDFへ日本語と英語の透明文字層を追加し、文書内検索できる状態で保存します。" },
  en: { title: "OCR PDF — Make Scans Searchable Locally | SHIAGENT", heading: "OCR & Searchable PDF", short: "OCR & Searchable PDF", lead: "Add an invisible text layer to scanned PDFs so their contents can be searched, selected and copied.", description: "Recognize Japanese and English scans and create searchable PDFs locally in your browser while preserving the original appearance.", example: "Example: add a Japanese and English text layer to a scanned document and save it as a searchable PDF." }
};

for (const language of ["en", "ja"]) {
  const templatePath = language === "ja" ? "ja/pdf/merge/index.html" : "pdf/merge/index.html";
  const directory = language === "ja" ? "ja/pdf/ocr" : "pdf/ocr";
  const copy = ocrCopy[language];
  let html = await readFile(templatePath, "utf8");
  html = html.replaceAll("/ja/pdf/merge/", "/ja/pdf/ocr/").replaceAll("/pdf/merge/", "/pdf/ocr/");
  html = html.replace(/<title>.*?<\/title>/, `<title>${copy.title}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${copy.description}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${copy.title}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${copy.description}">`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${copy.title}">`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${copy.description}">`);
  html = html.replace(`/assets/dist/pdf-workspace.js`, `/assets/dist/pdf-ocr.js`);
  html = html.replace(/data-pdf-mode="merge"/, `data-pdf-mode="ocr"`);
  html = html.replace(/(<p class="breadcrumb">[\s\S]*?\/ )[^<]*(<\/p>)/, `$1${copy.short}$2`);
  html = html.replace(/<h1>.*?<\/h1>/, `<h1>${copy.heading}</h1>`).replace(/<p class="lead">.*?<\/p>/, `<p class="lead">${copy.lead}</p>`);
  html = html.replace(`<div id="pdfWorkspaceRoot"></div>`, `<template data-agent-contract><input id="pdfOcrInput" type="file" accept="application/pdf,.pdf"><button id="pdfOcrRun"></button><div id="pdfOcrResult"></div><p id="pdfOcrStatus"></p><select id="pdfOcrLanguage"></select><select id="pdfOcrDpi"></select><select id="pdfOcrPageMode"></select><input id="pdfOcrRange"><button id="pdfOcrDownload"></button></template><div id="pdfOcrRoot"></div>`);
  html = html.replace(/<p>例：.*?<\/p>/, `<p>${copy.example}</p>`).replace(/<p>Example:.*?<\/p>/, `<p>${copy.example}</p>`);
  const faq = language === "ja"
    ? `<section class="content-section faq-section"><div class="section-kicker">FAQ</div><h2>よくある質問</h2><details><summary>PDFはアップロードされますか？<span>＋</span></summary><p>いいえ。PDFの描画、文字認識、透明文字層の追加はブラウザ内で行います。OCRエンジンと言語モデルもサイト内へ同梱しています。</p></details><details><summary>元の見た目は変わりますか？<span>＋</span></summary><p>スキャン画像をページ背景として使用し、その上へ見えない文字層を追加します。既に文字層があるページは原本のまま保持できます。</p></details><details><summary>どの言語に対応していますか？<span>＋</span></summary><p>日本語、日本語＋英語、英語を選択できます。横書きの印刷文字を主な対象としています。</p></details><details><summary>手書き文字も認識できますか？<span>＋</span></summary><p>手書き、縦書き、低解像度、傾きや汚れが大きい原稿は精度が下がります。</p></details></section>`
    : `<section class="content-section faq-section"><div class="section-kicker">FAQ</div><h2>Common questions</h2><details><summary>Is the PDF uploaded?<span>＋</span></summary><p>No. Rendering, recognition and text-layer creation run in the browser. The OCR engine and language models are bundled with the site.</p></details><details><summary>Does the page appearance change?<span>＋</span></summary><p>The scan remains the page background and invisible text is placed above it. Pages with existing text can be preserved unchanged.</p></details><details><summary>Which languages are supported?<span>＋</span></summary><p>Choose Japanese, Japanese plus English, or English. Printed horizontal text is the primary target.</p></details><details><summary>Does it recognize handwriting?<span>＋</span></summary><p>Accuracy is lower for handwriting, vertical writing, low-resolution scans, heavy skew or dirty pages.</p></details></section>`;
  html = html.replace("</main>", `${faq}</main>`);
  html = html.replace(/<script type="application\/ld\+json" data-seo="software-application">[\s\S]*?<\/script>/, "");
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/index.html`, html);
}

const compressorCopy = {
  ja: { title: "PDF圧縮｜埋め込み画像を再圧縮して軽量化 | SHIAGENT", heading: "PDF圧縮", short: "PDF圧縮", lead: "PDF内の埋め込み画像を再圧縮し、文字やベクターを保ちながらファイルサイズを軽量化します。", description: "PDF内のJPEG画像をブラウザ内で再圧縮して軽量化。画質優先・おすすめ・最大圧縮を選択でき、ファイルは外部へアップロードしません。", example: "例：写真を多く含む資料PDFを「おすすめ」で圧縮し、文字検索を維持したまま共有しやすい容量へ軽量化します。" },
  en: { title: "Compress PDF Images Locally | SHIAGENT", heading: "Compress PDF", short: "Compress PDF", lead: "Recompress embedded PDF images to reduce file size while preserving text and vectors.", description: "Recompress embedded JPEG images locally with Quality, Recommended and Maximum modes. Your PDF is never uploaded.", example: "Example: compress a photo-heavy report with Recommended mode while keeping its text searchable." }
};

for (const language of ["en", "ja"]) {
  const templatePath = language === "ja" ? "ja/pdf/merge/index.html" : "pdf/merge/index.html";
  const directory = language === "ja" ? "ja/pdf/compress" : "pdf/compress";
  const copy = compressorCopy[language];
  let html = await readFile(templatePath, "utf8");
  html = html.replaceAll("/ja/pdf/merge/", "/ja/pdf/compress/").replaceAll("/pdf/merge/", "/pdf/compress/");
  html = html.replace(/<title>.*?<\/title>/, `<title>${copy.title}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${copy.description}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${copy.title}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${copy.description}">`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${copy.title}">`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${copy.description}">`);
  html = html.replace(`/assets/dist/pdf-workspace.js`, `/assets/dist/pdf-compressor.js`);
  html = html.replace(/data-pdf-mode="merge"/, `data-pdf-mode="compress"`);
  html = html.replace(/(<p class="breadcrumb">[\s\S]*?\/ )[^<]*(<\/p>)/, `$1${copy.short}$2`);
  html = html.replace(/<h1>.*?<\/h1>/, `<h1>${copy.heading}</h1>`).replace(/<p class="lead">.*?<\/p>/, `<p class="lead">${copy.lead}</p>`);
  html = html.replace(`<div id="pdfWorkspaceRoot"></div>`, `<template data-agent-contract><input id="pdfCompressorInput" type="file" accept="application/pdf,.pdf"><button id="pdfCompressorRun"></button><div id="pdfCompressorResult"></div><p id="pdfCompressorStatus"></p><input name="pdfCompressionLevel" value="recommended"><button id="pdfCompressorDownload"></button></template><div id="pdfCompressorRoot"></div>`);
  html = html.replace(/<p>例：.*?<\/p>/, `<p>${copy.example}</p>`).replace(/<p>Example:.*?<\/p>/, `<p>${copy.example}</p>`);
  const faq = language === "ja"
    ? `<section class="content-section faq-section"><div class="section-kicker">FAQ</div><h2>よくある質問</h2><details><summary>文字検索は維持されますか？<span>＋</span></summary><p>画質優先とおすすめは埋め込みJPEGだけを再圧縮するため、文字・リンク・ベクターを維持します。最大圧縮は全ページを画像化します。</p></details><details><summary>どのPDFで効果がありますか？<span>＋</span></summary><p>写真やスキャン画像を多く含むPDFで効果が出ます。文字・図形だけのPDFや既に最適化されたPDFはあまり小さくならない場合があります。</p></details><details><summary>元より大きくなることはありますか？<span>＋</span></summary><p>圧縮結果が元より大きい場合は原本データを出力するため、容量が増えることはありません。</p></details><details><summary>PDFはアップロードされますか？<span>＋</span></summary><p>いいえ。画像解析、再圧縮、PDF保存はすべてブラウザ内で行います。</p></details></section>`
    : `<section class="content-section faq-section"><div class="section-kicker">FAQ</div><h2>Common questions</h2><details><summary>Does text stay searchable?<span>＋</span></summary><p>Quality and Recommended only recompress embedded JPEGs, preserving text, links and vectors. Maximum rasterizes every page.</p></details><details><summary>Which PDFs benefit most?<span>＋</span></summary><p>Photo-heavy and scanned PDFs benefit most. Text-only or already optimized documents may shrink very little.</p></details><details><summary>Can the result become larger?<span>＋</span></summary><p>If compression produces a larger file, the original bytes are returned instead.</p></details><details><summary>Is the PDF uploaded?<span>＋</span></summary><p>No. Image analysis, recompression and PDF export run entirely in your browser.</p></details></section>`;
  html = html.replace("</main>", `${faq}</main>`);
  html = html.replace(/<script type="application\/ld\+json" data-seo="software-application">[\s\S]*?<\/script>/, "");
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/index.html`, html);
}

const compareCopy = {
  ja: { title: "PDF比較｜2つのPDFを左右・重ね合わせ・差分表示 | SHIAGENT", heading: "PDF比較", short: "PDF比較", lead: "2つのPDFをページ単位で比較し、左右・重ね合わせ・差分強調で変更箇所を確認します。", description: "2つのPDFをアップロードせずブラウザ内で比較。ページ数の違いと差分率を表示し、差分強調画像をZIP保存できます。", example: "例：修正前と修正後の資料を比較し、文字や配置の変更箇所を赤色で確認します。" },
  en: { title: "Compare PDFs Side by Side and Highlight Differences | SHIAGENT", heading: "Compare PDFs", short: "Compare PDFs", lead: "Compare two PDFs page by page with side-by-side, overlay and highlighted difference views.", description: "Compare two PDFs locally in your browser, see page-count and visual differences, and download highlighted difference images as a ZIP.", example: "Example: compare original and revised documents and review changed text or layout highlighted in red." }
};

for (const language of ["en", "ja"]) {
  const templatePath = language === "ja" ? "ja/pdf/merge/index.html" : "pdf/merge/index.html";
  const directory = language === "ja" ? "ja/pdf/compare" : "pdf/compare";
  const copy = compareCopy[language];
  let html = await readFile(templatePath, "utf8");
  html = html.replaceAll("/ja/pdf/merge/", "/ja/pdf/compare/").replaceAll("/pdf/merge/", "/pdf/compare/");
  html = html.replace(/<title>.*?<\/title>/, `<title>${copy.title}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${copy.description}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${copy.title}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${copy.description}">`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${copy.title}">`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${copy.description}">`);
  html = html.replace(`/assets/dist/pdf-workspace.js`, `/assets/dist/pdf-compare.js`);
  html = html.replace(/data-pdf-mode="merge"/, `data-pdf-mode="compare"`);
  html = html.replace(/(<p class="breadcrumb">[\s\S]*?\/ )[^<]*(<\/p>)/, `$1${copy.short}$2`);
  html = html.replace(/<h1>.*?<\/h1>/, `<h1>${copy.heading}</h1>`).replace(/<p class="lead">.*?<\/p>/, `<p class="lead">${copy.lead}</p>`);
  html = html.replace(`<div id="pdfWorkspaceRoot"></div>`, `<template data-agent-contract><input id="pdfCompareA" type="file" accept="application/pdf,.pdf"><input id="pdfCompareB" type="file" accept="application/pdf,.pdf"><button id="pdfCompareRun"></button><div id="pdfComparePages"></div><p id="pdfCompareStatus"></p><select id="pdfCompareThreshold"></select><select id="pdfCompareDpi"></select></template><div id="pdfCompareRoot"></div>`);
  html = html.replace(`<div id="pdfTrayRoot"></div>`, `<div id="pdfTrayRoot"></div><div id="workTrayRoot"></div><script type="module" src="/assets/js/workflow-handoff.js"></script>`);
  html = html.replace(/<p>例：.*?<\/p>/, `<p>${copy.example}</p>`).replace(/<p>Example:.*?<\/p>/, `<p>${copy.example}</p>`);
  const faq = language === "ja"
    ? `<section class="content-section faq-section"><div class="section-kicker">FAQ</div><h2>よくある質問</h2><details><summary>PDFはアップロードされますか？<span>＋</span></summary><p>いいえ。描画と比較はすべてブラウザ内で実行します。</p></details><details><summary>何を比較していますか？<span>＋</span></summary><p>各ページを同じ解像度で描画し、画素の色差から変更箇所を検出します。</p></details><details><summary>文字の意味も比較しますか？<span>＋</span></summary><p>現在は見た目の比較です。文字内容、位置、画像、図形の変化を画面上の差として検出します。</p></details><details><summary>ページ数が違う場合は？<span>＋</span></summary><p>片方にだけ存在するページも差分ページとして表示します。</p></details></section>`
    : `<section class="content-section faq-section"><div class="section-kicker">FAQ</div><h2>Common questions</h2><details><summary>Are PDFs uploaded?<span>＋</span></summary><p>No. Rendering and comparison run entirely in your browser.</p></details><details><summary>What is compared?<span>＋</span></summary><p>Each page is rendered at the same resolution and visual changes are detected from pixel color differences.</p></details><details><summary>Does it understand the meaning of text?<span>＋</span></summary><p>This is a visual comparison. It detects changes to text appearance, position, images and shapes.</p></details><details><summary>What if page counts differ?<span>＋</span></summary><p>Pages present in only one PDF are shown as different pages.</p></details></section>`;
  html = html.replace("</main>", `${faq}</main>`);
  html = html.replace(/<script type="application\/ld\+json" data-seo="software-application">[\s\S]*?<\/script>/, "");
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/index.html`, html);
}

const iconParts = {
  merge: `<path d="M8 8h26v34H8zM62 8h26v34H62zM35 38h26v27H35z"/><path d="M21 42v8h18m36-8v8H57M48 39v18m-6-6 6 6 6-6"/>`,
  split: `<path d="M30 9h36v54H30zM30 36h36"/><path d="M76 25 62 36l14 11M55 31l7 5-7 5"/>`,
  reorder: `<path d="M30 8h36v56H30zM38 20h20M38 30h20M38 40h20M38 50h20"/><path d="M76 20v31m-6-25 6-6 6 6m-12 19 6 6 6-6"/>`,
  interleave: `<path d="M10 13h25v42H10zM61 13h25v42H61zM35 24h26M35 44h26"/><path d="m54 18 7 6-7 6m-12 8-7 6 7 6"/>`,
  rotate: `<rect x="12" y="14" width="24" height="44"/><rect x="48" y="24" width="44" height="24"/>`,
  "delete-pages": `<path d="M11 8h38v54H11zM19 20h22M19 30h22"/><path d="m19 43 22 14m0-14L19 57M62 28h22M66 28v32h14V28M60 22h26M70 17h6"/>`,
  "images-to-pdf": `<rect x="8" y="18" width="28" height="36"/><path d="m12 47 8-10 6 7 5-6 5 7M17 29h1"/><path d="M54 9h30v54H54zM41 36h13m-6-6 6 6-6 6"/>`,
  "pdf-to-images": `<path d="M12 9h30v54H12z"/><rect x="59" y="18" width="28" height="36"/><path d="m63 47 8-10 6 7 5-6 5 7M68 29h1M42 36h17m-7-6 7 6-7 6"/>`,
  "page-numbers": `<path d="M29 8h38v56H29zM38 20h20M38 30h20"/><path d="M42 53h12m-6-9v18"/>`,
  watermark: `<path d="M26 8h44v56H26zM34 21h28M34 51h28"/><path d="m29 51 38-31"/><text x="43" y="42" font-size="17" fill="currentColor" stroke="none">W</text>`,
  crop: `<path d="M29 8v45a10 10 0 0 0 10 10h38M18 19h39a10 10 0 0 1 10 10v34"/><path d="M22 13v12m-6-6h12M67 57v12m-6-6h12"/>`,
  "metadata-cleaner": `<path d="M20 9h38v54H20zM29 22h20M29 32h20M29 42h14"/><path d="m59 47 13-13 10 10-13 13H59zM72 34l10 10"/>`,
  "n-up": `<path d="M19 8h58v56H19zM48 8v56M19 36h58"/><path d="M29 20h9M58 20h9M29 48h9M58 48h9"/>`,
  "form-fill": `<path d="M23 8h50v56H23zM32 20h13M32 31h7M32 42h7M47 27h17v8H47zM47 38h17v8H47z"/><path d="m33 53 5 5 10-13"/>`,
  signature: `<path d="M20 9h56v54H20zM29 23h38M29 51h38"/><path d="M30 47c7-18 8 8 16-7 5-9 3 9 18-3"/>`,
  compare: `<path d="M13 10h31v52H13zM52 10h31v52H52zM21 23h15M60 23h15M21 33h15M60 33h10"/><path d="M39 48h18m-6-6 6 6-6 6"/>`,
  ocr: `<path d="M24 8h40v56H24zM32 21h24M32 31h24M32 41h16"/><circle cx="69" cy="49" r="12"/><path d="m78 58 9 9"/>`,
  compress: `<path d="M29 8h38v56H29z"/><path d="M8 36h18m-7-7 7 7-7 7M88 36H70m7-7-7 7 7 7"/>`
};

function addCatalogIllustrations(html) {
  html = html.replace(/<span class="pdf-tool-illustration" aria-hidden="true">[\s\S]*?<\/span>/g, "");
  return html.replace(/(<a class="pdf-tool-card" href="\/(?:ja\/)?pdf\/([^/]+)\/">)(?!<span class="pdf-tool-illustration")/g, (match, open, slug) => {
    const drawing = iconParts[slug] || `<path d="M29 8h38v56H29zM37 22h22M37 32h22M37 42h16"/>`;
    return `${open}<span class="pdf-tool-illustration" aria-hidden="true"><svg viewBox="0 0 96 72">${drawing}</svg></span>`;
  });
}

function consolidateAndRenumberCatalog(html) {
  html = html.replace(/<a class="pdf-tool-card" href="\/(?:ja\/)?pdf\/interleave\/">[\s\S]*?<\/a>/, "");
  let number = 0;
  return html.replace(/(<a class="pdf-tool-card" href="\/(?:ja\/)?pdf\/[^/]+\/">)([\s\S]*?)(<\/a>)/g, (match, open, body, close) => {
    number += 1;
    return `${open}${body.replace(/<span>\d{2} ·/, `<span>${String(number).padStart(2, "0")} ·`)}${close}`;
  });
}

const catalogCards = {
  ja: `<a class="pdf-tool-card" href="/ja/pdf/pdf-to-images/"><span>08 · RENDER</span><h2>PDF → 画像</h2><p>指定ページをPNG・JPEG・WebPへ一括変換し、画像トレイへ渡します。</p></a><a class="pdf-tool-card" href="/ja/pdf/page-numbers/"><span>09 · NUMBER</span><h2>ページ番号追加</h2><p>開始番号・形式・位置・余白を指定して番号を追加します。</p></a><a class="pdf-tool-card" href="/ja/pdf/watermark/"><span>10 · WATERMARK</span><h2>透かし追加</h2><p>文字または画像の透かしを、透明度や角度を調整して配置します。</p></a><a class="pdf-tool-card" href="/ja/pdf/crop/"><span>11 · CROP</span><h2>PDFクロップ</h2><p>白余白を自動検出するか、四辺をmm指定して切り抜きます。</p></a><a class="pdf-tool-card" href="/ja/pdf/metadata-cleaner/"><span>12 · CLEAN</span><h2>文書情報削除</h2><p>タイトル・作成者・件名など、PDFの文書情報を取り除きます。</p></a><a class="pdf-tool-card" href="/ja/pdf/n-up/"><span>13 · N-UP</span><h2>複数ページ／1枚</h2><p>2・4・6ページをA4用紙1枚へ配置し、印刷用PDFを作ります。</p></a><a class="pdf-tool-card" href="/ja/pdf/form-fill/"><span>14 · FORM</span><h2>PDFフォーム入力</h2><p>既存の入力欄を読み取り、記入・固定して保存します。</p></a><a class="pdf-tool-card" href="/ja/pdf/signature/"><span>15 · SIGN</span><h2>署名配置</h2><p>文字・画像・手書きの署名を選択ページへ配置します。</p></a><a class="pdf-tool-card" href="/ja/pdf/compare/"><span>16 · COMPARE</span><h2>PDF比較</h2><p>2つのPDFを左右・重ね合わせ・差分強調で比較します。</p></a><a class="pdf-tool-card" href="/ja/pdf/ocr/"><span>17 · OCR</span><h2>OCR・検索可能PDF</h2><p>スキャンPDFへ透明文字層を追加し、検索・コピー可能にします。</p></a><a class="pdf-tool-card" href="/ja/pdf/compress/"><span>18 · COMPRESS</span><h2>PDF圧縮</h2><p>埋め込み画像を再圧縮し、文字を保ったまま軽量化します。</p></a>`,
  en: `<a class="pdf-tool-card" href="/pdf/pdf-to-images/"><span>08 · RENDER</span><h2>PDF to Images</h2><p>Render selected pages as PNG, JPEG or WebP and continue in the image tray.</p></a><a class="pdf-tool-card" href="/pdf/page-numbers/"><span>09 · NUMBER</span><h2>Add Page Numbers</h2><p>Choose the start, format, position and margin for page numbers.</p></a><a class="pdf-tool-card" href="/pdf/watermark/"><span>10 · WATERMARK</span><h2>Add Watermark</h2><p>Place a text or image watermark with custom opacity and angle.</p></a><a class="pdf-tool-card" href="/pdf/crop/"><span>11 · CROP</span><h2>Crop PDF</h2><p>Detect white margins or enter exact crop values for all four sides.</p></a><a class="pdf-tool-card" href="/pdf/metadata-cleaner/"><span>12 · CLEAN</span><h2>Remove Metadata</h2><p>Remove title, author, subject and other document information.</p></a><a class="pdf-tool-card" href="/pdf/n-up/"><span>13 · N-UP</span><h2>Pages per Sheet</h2><p>Arrange 2, 4 or 6 pages on each A4 sheet for printing.</p></a><a class="pdf-tool-card" href="/pdf/form-fill/"><span>14 · FORM</span><h2>Fill PDF Forms</h2><p>Read existing fields, complete them and optionally flatten the result.</p></a><a class="pdf-tool-card" href="/pdf/signature/"><span>15 · SIGN</span><h2>Place Signature</h2><p>Add a typed, uploaded or hand-drawn visual signature.</p></a><a class="pdf-tool-card" href="/pdf/compare/"><span>16 · COMPARE</span><h2>Compare PDFs</h2><p>Compare two PDFs side by side, overlaid or with differences highlighted.</p></a><a class="pdf-tool-card" href="/pdf/ocr/"><span>17 · OCR</span><h2>OCR & Searchable PDF</h2><p>Add an invisible text layer to scans for search and copy.</p></a><a class="pdf-tool-card" href="/pdf/compress/"><span>18 · COMPRESS</span><h2>Compress PDF</h2><p>Recompress embedded images while preserving searchable text.</p></a>`
};
for (const language of ["en", "ja"]) {
  const file = language === "ja" ? "ja/pdf/index.html" : "pdf/index.html";
  let html = await readFile(file, "utf8");
  const breadcrumb = language === "ja"
    ? `<p class="breadcrumb"><a href="/ja/">ホーム</a> / PDFツール</p>`
    : `<p class="breadcrumb"><a href="/">Home</a> / PDF Tools</p>`;
  html = html.replace(
    /(<main id="main-content" class="pdf-category">)(?:<p class="breadcrumb">[\s\S]*?<\/p>)?/,
    `$1${breadcrumb}`
  );
  html = html.replace(/<a class="pdf-tool-card" href="\/(?:ja\/)?pdf\/pdf-to-images\/">[\s\S]*?(?=<\/div><\/main>)/, "");
  html = html.replace("</div></main>", `${catalogCards[language]}</div></main>`);
  html = consolidateAndRenumberCatalog(html);
  html = addCatalogIllustrations(html);
  html = html.replace(
    /<p class="pdf-category-lead">[\s\S]*?<\/p>/,
    language === "ja"
      ? `<p class="pdf-category-lead">PDFの整理・変換・記入・署名まで行える専用ワークスペース。すべてブラウザ内で処理し、ファイルをサーバーへ送信しません。</p>`
      : `<p class="pdf-category-lead">A dedicated workspace to organize, convert, complete and sign PDFs. Everything stays in your browser.</p>`
  );
  await writeFile(file, html);
}

console.log(`Generated ${tools.length * 2} PDF tool pages.`);
