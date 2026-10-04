// Search catalog for the header search box (assets/js/site-search.js).
// Names and descriptions mirror the home page cards; test/site-search.test.js
// fails when a card is missing here or its name differs.
//
// keywords: words people type (tool names, features, everyday phrasing).
// combos:   every group must match somewhere in the query, e.g. 余白 + 消す.
// convert:  format conversion direction; a query that names a "from" format
//           before a "to" format ranks this entry higher, the reverse lower.
export const SEARCH_ENTRIES = [
  {
    path: "/image-compressor/", kind: "tool",
    name: { ja: "画像圧縮", en: "Image Compressor" },
    description: { ja: "PNG・JPEG・WebPを自動判別し、画質と容量を比較しながら軽量化します。", en: "Shrink PNG, JPEG and WebP files and compare quality and size before you save." },
    keywords: {
      ja: ["圧縮", "軽く", "軽量", "軽い", "容量", "重い", "ファイルサイズ", "サイズを小さく", "サイズを減", "小さくしたい", "減らしたい", "最適化", "png圧縮", "jpeg圧縮", "jpg圧縮", "webp圧縮"],
      en: ["compress", "compression", "smaller", "reduce file size", "file size", "lighter", "shrink", "optimize", "optimise", "tinypng", "kb", "mb"]
    },
    combos: [{ ja: [["容量", "サイズ", "重"], ["小さ", "減", "軽", "落と"]] }]
  },
  {
    path: "/image-converter/", kind: "tool",
    name: { ja: "画像形式変換", en: "Image Converter" },
    description: { ja: "HEICを含む主要画像形式を、PNG・JPEG・WebPへまとめて変換します。", en: "Batch-convert HEIC and other common formats to PNG, JPEG or WebP." },
    keywords: {
      ja: ["形式変換", "拡張子", "変換", "heic", "heif", "iphone", "アイフォン", "avif", "tiff", "bmp", "gif"],
      en: ["convert", "converter", "format", "extension", "heic", "heif", "iphone", "avif", "tiff", "bmp", "gif"]
    },
    convert: { from: ["heic", "heif", "avif", "gif", "bmp", "tiff", "tif", "png", "jpg", "jpeg", "webp", "写真", "photo"], to: ["png", "jpg", "jpeg", "webp"] }
  },
  {
    path: "/image-resizer/", kind: "tool",
    name: { ja: "画像リサイズ", en: "Image Resizer" },
    description: { ja: "複数画像を任意の縦横px、または元画像に対する％でまとめてリサイズします。", en: "Resize multiple images by pixel dimensions or a percentage of each original." },
    keywords: {
      ja: ["リサイズ", "縮小", "拡大", "大きさ", "サイズ変更", "寸法", "px", "ピクセル", "解像度", "幅", "高さ", "半分"],
      en: ["resize", "resizer", "scale", "dimensions", "pixels", "px", "width", "height", "enlarge", "downscale", "resolution"]
    },
    combos: [{ ja: [["サイズ", "大きさ", "幅", "高さ"], ["変え", "変更", "合わせ", "そろえ", "揃え"]] }]
  },
  {
    path: "/image-cropper/", kind: "tool",
    name: { ja: "画像トリミング", en: "Image Cropper" },
    description: { ja: "手動Crop、余白のAuto Trim、Canvasと対象物占有率の一括統一に対応します。", en: "Crop manually, auto-trim empty space, or normalize canvas size and object coverage in batches." },
    keywords: {
      ja: ["トリミング", "切り抜", "切り取", "クロップ", "トリム", "余白を消", "余白を削", "余白をなく", "余白を取", "余白をカット", "空白を消", "空白を削", "はみ出"],
      en: ["crop", "cropper", "trim", "cut out", "remove whitespace", "remove margins", "remove padding", "auto trim"]
    },
    combos: [
      { ja: [["余白", "空白", "白い部分", "まわり", "周り"], ["消", "削", "なく", "無く", "取", "カット", "詰め"]] },
      { en: [["whitespace", "white space", "margin", "padding", "border", "empty space"], ["remove", "delete", "cut", "trim", "get rid"]] }
    ]
  },
  {
    path: "/canvas-padding/", kind: "tool",
    name: { ja: "余白追加", en: "Canvas Padding" },
    description: { ja: "画像の周囲に％・px余白を足すか、指定Canvasの中央へまとめて配置します。", en: "Add percentage or pixel margins, or center images on a fixed canvas in batches." },
    keywords: {
      ja: ["余白追加", "余白を追加", "余白を足", "余白をつけ", "余白を付け", "余白を増", "中央に配置", "キャンバス", "正方形にしたい"],
      en: ["padding", "add margin", "add padding", "canvas", "center on canvas", "square"]
    },
    combos: [
      { ja: [["余白", "まわり", "周り", "ふち", "フチ"], ["追加", "足", "つけ", "付け", "増", "入れ"]] },
      { en: [["margin", "padding", "border", "space"], ["add", "increase", "more"]] }
    ]
  },
  {
    path: "/image-joiner/", kind: "tool",
    name: { ja: "画像結合", en: "Image Joiner" },
    description: { ja: "複数画像を横、縦、Gridに並べ、間隔や背景を整えて1枚にまとめます。", en: "Arrange images horizontally, vertically, or in a grid, then export them as one image." },
    keywords: {
      ja: ["画像結合", "つなげ", "繋げ", "くっつけ", "並べ", "1枚に", "一枚に", "まとめて1枚", "グリッド", "コラージュ", "横に並べ", "縦に並べ"],
      en: ["join", "joiner", "combine images", "merge images", "stitch", "collage", "grid", "side by side", "one image"]
    }
  },
  {
    path: "/metadata-cleaner/", kind: "tool",
    name: { ja: "メタデータ削除", en: "EXIF Cleaner" },
    description: { ja: "GPS、撮影日時、カメラ情報などをPNG・JPEG・WebPから画質を変えずに一括削除します。", en: "Batch-remove GPS, capture dates, camera details, and other metadata from PNG, JPEG, and WebP files." },
    keywords: {
      ja: ["メタデータ", "exif", "位置情報", "gps", "撮影日時", "撮影場所", "カメラ情報", "個人情報", "プライバシー"],
      en: ["metadata", "exif", "gps", "location", "geotag", "privacy", "camera info", "strip metadata"]
    },
    combos: [{ ja: [["位置", "場所", "情報", "exif", "gps"], ["消", "削", "なく", "取", "隠"]] }]
  },
  {
    path: "/image-to-svg/", kind: "tool",
    name: { ja: "画像 → SVG変換", en: "Image to SVG" },
    description: { ja: "PNG・JPEG・WebPの線画を自動分割し、編集できるSVGへ変換します。", en: "Vectorize PNG, JPEG and WebP line art into editable SVGs, with automatic splitting." },
    keywords: {
      ja: ["svg変換", "ベクター", "ベクトル", "ベクタ", "トレース", "線画", "パス化", "アウトライン", "svgにしたい", "svg化"],
      en: ["vectorize", "vector", "trace", "tracing", "line art", "to svg", "potrace"]
    },
    convert: { from: ["png", "jpg", "jpeg", "webp", "画像", "image", "写真", "photo", "線画"], to: ["svg", "ベクター", "ベクトル", "vector"] }
  },
  {
    path: "/svg-to-image/", kind: "tool",
    name: { ja: "SVG → 画像", en: "SVG to Image" },
    description: { ja: "倍率、縦横px、DPI相当、背景色を指定して、複数SVGをまとめて画像化します。", en: "Batch-rasterize SVGs with scale, pixel dimensions, DPI equivalent and background color." },
    keywords: {
      ja: ["svgを画像", "svgをpng", "svgをjpg", "ラスタライズ", "画像化", "png書き出し", "dpi"],
      en: ["rasterize", "svg to png", "svg to jpg", "export svg", "dpi"]
    },
    convert: { from: ["svg"], to: ["png", "jpg", "jpeg", "webp", "画像", "image"] }
  },
  {
    path: "/svg-style-editor/", kind: "tool",
    name: { ja: "SVGスタイルエディター", en: "SVG Style Editor" },
    description: { ja: "SVGのパーツを選択し、塗り色・線色・線の太さ・不透明度を変更します。", en: "Click SVG parts to change fills, stroke colors, line widths and opacity." },
    keywords: {
      ja: ["svg 色変更", "svgの色", "塗り色", "線色", "線の太さ", "ストローク", "パーツの色", "svg編集"],
      en: ["svg editor", "svg color", "change svg color", "fill", "stroke", "stroke width", "line width", "recolor svg"]
    },
    combos: [{ ja: [["svg", "パーツ", "線"], ["色", "太さ", "変更", "編集", "変え"]] }]
  },
  {
    path: "/color-tool/", kind: "tool",
    name: { ja: "色置換・白黒化・透明化", en: "Replace Color & Transparency" },
    description: { ja: "指定色の置換・透明化、Tolerance、グレースケール、2値化をまとめて処理します。", en: "Replace or remove selected colors with tolerance, or convert a batch to grayscale or black and white." },
    keywords: {
      ja: ["色置換", "色を変え", "色を変更", "白黒", "モノクロ", "グレースケール", "2値化", "二値化", "透明化", "色を透明", "特定の色"],
      en: ["replace color", "change color", "recolor", "grayscale", "greyscale", "black and white", "monochrome", "threshold", "make color transparent"]
    }
  },
  {
    path: "/favicon-generator/", kind: "tool",
    name: { ja: "Favicon・App Icon生成", en: "Favicon & App Icon Generator" },
    description: { ja: "1枚からICO、Apple Touch Icon、PWA・maskableアイコン一式を生成します。", en: "Create ICO, Apple Touch Icon, standard and maskable PWA icon packages from one image." },
    keywords: {
      ja: ["ファビコン", "favicon", "アイコン", "ico", "アプリアイコン", "apple touch icon", "pwa", "サイトのアイコン"],
      en: ["favicon", "icon", "ico", "app icon", "apple touch icon", "pwa", "maskable", "manifest"]
    },
    convert: { from: ["png", "jpg", "jpeg", "svg", "画像", "image"], to: ["ico", "favicon", "ファビコン", "アイコン", "icon"] }
  },
  {
    path: "/image-splitter/", kind: "tool",
    name: { ja: "画像分割", en: "Image Splitter" },
    description: { ja: "1枚に並んだ複数のイラストを余白で検出し、個別のPNGへ自動で切り出します。", en: "Detect illustrations separated by white space and cut them into individual PNGs." },
    keywords: {
      ja: ["画像分割", "分割", "切り分け", "バラバラ", "素材シート", "スプライト", "個別に", "1枚ずつ", "スタンプ"],
      en: ["split", "splitter", "sprite sheet", "sticker sheet", "separate", "slice", "cut into"]
    },
    combos: [{ ja: [["イラスト", "画像", "素材"], ["分け", "分割", "切り分", "バラ"]] }]
  },
  {
    path: "/background-remover/", kind: "tool",
    name: { ja: "背景削除・背景色", en: "Background Remover" },
    description: { ja: "単色の背景を透明にし、白・黒・任意の色の背景へまとめて差し替えます。", en: "Make solid backgrounds transparent, or swap them for white, black or any color." },
    keywords: {
      ja: ["背景削除", "背景を消", "背景を削", "背景を透明", "背景透過", "透過", "背景色", "背景を白", "背景を変え", "切り抜き"],
      en: ["remove background", "background remover", "transparent background", "background color", "white background", "cut out"]
    },
    combos: [
      { ja: [["背景", "うしろ", "後ろ"], ["消", "削", "透明", "透過", "白", "変え", "なく", "取"]] },
      { en: [["background"], ["remove", "delete", "transparent", "white", "change", "replace"]] }
    ]
  },
  {
    path: "/batch-rename/", kind: "tool",
    name: { ja: "一括リネーム", en: "Batch Rename" },
    description: { ja: "画像、PDF、文書、音声、動画、ZIPなど、あらゆるファイルを基本名と連番で整理します。", en: "Rename images, PDFs, documents, media, archives and other files with sequential numbers." },
    keywords: {
      ja: ["リネーム", "名前を変え", "名前変更", "ファイル名", "連番", "番号をつけ", "番号を付け", "名前をそろえ", "名前を揃え"],
      en: ["rename", "file name", "filename", "sequential", "numbering", "batch rename"]
    },
    combos: [{ ja: [["名前", "ファイル名"], ["変え", "変更", "そろえ", "揃え", "整理", "つけ", "付け"]] }]
  },
  {
    path: "/svg-white-fill/", kind: "tool",
    name: { ja: "SVG自動白塗り", en: "Automatic SVG White Fill" },
    description: { ja: "線で閉じた領域を検出し、元の線画の背面へ白いベクターパスを追加します。", en: "Find areas closed by lines and add white vector fills behind the original line art." },
    keywords: {
      ja: ["白塗り", "塗りつぶし", "白く塗", "透けない", "透ける", "閉じた領域", "白フィル"],
      en: ["white fill", "fill", "fill closed areas", "see-through", "transparent inside"]
    },
    combos: [{ ja: [["svg", "線画"], ["白", "塗"]] }]
  },
  {
    path: "/svg-cleaner/", kind: "tool",
    name: { ja: "SVGクリーナー", en: "SVG Cleaner" },
    description: { ja: "見た目を保ちながら、不要なメタデータや編集ソフト固有情報を除去します。", en: "Strip metadata and editor-specific data from SVGs without changing how they look." },
    keywords: {
      ja: ["svgクリーナー", "svgを軽く", "svg最適化", "svgの圧縮", "svgを整理", "inkscape", "illustrator", "不要なコード"],
      en: ["svg cleaner", "clean svg", "optimize svg", "minify svg", "svgo", "inkscape", "illustrator"]
    },
    combos: [{ ja: [["svg"], ["軽く", "圧縮", "整理", "きれい", "綺麗", "最適化", "小さく"]] }, { en: [["svg"], ["clean", "optimize", "minify", "smaller", "compress"]] }]
  },
  {
    path: "/svg-white-fill/editor/", kind: "tool",
    name: { ja: "SVG手動白塗り", en: "Manual SVG White Fill" },
    description: { ja: "補助線と除外指定をキャンバス上で追加し、SVGの白塗り結果を手動で調整します。", en: "Draw guide lines and exclusions on a canvas to fine-tune SVG white fills by hand." },
    keywords: {
      ja: ["手動白塗り", "白塗りを手動", "白塗りの調整", "塗り残し", "隙間を閉じ", "補助線"],
      en: ["manual white fill", "fill editor", "close gaps", "guide line"]
    }
  },
  {
    path: "/pdf/", kind: "tool",
    name: { ja: "PDFツール", en: "PDF Tools" },
    description: { ja: "PDFの整理・変換・記入・署名まで端末内で行います。", en: "Organize, convert, complete and sign PDFs in a local workspace." },
    keywords: { ja: ["pdf", "pdf編集"], en: ["pdf", "pdf editor", "pdf tools"] }
  },
  {
    path: "/pdf/merge/", kind: "tool",
    name: { ja: "PDF結合", en: "Merge PDF" },
    description: { ja: "複数のPDFをファイル順またはページ交互にまとめます。", en: "Combine PDFs in file order or by alternating pages." },
    keywords: { ja: ["pdf結合", "pdfをまとめ", "pdfを1つ", "pdfを一つ", "pdfをつなげ", "pdfを合体", "交互", "両面", "表と裏", "表面と裏面", "片面スキャン"], en: ["merge pdf", "combine pdf", "join pdf", "interleave", "alternate", "double-sided", "front and back", "duplex"] },
    combos: [{ ja: [["pdf"], ["結合", "まとめ", "1つ", "一つ", "つなげ", "繋げ", "合体", "くっつけ", "交互", "両面"]] }, { en: [["pdf"], ["merge", "combine", "join", "interleave", "alternate"]] }]
  },
  {
    path: "/pdf/split/", kind: "tool",
    name: { ja: "PDF分割", en: "Split PDF" },
    description: { ja: "PDFをページごと、または範囲ごとに分けます。", en: "Split a PDF into pages or page ranges." },
    keywords: { ja: ["pdf分割", "pdfを分け", "ページを抜き出", "ページを取り出"], en: ["split pdf", "extract pages", "separate pdf"] },
    combos: [{ ja: [["pdf"], ["分割", "分け", "抜き出", "取り出", "バラ"]] }, { en: [["pdf"], ["split", "extract", "separate"]] }]
  },
  {
    path: "/pdf/reorder/", kind: "tool",
    name: { ja: "PDFページ並べ替え", en: "Reorder PDF Pages" },
    description: { ja: "PDFのページ順を並べ替えます。", en: "Change the order of pages in a PDF." },
    keywords: { ja: ["並べ替え", "並び替え", "ページ順", "順番を変え"], en: ["reorder", "rearrange", "page order", "sort pages"] },
    combos: [{ ja: [["pdf", "ページ"], ["並べ替", "並び替", "順番", "入れ替"]] }]
  },
  {
    path: "/pdf/rotate/", kind: "tool",
    name: { ja: "PDFの向きを自動判定・回転", en: "Auto Rotate PDF Pages" },
    description: { ja: "ページの向きを判定して回転します。", en: "Detect page orientation and rotate pages." },
    keywords: { ja: ["回転", "向き", "横向き", "逆さ", "さかさま"], en: ["rotate", "orientation", "upside down", "sideways"] },
    combos: [{ ja: [["pdf", "ページ"], ["回転", "向き", "逆", "横"]] }]
  },
  {
    path: "/pdf/delete-pages/", kind: "tool",
    name: { ja: "PDFページ削除", en: "Delete PDF Pages" },
    description: { ja: "不要なページをPDFから取り除きます。", en: "Remove unwanted pages from a PDF." },
    keywords: { ja: ["ページ削除", "ページを消", "ページを削", "不要なページ"], en: ["delete pages", "remove pages"] },
    combos: [{ ja: [["pdf", "ページ"], ["消", "削除", "削", "取り除", "いらない"]] }, { en: [["pdf", "page"], ["delete", "remove"]] }]
  },
  {
    path: "/pdf/images-to-pdf/", kind: "tool",
    name: { ja: "画像 → PDF", en: "Images to PDF" },
    description: { ja: "複数の画像を1つのPDFにまとめます。", en: "Combine images into a single PDF." },
    keywords: { ja: ["画像をpdf", "写真をpdf", "pdf化", "pdfにしたい", "pdf作成"], en: ["images to pdf", "image to pdf", "jpg to pdf", "png to pdf", "make pdf"] },
    convert: { from: ["png", "jpg", "jpeg", "webp", "heic", "画像", "image", "写真", "photo", "スキャン", "scan"], to: ["pdf"] }
  },
  {
    path: "/pdf/pdf-to-images/", kind: "tool",
    name: { ja: "PDF → 画像", en: "PDF to Images" },
    description: { ja: "PDFページをPNG・JPEG・WebPへ一括変換します。", en: "Render PDF pages as PNG, JPEG or WebP images." },
    keywords: { ja: ["pdfを画像", "pdfをjpg", "pdfをpng", "pdfをwebp"], en: ["pdf to image", "pdf to jpg", "pdf to png", "pdf to webp"] },
    convert: { from: ["pdf"], to: ["png", "jpg", "jpeg", "webp", "画像", "image"] }
  },
  {
    path: "/pdf/page-numbers/", kind: "tool",
    name: { ja: "PDFにページ番号を追加", en: "Add Page Numbers to PDF" },
    description: { ja: "PDFへ開始番号・位置・形式を指定してページ番号を追加します。", en: "Add page numbers with a chosen start, position and format." },
    keywords: { ja: ["ページ番号", "ノンブル", "pdfに番号"], en: ["page numbers", "number pdf pages", "pagination"] }
  },
  {
    path: "/pdf/watermark/", kind: "tool",
    name: { ja: "PDFに透かしを追加", en: "Add Watermark to PDF" },
    description: { ja: "文字・画像の透かしを透明度や角度を指定して追加します。", en: "Add text or image watermarks with opacity and angle controls." },
    keywords: { ja: ["pdf透かし", "ウォーターマーク", "社外秘"], en: ["pdf watermark", "watermark pdf", "confidential stamp"] }
  },
  {
    path: "/pdf/metadata-cleaner/", kind: "tool",
    name: { ja: "PDF文書情報削除", en: "Remove PDF Metadata" },
    description: { ja: "タイトル・作成者・件名など、PDFの文書情報を削除します。", en: "Remove title, author, subject and other PDF document information." },
    keywords: { ja: ["PDF メタデータ削除", "PDF 文書情報", "作成者削除"], en: ["remove PDF metadata", "PDF privacy", "clear PDF author"] }
  },
  {
    path: "/pdf/n-up/", kind: "tool",
    name: { ja: "PDFを複数ページ／1枚に配置", en: "Multiple PDF Pages per Sheet" },
    description: { ja: "2・4・6ページをA4用紙1枚へ面付けします。", en: "Arrange 2, 4 or 6 PDF pages on each A4 sheet." },
    keywords: { ja: ["PDF 面付け", "複数ページ 1枚", "PDF 4in1"], en: ["n-up PDF", "multiple pages per sheet", "4 pages on one sheet"] }
  },
  {
    path: "/pdf/form-fill/", kind: "tool",
    name: { ja: "PDFフォーム入力", en: "Fill PDF Forms" },
    description: { ja: "PDFの入力欄へ記入し、必要なら内容を固定して保存します。", en: "Complete PDF form fields and optionally flatten the result." },
    keywords: { ja: ["PDF フォーム入力", "PDF 記入", "申請書 PDF"], en: ["fill PDF form", "complete PDF", "flatten PDF form"] }
  },
  {
    path: "/pdf/signature/", kind: "tool",
    name: { ja: "PDFに署名を配置", en: "Place a Signature on PDF" },
    description: { ja: "文字・画像・手書きの署名をPDFへ配置します。", en: "Place a typed, uploaded or hand-drawn visual signature on a PDF." },
    keywords: { ja: ["PDF 署名", "PDF サイン", "手書き署名"], en: ["sign PDF", "add signature to PDF", "draw signature PDF"] }
  },
  {
    path: "/pdf/compare/", kind: "tool",
    name: { ja: "PDF比較", en: "Compare PDFs" },
    description: { ja: "2つのPDFを左右・重ね合わせ・差分強調でページ単位に比較します。", en: "Compare two PDFs page by page, side by side, overlaid or with differences highlighted." },
    keywords: { ja: ["PDF 比較", "PDF 差分", "PDF 変更箇所", "PDF 修正前後"], en: ["compare PDFs", "PDF diff", "PDF changes", "visual PDF comparison"] },
    combos: [{ ja: [["pdf"], ["比較", "差分", "違い", "変更"]] }, { en: [["pdf"], ["compare", "difference", "diff", "changes"]] }]
  },
  {
    path: "/pdf/ocr/", kind: "tool",
    name: { ja: "OCR・検索可能PDF", en: "OCR & Searchable PDF" },
    description: { ja: "スキャンPDFへ透明文字層を追加し、検索・選択・コピー可能にします。", en: "Add an invisible text layer to scanned PDFs for search, selection and copy." },
    keywords: { ja: ["PDF OCR", "スキャンPDF", "検索可能PDF", "透明文字", "文字認識", "PDFを検索"], en: ["OCR PDF", "searchable PDF", "scan to text", "invisible text layer", "recognize PDF"] },
    combos: [{ ja: [["pdf", "スキャン"], ["ocr", "検索", "文字認識", "コピー"]] }, { en: [["pdf", "scan"], ["ocr", "search", "recognize", "copy"]] }]
  },
  {
    path: "/pdf/compress/", kind: "tool",
    name: { ja: "PDF圧縮", en: "Compress PDF" },
    description: { ja: "PDF内の埋め込み画像を再圧縮してファイルサイズを軽量化します。", en: "Recompress embedded PDF images to reduce file size." },
    keywords: { ja: ["PDF 圧縮", "PDF 軽量化", "PDF 容量削減", "PDF 小さく", "埋め込み画像圧縮"], en: ["compress PDF", "reduce PDF size", "shrink PDF", "recompress PDF images"] },
    combos: [{ ja: [["pdf"], ["圧縮", "軽く", "軽量", "容量", "小さく"]] }, { en: [["pdf"], ["compress", "smaller", "reduce", "shrink"]] }]
  },
  {
    path: "/pdf/crop/", kind: "tool",
    name: { ja: "PDFの余白をクロップ", en: "Crop PDF Margins" },
    description: { ja: "白余白を自動検出するか四辺を指定してPDFを切り抜きます。", en: "Detect white margins or crop all four PDF sides precisely." },
    keywords: { ja: ["pdfクロップ", "pdf余白削除", "pdf切り抜き"], en: ["crop pdf", "remove pdf margins", "trim pdf"] }
  },
  {
    path: "/pdf/sort-by-page-number/", kind: "workflow",
    name: { ja: "PDFのページ順を復元", en: "Restore PDF page order" },
    description: { ja: "向きを補正し、四隅と端のページ番号を読み取り、複数PDFを正しい順番へ整理します。", en: "Correct orientation, detect page numbers around the edges, and sort multiple PDFs." },
    keywords: { ja: ["ページ番号", "ページ順", "順番がバラバラ", "順番を戻", "スキャンの順番"], en: ["page numbers", "restore order", "sort by page number"] },
    combos: [{ ja: [["ページ番号", "番号", "順番", "順"], ["戻", "復元", "直", "並べ", "整理"]] }]
  },
  {
    path: "/workflows/web-image-optimizer/", kind: "workflow",
    name: { ja: "Web画像最適化", en: "Web Image Optimizer" },
    description: { ja: "ブログ・サムネイル・元サイズから選び、変換・圧縮・メタデータ削除・任意のリネームまで一括処理します。", en: "Choose Blog, Thumbnail or Original size, then convert, compress, remove metadata and optionally rename." },
    keywords: {
      ja: ["web用", "ウェブ用", "ブログ", "サムネイル", "スマホ写真", "写真をまとめて", "ホームページ用", "サイト用", "sns"],
      en: ["web", "blog", "thumbnail", "phone photos", "website images", "optimize for web", "social media"]
    },
    combos: [{ ja: [["写真", "画像"], ["ブログ", "web", "ウェブ", "サイト", "まとめて"]] }]
  },
  {
    path: "/workflows/line-art-to-svg/", kind: "workflow",
    name: { ja: "線画をSVG素材にする", en: "Turn line art into SVG assets" },
    description: { ja: "トリミング・背景処理・SVG化・白フィル（塗りつぶし）・クリーナーをひとつの流れで実行します。", en: "Trim, remove the background, vectorize, add optional white fills and clean up in one flow." },
    keywords: { ja: ["線画をsvg", "線画素材", "svg素材", "イラストをsvg"], en: ["line art to svg", "svg assets", "illustration to svg"] },
    convert: { from: ["線画", "イラスト", "line art", "illustration"], to: ["svg", "素材", "asset"] }
  },
  {
    path: "/workflows/ai-asset-prep/", kind: "workflow",
    name: { ja: "AI画像素材一括仕上げ", en: "AI Asset Prep" },
    description: { ja: "AI生成画像をまとめて、余白・サイズ・連番名・形式・容量を使える素材へ整えます。", en: "Turn AI-generated images into ready-to-use assets with consistent padding, size, names, format and file size." },
    keywords: { ja: ["ai画像", "ai生成", "生成画像", "midjourney", "stable diffusion", "dall-e", "画像生成"], en: ["ai images", "ai generated", "midjourney", "stable diffusion", "dall-e", "generated images"] }
  },
  {
    path: "/workflows/asset-normalizer/", kind: "workflow",
    name: { ja: "画像素材の規格統一", en: "Asset Normalizer" },
    description: { ja: "バラバラな画像を、同じCanvas・対象物・余白・背景・形式・連番名へまとめて統一します。", en: "Standardize a mixed batch to one canvas, object scale, padding, background, format and names." },
    keywords: { ja: ["規格統一", "サイズをそろえ", "サイズを揃え", "統一", "バラバラな画像", "そろえたい", "揃えたい"], en: ["normalize", "standardize", "consistent size", "same size", "uniform"] },
    combos: [{ ja: [["画像", "素材", "サイズ", "大きさ"], ["そろえ", "揃え", "統一", "同じ"]] }]
  },
  {
    path: "/workflows/pdf-finisher/", kind: "workflow",
    name: { ja: "PDF一括仕上げ", en: "PDF Finishing Workflow" },
    description: { ja: "余白除去、向き補正、ページ番号、文書情報削除、連番名への整理を一括実行します。", en: "Remove margins, correct orientation, add page numbers, clear metadata and organize PDF file names in one run." },
    keywords: { ja: ["PDF仕上げ", "PDF一括処理", "PDF余白", "PDF向き補正", "PDF連番"], en: ["finish PDF", "batch PDF cleanup", "PDF margins", "PDF page numbers", "rename PDFs"] },
    combos: [{ ja: [["pdf"], ["仕上げ", "一括", "余白", "向き", "ページ番号", "連番"]] }, { en: [["pdf"], ["finish", "cleanup", "margin", "orient", "number", "rename"]] }]
  },
  {
    path: "/workflows/scan-pdf-optimizer/", kind: "workflow",
    name: { ja: "スキャンPDF最適化", en: "Scanned PDF Optimizer" },
    description: { ja: "スキャン画像やPDFを、向き・余白・OCR・容量・文書情報・連番名まで一括で整えます。", en: "Turn scans into compact searchable PDFs with corrected orientation, cropped margins, clean metadata and sequential names." },
    keywords: { ja: ["スキャンPDF", "検索可能PDF", "紙資料", "OCR", "PDF軽量化", "余白除去"], en: ["scanned PDF", "searchable PDF", "paper scan", "OCR", "compress scan", "crop margins"] },
    combos: [{ ja: [["pdf", "スキャン", "紙資料"], ["ocr", "検索", "軽量", "最適化", "余白"]] }, { en: [["pdf", "scan"], ["ocr", "searchable", "optimize", "compress", "crop"]] }]
  },
  {
    path: "/workflows/custom/", kind: "workflow",
    name: { ja: "オリジナル", en: "Original" },
    description: { ja: "画像・SVG・PDF・ファイルの対応ツールを自由につなぎ、自分用のWorkflowをローカル保存できます。", en: "Connect compatible image, SVG, PDF and file tools, then save your personal workflow locally." },
    keywords: { ja: ["オリジナルワークフロー", "カスタム", "自分用", "ワークフローを作", "組み合わせ"], en: ["custom workflow", "build workflow", "my workflow", "combine tools"] }
  }
];
