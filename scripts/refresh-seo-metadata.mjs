import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = new URL("../", import.meta.url);
const siteOrigin = "https://shiagent.com";
const noindexPages = new Set([
  "line-art-generator/index.html",
  "ja/line-art-generator/index.html",
]);

const pageCopy = {
  "ja/index.html": {
    title: "無料の画像・SVG・PDFツール｜ブラウザで一括処理 | SHIAGENT",
    description: "画像圧縮、HEIC・WebP変換、リサイズ、トリミング、SVG変換、PDF結合・分割を無料で一括処理。ファイルをアップロードせず、ブラウザ内で安全に使えます。",
  },
  "index.html": {
    title: "Free Image, SVG & PDF Tools — Private Batch Processing | SHIAGENT",
    description: "Compress, convert, resize and crop images; edit SVGs; and merge or split PDFs for free. Files stay on your device with private, in-browser batch processing.",
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
    if ([".git", "node_modules", "tmp"].includes(entry.name)) continue;
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

const sitemapPages = [];

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
  `Sitemap: ${siteOrigin}/sitemap.xml`,
  "",
].join("\n"));

console.log(`SEO metadata refreshed and sitemap generated for ${sitemapPages.length} pages.`);
