import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  excludedRoutes,
  inferCategory,
  inferOutput,
  pdfContract,
  primaryActionIds,
  routeOverrides,
  siteOrigin,
} from "./tool-contracts.mjs";

const root = new URL("../", import.meta.url);
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const bingVerification = process.env.BING_SITE_VERIFICATION?.trim();
const brandMark = '<img class="brand-mark" src="/assets/brand/shiagent-mark-black.svg" width="28" height="28" alt="" aria-hidden="true">';
const noindexPages = new Set([
  "line-art-generator/index.html",
  "ja/line-art-generator/index.html",
]);

const pageCopy = {
  "ja/terms/index.html": {
    title: "利用規約 | SHIAGENT",
    description: "SHIAGENTの画像・SVG・PDFツールおよびワークフローをご利用いただく際の条件を定めた利用規約です。",
  },
  "terms/index.html": {
    title: "Terms of Use | SHIAGENT",
    description: "Terms governing your use of SHIAGENT's browser-based image, SVG and PDF tools and workflows.",
  },
  "ja/privacy/index.html": {
    title: "プライバシーポリシー | SHIAGENT",
    description: "SHIAGENTにおける画像・PDF等のローカル処理、ブラウザ内ストレージ、アクセスログなどの情報の取扱いを説明します。",
  },
  "privacy/index.html": {
    title: "Privacy Policy | SHIAGENT",
    description: "How SHIAGENT handles local file processing, browser storage, server logs and related information.",
  },
  "ja/index.html": {
    title: "無料の画像・SVG・PDFツール｜ブラウザで一括処理 | SHIAGENT",
    description: "画像圧縮、HEIC・WebP変換、リサイズ、トリミング、SVG変換、PDF結合・分割を無料で一括処理。ファイルをアップロードせず、ブラウザ内で安全に使えます。",
  },
  "index.html": {
    title: "Free Image, SVG & PDF Tools — Private Batch Processing | SHIAGENT",
    description: "Compress, convert, resize and crop images; edit SVGs; and merge or split PDFs for free. Files stay on your device with private, in-browser batch processing.",
  },
  "ja/tools/index.html": {
    title: "ツール・ワークフロー一覧 | シアゲント",
    description: "シアゲントで使える画像・SVG・PDF・ファイルツールと、ブラウザで完結するワークフローを一覧から探せます。",
  },
  "tools/index.html": {
    title: "All Tools & Workflows | SHIAGENT",
    description: "Browse every SHIAGENT image, SVG, PDF and file tool, plus complete browser-based workflows in one catalog.",
  },
  "ja/use-cases/index.html": {
    title: "目的から選ぶツール一覧 | シアゲント",
    description: "画像を軽くする、SVGに変換する、背景を透明にするなど、目的からシアゲントのツールを選べる用途別一覧です。",
  },
  "use-cases/index.html": {
    title: "Find a Tool by Use Case | SHIAGENT",
    description: "Find the right SHIAGENT tool for compressing images, creating SVGs, removing backgrounds and other common creative tasks.",
  },
  "ja/image-compressor/index.html": {
    description: "PNG・JPEG（JPG）・WebP画像を自動判別し、画質を保ちながら容量を一括圧縮。無料・アップロード不要・枚数制限なしでブラウザ内処理できます。",
    lead: "PNG・JPEG（JPG）・WebPを自動判別し、画質を保ちながら画像容量を削減。<br>複数画像もアップロードせず、ブラウザ内でまとめて圧縮します。",
  },
  "ja/image-converter/index.html": {
    title: "HEICをJPG・PNG・WebPに変換｜画像形式を一括変換 | SHIAGENT",
    description: "iPhoneのHEIC・HEIFをJPGへ変換。PNG、JPEG、WebP、AVIF、GIF、BMP、TIFFも追加でき、選択したPNG・JPEG・WebP形式へ無料で一括変換できます。",
    lead: "iPhoneのHEIC・HEIFやPNG・JPEG・WebPなどをまとめて追加。<br>すべての画像を、選んだPNG・JPEG（JPG）・WebP形式へ一括変換します。",
  },
  "ja/image-resizer/index.html": {
    title: "画像リサイズ｜ピクセル・比率指定で一括サイズ変更 | SHIAGENT",
    description: "PNG・JPEG・WebP・HEIC画像を、任意の縦横pxまたは元画像の％で一括リサイズ。縦横比を維持して指定範囲へ収める無料の画像サイズ変更ツールです。",
    lead: "画像の幅・高さをピクセル指定、または元サイズに対する％で変更。<br>縦横比を維持した縮小・拡大も、複数画像へまとめて適用できます。",
  },
  "ja/image-cropper/index.html": {
    title: "画像トリミング｜余白を自動削除・一括切り抜き | SHIAGENT",
    description: "画像を手動トリミング、または白・透明背景の余白を自動削除。余白、キャンバスサイズ、対象物の占有率まで複数画像で一括統一できます。",
    lead: "画像の手動切り抜き、白・透明余白の自動トリミング、Canvas規格の統一に対応。<br>大量の画像も同じ範囲・余白・対象物サイズへまとめて整えます。",
  },
  "ja/canvas-padding/index.html": {
    title: "画像に余白を追加｜キャンバスサイズを一括調整 | SHIAGENT",
    description: "画像の上下左右へpx・％で余白を追加し、512×512など指定キャンバスの中央へ配置。透明・白・黒・任意色の背景で複数画像を一括処理できます。",
    lead: "画像の上下左右に余白を追加し、指定キャンバスの中央へ配置。<br>透明・白・任意色の背景で、複数画像を同じサイズと余白へ統一します。",
  },
  "ja/image-joiner/index.html": {
    title: "画像結合｜複数画像を横・縦・グリッドで1枚に | SHIAGENT",
    description: "複数画像を横並び・縦並び・グリッドで1枚に結合。画像の順番、間隔、背景色を調整し、ブラウザ内でアップロードせずに作成できます。",
    lead: "複数画像を横並び、縦並び、グリッド配置で1枚に結合。<br>順番や間隔を確認しながら、比較画像やコラージュをブラウザ内で作れます。",
  },
  "ja/metadata-cleaner/index.html": {
    title: "EXIF・画像メタデータ削除｜GPS情報を一括消去 | SHIAGENT",
    description: "PNG・JPEG・WebPからEXIF、GPS位置情報、撮影日時、カメラ情報、XMP、IPTCを一括削除。再圧縮せず画質を維持し、ブラウザ内で安全に保存できます。",
    lead: "EXIF、GPS位置情報、撮影日時、カメラ情報などを複数画像から一括削除。<br>画像を再圧縮せず、画質を変えないままプライバシー情報を消去します。",
  },
  "ja/image-to-svg/index.html": {
    title: "画像をSVGに変換｜PNG・JPEG・WebPをベクター化 | SHIAGENT",
    description: "PNG・JPEG・WebPの線画、ロゴ、アイコンを編集可能なSVGへ変換。複数素材の自動分割、トレース品質調整、一括保存に対応した無料ベクター化ツールです。",
    lead: "PNG・JPEG・WebPの線画、ロゴ、アイコンを編集しやすいSVGへベクター化。<br>1画像ずつの変換にも、複数イラストの自動分割にも対応します。",
  },
  "ja/svg-to-image/index.html": {
    title: "SVGをPNG・WebPに変換｜サイズ・背景を一括指定 | SHIAGENT",
    description: "複数SVGをPNG・WebPへ一括変換。倍率、幅、高さ、DPI相当、透明背景・白背景・任意色を指定し、高解像度画像としてブラウザ内で保存できます。",
    lead: "SVGを希望のサイズ・倍率・背景でPNGまたはWebPへ変換。<br>複数のSVGも同じ設定でまとめて高解像度画像にラスタライズできます。",
  },
  "ja/color-tool/index.html": {
    title: "画像・SVGの色置換｜白を透明・白黒化を一括処理 | SHIAGENT",
    description: "PNG・JPEG・WebP・SVGの指定色を置換し、白背景の透明化、グレースケール、白黒2値化を一括処理。色の許容範囲も調整できます。",
    lead: "白を透明にする、黒を別色へ置き換える、画像全体を白黒化。<br>色の許容範囲を調整し、線画やSVG素材を同じルールで一括処理します。",
  },
  "ja/favicon-generator/index.html": {
    title: "Favicon・アプリアイコン作成｜ICO・PWAを一括生成 | SHIAGENT",
    description: "1枚の画像・SVGからfavicon.ico、16・32・48px PNG、Apple Touch Icon、PWA・maskableアイコン、manifestを無料で一括生成できます。",
    lead: "1枚の画像またはSVGから、WebサイトとPWA用のアイコン一式を自動作成。<br>favicon.ico、Apple Touch Icon、maskable icon、manifestまでまとめて生成します。",
  },
  "ja/image-splitter/index.html": {
    title: "画像分割｜1枚の画像から複数イラストを自動切り出し | SHIAGENT",
    description: "1枚のPNG・JPGに並んだイラスト、スタンプ、スプライトを余白から自動検出して個別画像へ分割。切り出したPNGを個別またはZIPで保存できます。",
    lead: "1枚に並んだ複数のイラストやスタンプを、白い余白から自動検出して分割。<br>切り出したPNGは個別保存またはZIPでまとめてダウンロードできます。",
  },
  "ja/background-remover/index.html": {
    title: "画像背景を透明化・背景色を変更｜一括背景削除 | SHIAGENT",
    description: "PNG・JPEG・WebP・HEIC画像の白・単色背景を透明化し、白・黒・任意色へ置換。複数画像をアップロードせずブラウザ内で一括処理できます。",
    lead: "画像の白背景・単色背景を透明化し、必要なら白・黒・好きな色へ変更。<br>PNG・JPEG・WebP・HEICもブラウザ内でまとめて背景処理できます。",
  },
  "ja/batch-rename/index.html": {
    title: "ファイル名を一括変更｜連番でまとめてリネーム | SHIAGENT",
    description: "画像、PDF、文書、音声、動画などのファイル名を連番で一括変更。接頭辞、開始番号、桁数、区切り文字を指定し、拡張子を維持して保存できます。",
    lead: "画像、PDF、文書、音声、動画などのファイル名をルールと連番で一括変更。<br>元の拡張子とファイル内容は変えず、整理した名前でまとめて保存します。",
  },
  "ja/svg-cleaner/index.html": {
    title: "SVG最適化・軽量化｜メタデータと不要コードを削除 | SHIAGENT",
    description: "SVGの見た目を維持しながら、メタデータ、コメント、編集ソフト固有属性、余分な小数精度・空白を削除。複数SVGをブラウザ内で整理・軽量化できます。",
    lead: "SVGの見た目を変えずに、メタデータや編集ソフト固有情報、不要なコードを整理。<br>複数のSVGをまとめて読みやすく軽量なファイルへ最適化します。",
  },
  "ja/svg-white-fill/index.html": {
    title: "SVGを白塗り｜線画の閉じた領域を自動塗りつぶし | SHIAGENT",
    description: "SVG線画の閉じた領域を自動検出し、線の背面へ白いfillパスを追加。素材を重ねたときの透けを防ぎ、複数SVGをブラウザ内で一括処理できます。",
    lead: "SVG線画の閉じた領域を検出し、白いfillを線の背面へ自動追加。<br>素材を重ねたときに奥の線が透けにくい、扱いやすいSVGへ整えます。",
  },
  "ja/svg-white-fill/editor/index.html": {
    description: "SVG線画の隙間をガイド線で閉じ、白塗りから除外する領域をクリックで手動調整。変更をリアルタイムで確認できるブラウザ内SVGフィルエディターです。",
  },
  "ja/pdf/merge/index.html": {
    description: "複数のPDFを1つに結合。ページのサムネイルを確認し、ドラッグで並べ替えてから保存できます。アップロード不要でブラウザ内処理します。",
  },
  "ja/pdf/split/index.html": {
    description: "PDFを指定したページ範囲で分割・抽出、または1ページずつ別ファイルとして保存。アップロード不要でブラウザ内処理できます。",
  },
  "ja/pdf/reorder/index.html": {
    description: "PDFページをサムネイルで確認しながらドラッグで並べ替え。ページの複製や逆順化にも対応し、画質を変えずブラウザ内で保存できます。",
  },
  "ja/pdf/interleave/index.html": {
    description: "2つ以上のPDFからページを交互に並べて結合。奇数・偶数ページを別々にスキャンした両面原稿を、正しいページ順のPDFへまとめられます。",
  },
  "ja/pdf/delete-pages/index.html": {
    description: "PDFの不要ページをサムネイルで確認しながら削除。残すページを並べ替え、整理したPDFをアップロードせずブラウザ内で保存できます。",
  },
  "ja/pdf/images-to-pdf/index.html": {
    description: "PNG・JPEG・WebP画像を好きな順番へ並べ替えて1つのPDFに変換。複数画像をアップロードせず、安全にブラウザ内でまとめられます。",
  },
};

async function htmlFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".agents", ".codex", ".git", ".vscode", "assets", "dist", "node_modules", "pages", "public", "scripts", "src", "test", "tmp"].includes(entry.name)) continue;
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(new URL(`${entry.name}/`, directory), relative));
    else if (entry.name === "index.html") files.push(relative);
  }
  return files;
}

function replaceElement(source, pattern, replacement, file) {
  if (!pattern.test(source)) throw new Error(`Expected SEO element was not found in ${file}`);
  return source.replace(pattern, replacement);
}

function legalFooter(file) {
  const ja = file.startsWith("ja/");
  return ja
    ? `<footer><div class="footer-intro"><a class="brand footer-brand" href="/ja/">${brandMark}<span>SHIAGENT</span></a><p>つくる。整える。仕上げる。</p></div><div class="footer-groups"><details class="footer-group"><summary>SHIAGENTについて</summary><div class="footer-links"><a href="/ja/about/">このサイトについて</a><a href="/ja/specifications/">対応環境</a><a href="/ja/local-processing/">ローカル処理</a><a href="/ja/changelog/">更新履歴</a><a href="/ja/examples/">事例</a><a href="/ja/accessibility/">アクセシビリティ</a></div></details><details class="footer-group"><summary>サポート</summary><div class="footer-links"><a href="/ja/faq/">FAQ</a><a href="/ja/status/">障害・既知の問題</a><a href="/ja/feedback/">フィードバック</a><a href="/ja/contact/">お問い合わせ</a></div></details><details class="footer-group"><summary>リーガル</summary><div class="footer-links"><a href="/ja/terms/">利用規約</a><a href="/ja/privacy/">プライバシーポリシー</a></div></details></div><small>© 2026 SHIAGENT</small></footer>`
    : `<footer><div class="footer-intro"><a class="brand footer-brand" href="/">${brandMark}<span>SHIAGENT</span></a><p>Generate. Refine. Finish.</p></div><div class="footer-groups"><details class="footer-group"><summary>About SHIAGENT</summary><div class="footer-links"><a href="/about/">About</a><a href="/specifications/">Compatibility</a><a href="/local-processing/">Local processing</a><a href="/changelog/">Changelog</a><a href="/examples/">Examples</a><a href="/accessibility/">Accessibility</a></div></details><details class="footer-group"><summary>Support</summary><div class="footer-links"><a href="/faq/">FAQ</a><a href="/status/">Status</a><a href="/feedback/">Feedback</a><a href="/contact/">Contact</a></div></details><details class="footer-group"><summary>Legal</summary><div class="footer-links"><a href="/terms/">Terms</a><a href="/privacy/">Privacy</a></div></details></div><small>© 2026 SHIAGENT</small></footer>`;
}

const toolExamples = {
  "image-compressor": ["例：Web掲載前のPNG・JPEG・WebPをAutoでまとめて圧縮し、前後容量を確認してZIP保存します。", "Example: compress PNG, JPEG and WebP files in Auto mode, compare sizes, then save a ZIP."],
  "image-converter": ["例：iPhoneのHEIC写真を追加し、JPEGを選んでWeb掲載用ファイルへ一括変換します。", "Example: add iPhone HEIC photos and batch-convert them to JPEG for the web."],
  "image-resizer": ["例：商品画像を長辺1200px・縦横比維持で揃え、WebPとして保存します。", "Example: fit product images within 1200 px, preserve aspect ratio and export WebP."],
  "image-cropper": ["例：白背景の商品画像をAuto Trimし、対象物の周囲に同じ余白を残します。", "Example: Auto Trim white product photos and keep consistent space around each object."],
  "canvas-padding": ["例：複数の素材を512×512の透明Canvas中央へ配置し、同じ余白へ揃えます。", "Example: center multiple assets on transparent 512×512 canvases with equal padding."],
  "image-joiner": ["例：2枚の比較画像を横並びにし、間隔16px・白背景の1枚画像として保存します。", "Example: place two comparison images side by side with a 16 px white gap."],
  "metadata-cleaner": ["例：公開前のJPEGからEXIF・GPSを削除し、画素を再圧縮せず保存します。", "Example: remove EXIF and GPS from JPEGs before publishing without re-encoding pixels."],
  "image-to-svg": ["例：白背景の線画PNGを1024サイズでトレースし、編集可能なSVGとして保存します。", "Example: trace a white-background line drawing at size 1024 and save editable SVG."],
  "svg-to-image": ["例：SVGロゴを幅2048px・透明背景のPNGへまとめて変換します。", "Example: batch-render SVG logos as 2048 px transparent PNG files."],
  "color-tool": ["例：線画の白背景を透明化し、黒線はそのままPNGで保存します。", "Example: make a line drawing's white background transparent while keeping black lines."],
  "favicon-generator": ["例：正方形ロゴ1枚からfavicon.ico、Apple Touch Icon、PWA一式をZIP生成します。", "Example: create favicon.ico, Apple Touch Icon and a PWA icon set from one square logo."],
  "image-splitter": ["例：4つのスタンプが並ぶ1枚画像を余白で検出し、4枚のPNGへ分割します。", "Example: detect whitespace in a four-sticker sheet and split it into four PNG files."],
  "background-remover": ["例：単色背景の商品画像を透明PNGへ変換し、境界の柔らかさを調整します。", "Example: remove a solid product-photo background and tune the edge softness."],
  "batch-rename": ["例：20枚の画像をworksheet-001からの連番へ変更し、ZIPで保存します。", "Example: rename 20 images from worksheet-001 onward and save them as a ZIP."],
  "svg-white-fill": ["例：線画SVGの閉領域へ白い背面パスを追加し、重ねたときの透けを防ぎます。", "Example: add white backing paths to closed SVG regions so artwork below does not show through."],
  "svg-white-fill/editor": ["例：自動白塗りで漏れた隙間を補助線で閉じ、不要な領域を除外して保存します。", "Example: close a missed gap, exclude an unwanted region and save the corrected SVG."],
  "svg-cleaner": ["例：編集ソフトから書き出したSVGのメタデータと不要属性を除去して軽量化します。", "Example: remove editor metadata and redundant attributes from exported SVG files."],
  "pdf/merge": ["例：3つのPDFを追加し、サムネイルで順番を確認して1つに結合します。", "Example: add three PDFs, verify thumbnail order and merge them into one file."],
  "pdf/split": ["例：50ページのPDFから1-5、12、30-35ページを指定して別PDFへ抽出します。", "Example: extract pages 1–5, 12 and 30–35 from a 50-page PDF."],
  "pdf/reorder": ["例：スキャンPDFのページをドラッグで正しい順番へ並べ直して保存します。", "Example: drag scanned PDF pages into the correct order and save a new file."],
  "pdf/interleave": ["例：奇数面と偶数面を別々にスキャンした2つのPDFを交互に結合します。", "Example: interleave separate front-side and back-side scan PDFs."],
  "pdf/rotate": ["例：横向き・逆さまのページを自動判定し、必要なページだけ手動で微調整します。", "Example: auto-detect sideways pages, then manually correct only uncertain pages."],
  "pdf/delete-pages": ["例：末尾の空白ページと不要な表紙を削除し、残りを1つのPDFで保存します。", "Example: remove a blank final page and unwanted cover, then save the remaining PDF."],
  "pdf/images-to-pdf": ["例：12枚のJPEGを名前順に並べ、1つのPDF資料へまとめます。", "Example: arrange 12 JPEGs by name and bind them into one PDF."],
  "pdf/sort-by-page-number": ["例：複数のスキャンPDFから外周のページ番号を検出し、番号順へ復元します。", "Example: detect edge page numbers across scanned PDFs and restore document order."],
  "workflows/web-image-optimizer": ["例：スマホ写真をブログ用プリセットで縮小・WebP化・圧縮・連番化します。", "Example: resize phone photos with the Blog preset, convert to WebP, compress and number them."],
  "workflows/line-art-to-svg": ["例：スキャン線画をトリミングし、SVG化・白塗り・クリーニングまで一括実行します。", "Example: trim scanned line art, vectorize it, add white fill and clean the SVG."],
  "workflows/ai-asset-prep": ["例：AI生成画像20枚を正方形へ揃え、連番名とWeb向け容量へ一括調整します。", "Example: normalize 20 generated images to square canvases, numbered names and web-ready sizes."],
  "workflows/asset-normalizer": ["例：寸法の違う素材を同じCanvas・占有率・背景・ファイル名へ統一します。", "Example: standardize mixed assets to one canvas, occupancy, background and naming rule."],
  "workflows/custom": ["例：Auto Trim→リサイズ→WebP変換→連番化を自分用ワークフローとして保存します。", "Example: save Auto Trim → Resize → WebP → Rename as a reusable workflow."],
};

function installToolExample(source, contract, ja) {
  source = source.replace(/<section class="content-section tool-example" data-site-example>[\s\S]*?<\/section>/g, "");
  if (!contract || contract.status !== "active") return source;
  const example = toolExamples[contract.route]?.[ja ? 0 : 1];
  if (!example) return source;
  const section = `<section class="content-section tool-example" data-site-example><div><div class="section-kicker">${ja ? "使用例" : "Example"}</div><h2>${ja ? "たとえば、こんな処理。" : "One practical use."}</h2><p>${example}</p></div></section>`;
  // The manual fill editor's <main> is the full-height interactive workspace.
  // Keep supporting content outside it so rebuilding metadata cannot shrink
  // the canvas area again.
  if (contract.route === "svg-white-fill/editor") {
    return source.replace("</main>", `</main>${section}`);
  }
  return source.replace("</main>", `${section}</main>`);
}

const sitemapPages = [];
const catalogPages = new Map();

function routeFromFile(file) {
  return file.replace(/^ja\//, "").replace(/\/?index\.html$/, "").replace(/\/$/, "");
}

function textContent(value = "") {
  return value.replace(/<[^>]*>/g, " ").replaceAll("&amp;", "&").replaceAll("&nbsp;", " ").replace(/\s+/g, " ").trim();
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? null;
}

function hasAttribute(tag, name) {
  return new RegExp(`\\b${name}(?:\\s|=|>|$)`, "i").test(tag);
}

function selectorForId(source, ids) {
  return ids.find(id => new RegExp(`\\bid="${id}"`).test(source)) ? `#${ids.find(id => new RegExp(`\\bid="${id}"`).test(source))}` : null;
}

function discoverControls(page) {
  // The shared site header (search box) is not a tool setting.
  const source = page.replace(/<header class="site-header">[\s\S]*?<\/header>/, "");
  const tags = [
    ...source.matchAll(/<input\b[^>]*>/gi),
    ...source.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi),
    ...source.matchAll(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi),
  ].sort((a, b) => a.index - b.index);
  return tags.map(match => {
    const tag = match[0];
    const element = tag.match(/^<(input|select|textarea)\b/i)?.[1].toLowerCase();
    const type = element === "input" ? (attribute(tag, "type") || "text") : element;
    if (type === "file" || type === "hidden") return null;
    const id = attribute(tag, "id");
    const name = attribute(tag, "name");
    const inputValue = attribute(tag.match(/^<[^>]*>/)?.[0] || tag, "value");
    const selector = id
      ? `#${id}`
      : name && type === "radio" && inputValue !== null
        ? `input[name="${name}"][value="${inputValue}"]`
        : null;
    if (!selector) return null;
    const control = { selector, element, type };
    const openingTag = tag.match(/^<[^>]*>/)?.[0] || tag;
    for (const key of ["min", "max", "step", "value"]) {
      const value = attribute(openingTag, key);
      if (value !== null) control[key] = value;
    }
    if (element === "select") {
      const options = [...tag.matchAll(/<option\b[^>]*value="([^"]*)"[^>]*>/gi)];
      control.values = options.map(option => option[1]);
      const selected = options.find(option => hasAttribute(option[0], "selected"));
      if (selected) control.value = selected[1];
      else if (control.values.length) control.value = control.values[0];
    }
    if (type === "checkbox" || type === "radio") control.checked = hasAttribute(openingTag, "checked");
    return control;
  }).filter(Boolean);
}

function pageContract(file, source) {
  const route = routeFromFile(file);
  if (excludedRoutes.has(route)) return null;
  const override = routeOverrides[route] || {};
  const pdf = pdfContract(route) || {};
  const fileTag = source.match(/<input\b[^>]*type="file"[^>]*>/i)?.[0]
    || source.match(/<input\b[^>]*id="fileInput"[^>]*>/i)?.[0];
  const fileId = fileTag ? attribute(fileTag, "id") : null;
  const input = override.input !== undefined ? override.input : (pdf.input || (fileId ? `#${fileId}` : null));
  const action = override.action !== undefined ? override.action : (pdf.action || selectorForId(source, primaryActionIds));
  const download = override.download !== undefined ? override.download : (pdf.download || selectorForId(source, ["downloadAllButton", "downloadButton"]));
  const result = override.result !== undefined ? override.result : (pdf.result || selectorForId(source, ["resultsPanel", "resultPanel", "sourcePanel"]));
  const status = override.statusSelector !== undefined ? override.statusSelector : (pdf.status || selectorForId(source, ["resultStatus", "progressText", "builderStatus", "fileStatus", "status"]));
  if (!input && !action && route !== "line-art-generator") return null;
  return {
    id: route.replaceAll("/", "-"),
    route,
    status: override.status || "active",
    category: inferCategory(route),
    localProcessing: true,
    accepts: (override.accept || pdf.accept || attribute(fileTag || "", "accept") || "").split(",").map(value => value.trim()).filter(Boolean),
    outputs: override.outputs || inferOutput(route),
    automation: {
      input,
      action,
      result,
      download,
      status,
      controls: override.controls || pdf.controls || discoverControls(source),
      events: {
        ready: "shiagent:ready",
        state: "shiagent:statechange",
        outputs: "shiagent:outputs",
        tray: "shiagent:traychange",
        error: "shiagent:error",
      },
    },
  };
}

for (const file of await htmlFiles(root)) {
  const url = new URL(file, root);
  let source = await readFile(url, "utf8");
  const copy = pageCopy[file];

  if (copy?.title) {
    source = replaceElement(source, /<title>[\s\S]*?<\/title>/, `<title>${copy.title}</title>`, file);
  }
  if (copy?.description) {
    source = replaceElement(
      source,
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${copy.description}">`,
      file,
    );
  }
  if (copy?.lead) {
    source = replaceElement(source, /<p class="lead">[\s\S]*?<\/p>/, `<p class="lead">${copy.lead}</p>`, file);
  }

  const title = source.match(/<title>([\s\S]*?)<\/title>/)?.[1];
  const description = source.match(/<meta name="description" content="([^"]*)">/)?.[1];
  if (!title || !description) continue;

  source = source.replace(/(<link rel="canonical" href=")([^"]+)(">)/, (_, before, href, after) => {
    return `${before}${new URL(href, siteOrigin).href}${after}`;
  });
  source = source.replace(/(<link rel="alternate" hreflang="[^"]+" href=")([^"]+)(">)/g, (_, before, href, after) => {
    return `${before}${new URL(href, siteOrigin).href}${after}`;
  });
  const canonical = source.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  if (!canonical) throw new Error(`Canonical URL was not found in ${file}`);

  source = source.replace(/<meta property="og:(?:site_name|type|locale|title|description|url)"[^>]*>\s*/g, "");
  source = source.replace(/<meta name="twitter:(?:card|title|description)"[^>]*>\s*/g, "");
  source = source.replace(/<meta name="robots"[^>]*>\s*/g, "");
  const locale = file.startsWith("ja/") ? "ja_JP" : "en_US";
  const robots = noindexPages.has(file)
    ? "noindex,follow"
    : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
  const social = [
    `<meta name="robots" content="${robots}">`,
    '<meta property="og:site_name" content="SHIAGENT">',
    '<meta property="og:type" content="website">',
    `<meta property="og:locale" content="${locale}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
  ].join("");
  source = source.replace(/(<meta name="description" content="[^"]*">)/, `$1${social}`);

  source = source.replace(/<script type="application\/ld\+json" data-seo="website">[\s\S]*?<\/script>/g, "");
  source = source.replace(/<script type="application\/ld\+json" data-seo="software-application">[\s\S]*?<\/script>/g, "");
  source = source.replace(/<link rel="manifest" href="\/site\.webmanifest">\s*/g, "");
  source = source.replace(/<link rel="alternate" type="application\/json" href="\/ai\/tools\.json"[^>]*>\s*/g, "");
  source = source.replace(/<link rel="help" href="\/llms\.txt">\s*/g, "");
  source = source.replace(/<link rel="stylesheet" href="\/assets\/css\/information\.css">\s*/g, "");
  source = source.replace(/<script type="module" src="\/assets\/js\/agent-bridge\.js"[^>]*><\/script>\s*/g, "");
  source = source.replace(/<script type="module" src="\/assets\/js\/site-observability\.js"[^>]*><\/script>\s*/g, "");
  source = source.replace(/<script type="module" src="\/assets\/js\/analytics\.js"[^>]*><\/script>\s*/g, "");
  source = source.replace(/<script type="module" src="\/assets\/js\/site-search\.js"[^>]*><\/script>\s*/g, "");
  source = source.replace(/<script type="module" src="\/assets\/js\/mobile-nav\.js"[^>]*><\/script>\s*/g, "");
  source = source.replace(/<meta name="(?:google-site-verification|msvalidate\.01)"[^>]*>\s*/g, "");
  source = source.replace(/<link [^>]*data-brand-icon[^>]*>\s*/g, "");
  const machineLinks = [
    '<link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml" data-brand-icon>',
    '<link rel="icon" href="/assets/brand/favicon-32.png" sizes="32x32" type="image/png" data-brand-icon>',
    '<link rel="icon" href="/assets/brand/favicon-16.png" sizes="16x16" type="image/png" data-brand-icon>',
    '<link rel="shortcut icon" href="/assets/brand/favicon.ico" data-brand-icon>',
    '<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png" sizes="180x180" data-brand-icon>',
    '<link rel="manifest" href="/site.webmanifest">',
    '<link rel="alternate" type="application/json" href="/ai/tools.json" title="SHIAGENT tool catalog">',
    '<link rel="help" href="/llms.txt">',
    '<link rel="stylesheet" href="/assets/css/information.css">',
    '<script type="module" src="/assets/js/site-observability.js"></script>',
    '<script type="module" src="/assets/js/analytics.js"></script>',
    '<script type="module" src="/assets/js/site-search.js"></script>',
    '<script type="module" src="/assets/js/mobile-nav.js"></script>',
    '<script type="module" src="/assets/js/agent-bridge.js" data-agent-bridge></script>',
  ].join("");
  source = source.replace("</head>", `${machineLinks}</head>`);
  source = source.replace(
    /(<header class="site-header">[\s\S]*?<a class="brand"[^>]*>)(?!<img class="brand-mark")/,
    `$1${brandMark}`,
  );
  source = source.replace(/<button class="menu-toggle"[\s\S]*?<\/button>/, "");
  source = source.replace(/<nav id="siteNavigation"/, "<nav");
  const menuLabel = file.startsWith("ja/") ? "メニューを開く" : "Open menu";
  const menuButton = `<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="siteNavigation" aria-label="${menuLabel}"><span></span><span></span><span></span></button>`;
  source = source.replace(
    /(<header class="site-header">[\s\S]*?<a class="brand"[\s\S]*?<\/a>)(<nav\s)/,
    `$1${menuButton}$2id="siteNavigation" `,
  );

  if (["index.html", "ja/index.html"].includes(file)) {
    const verification = [
      googleVerification ? `<meta name="google-site-verification" content="${googleVerification}">` : "",
      bingVerification ? `<meta name="msvalidate.01" content="${bingVerification}">` : "",
    ].join("");
    source = source.replace("</head>", `${verification}</head>`);
  }

  const contract = pageContract(file, source);
  source = installToolExample(source, contract, file.startsWith("ja/"));
  if (contract) {
    const locale = file.startsWith("ja/") ? "ja" : "en";
    const heading = textContent(source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || textContent(title.replace(/\s*[|—].*$/, ""));
    const softwareData = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: heading,
      ...(locale === "ja" ? { alternateName: contract.route.split("/").at(-1).split("-").map(word => word[0].toUpperCase() + word.slice(1)).join(" ") } : {}),
      description,
      url: canonical,
      applicationCategory: contract.category,
      operatingSystem: "Any",
      browserRequirements: "Requires a modern web browser with JavaScript enabled",
      inLanguage: locale,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: ["On-device processing", "No file upload", "Browser-based processing"],
    });
    source = source.replace("</head>", `<script type="application/ld+json" data-seo="software-application">${softwareData}</script></head>`);
    const entry = catalogPages.get(contract.route) || { ...contract, name: {}, description: {}, paths: {} };
    entry.name[locale] = heading;
    entry.description[locale] = description;
    entry.paths[locale] = new URL(canonical).pathname;
    catalogPages.set(contract.route, entry);
  }
  if (file === "index.html") {
    const websiteData = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "SHIAGENT",
      alternateName: ["シアゲント", "shiagent.com"],
      url: `${siteOrigin}/`,
    });
    source = source.replace("</head>", `<script type="application/ld+json" data-seo="website">${websiteData}</script></head>`);
  }

  if (file === "ja/image-compressor/index.html") {
    source = source
      .replace('<a href="#"><span>IMAGE</span><h3>Image Resizer</h3>', '<a href="/ja/image-resizer/"><span>IMAGE</span><h3>画像リサイズ</h3>')
      .replace('<a href="#"><span>IMAGE</span><h3>Line Art Cleaner</h3><p>線画のゴミやグレーを除去</p>', '<a href="/ja/color-tool/"><span>IMAGE</span><h3>色置換・白黒化</h3><p>線画を白黒化・透明化する</p>')
      .replace('<a href="#">プライバシー</a>', '<a href="/ja/#local-first">プライバシー</a>');
  }
  if (file === "image-compressor/index.html") {
    source = source
      .replace('<a href="#"><span>IMAGE</span><h3>Image Resizer</h3>', '<a href="/image-resizer/"><span>IMAGE</span><h3>Image Resizer</h3>')
      .replace('<a href="#"><span>IMAGE</span><h3>Line Art Cleaner</h3><p>Remove dust and gray from line art</p>', '<a href="/color-tool/"><span>IMAGE</span><h3>Color &amp; Monochrome</h3><p>Recolor or simplify line art</p>')
      .replace('<a href="#">Privacy</a>', '<a href="/#local-first">Privacy</a>');
  }

  if (/<main\b(?![^>]*\bid=)/i.test(source)) source = source.replace(/<main\b/i, '<main id="main-content"');
  if (!/class="skip-link"/.test(source)) {
    source = source.replace(/<body([^>]*)>/i, `<body$1><a class="skip-link" href="#main-content">${file.startsWith("ja/") ? "本文へ移動" : "Skip to content"}</a>`);
  }

  const footer = legalFooter(file);
  if (/<footer(?:\s[^>]*)?>[\s\S]*?<\/footer>/.test(source)) {
    source = source.replace(/<footer(?:\s[^>]*)?>[\s\S]*?<\/footer>/, footer);
  } else {
    source = source.replace("</body>", `${footer}</body>`);
  }

  await writeFile(url, source);
  if (!noindexPages.has(file)) {
    sitemapPages.push({
      canonical,
      alternates: [...source.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
        .map(([, lang, href]) => ({ lang, href })),
    });
  }
}

const xmlEscape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...sitemapPages
    .sort((a, b) => a.canonical.localeCompare(b.canonical))
    .map(({ canonical, alternates }) => [
      "  <url>",
      `    <loc>${xmlEscape(canonical)}</loc>`,
      ...alternates.map(({ lang, href }) => `    <xhtml:link rel="alternate" hreflang="${xmlEscape(lang)}" href="${xmlEscape(href)}" />`),
      "  </url>",
    ].join("\n")),
  "</urlset>",
  "",
].join("\n");
await writeFile(new URL("sitemap.xml", root), sitemap);

await writeFile(new URL("robots.txt", root), [
  "User-agent: *",
  "Allow: /",
  "Disallow: /design/",
  "Disallow: /scripts/",
  "Disallow: /src/",
  "Disallow: /test/",
  "Disallow: /tmp/",
  "",
  "User-agent: OAI-SearchBot",
  "Allow: /",
  "",
  "User-agent: GPTBot",
  "Allow: /",
  "",
  `Sitemap: ${siteOrigin}/sitemap.xml`,
  "",
].join("\n"));

const tools = [...catalogPages.values()].sort((a, b) => a.id.localeCompare(b.id));
await writeFile(new URL("ai/tools.json", root), `${JSON.stringify({
  schema: `${siteOrigin}/ai/tools.schema.json`,
  version: "1.0",
  site: { name: "SHIAGENT", origin: siteOrigin, privacy: "Files are processed on the user's device and are not uploaded." },
  browserApi: { global: "window.SHIAGENT", documentation: `${siteOrigin}/llms-full.txt` },
  tools,
}, null, 2)}\n`);

await writeFile(new URL("llms.txt", root), [
  "# SHIAGENT",
  "",
  "> Private, browser-based tools for images, SVG, and PDF. Files are processed on the user's device and are not uploaded.",
  "",
  "## Machine-readable resources",
  `- [Tool catalog](${siteOrigin}/ai/tools.json): Routes, accepted formats, outputs, stable selectors, and browser events.`,
  `- [Automation guide](${siteOrigin}/llms-full.txt): Browser-agent usage and cross-tool workflow contract.`,
  `- [Catalog schema](${siteOrigin}/ai/tools.schema.json): JSON Schema for the tool catalog.`,
  "",
  "## Important constraints",
  "- Tools run client-side and require a JavaScript-capable browser.",
  "- Local files must be selected or attached in the browser context; there is no server upload API.",
  "- Finished files can be passed between compatible tools through the persistent Work Tray.",
  "",
].join("\n"));

await writeFile(new URL("llms-full.txt", root), [
  "# SHIAGENT browser-agent guide",
  "",
  "SHIAGENT is a local-first static web application. Do not look for a remote conversion API: operate the browser page so the user's files stay on their device.",
  "",
  "## Discovery",
  `Read ${siteOrigin}/ai/tools.json and choose an active tool whose accepts and outputs match the job. Open paths.ja or paths.en.`,
  "",
  "## Stable browser contract",
  "Every page loads window.SHIAGENT. Await window.SHIAGENT.ready before automation.",
  "- getCatalog(): returns the full tool catalog.",
  "- getContract(): returns the current tool contract.",
  "- getState(): returns input count, busy state, visible result state, status text, and the latest event.",
  "- loadFiles(File[]): attaches browser File objects and emits the same change event as human selection.",
  "- setValue(cssSelector, value): updates an option and emits input/change events.",
  "- setValues(cssSelector, values[]): updates a repeated control group in DOM order, such as detected PDF page numbers.",
  "- click(cssSelector): activates a documented secondary action, such as PDF auto-orientation.",
  "- run(): activates the primary processing action.",
  "- download(): activates the primary download action.",
  "- waitFor(eventName, timeoutMs): waits for a documented event.",
  "- navigate(toolId, {tray:true}): moves to another tool and imports compatible Work Tray files.",
  "",
  "## Recommended sequence",
  "1. Open the selected tool path and await SHIAGENT.ready.",
  "2. Attach files with the browser's file-upload capability or SHIAGENT.loadFiles when File objects are already available in page context.",
  "3. Set only controls listed in automation.controls. For controls whose action is click, call SHIAGENT.click(selector). For repeated controls, call SHIAGENT.setValues(selector, values).",
  "4. Call SHIAGENT.run(), monitor getState(), and wait for shiagent:outputs, shiagent:traychange, or a visible result.",
  "5. Validate output count and statusText before downloading or navigating onward with tray:true.",
  "6. Never claim success solely because a button was clicked.",
  "",
  "## Events",
  "shiagent:ready — catalog and current contract are available.",
  "shiagent:statechange — relevant DOM state changed.",
  "shiagent:outputs — a tool produced in-memory output files.",
  "shiagent:traychange — files were persisted to the cross-tool Work Tray; detail contains safe metadata, not file contents.",
  "shiagent:error — a tool reported an automation-visible failure.",
  "",
  "## Privacy",
  "Do not transmit input or output files to another service unless the user explicitly asks. Prefer the Work Tray for SHIAGENT-to-SHIAGENT handoffs.",
  "",
].join("\n"));

console.log(`SEO metadata refreshed for ${sitemapPages.length} pages; published ${tools.length} AI tool contracts.`);
