# SHIAGENT --- 追加仕様まとめ

更新日: 2026-09-29

## ブランドと基本思想

SHIAGENT（シアゲント）は、SHIAGE（仕上げ）＋GEN（Generate /
Generation）＋AGENTを重ねた名称。日本語の「仕上げんと（いけない）」も掛ける。

コンセプトは **Local-first Creative
Toolkit**。画像・SVG・PDF・AI生成素材を、実際に使える状態まで仕上げるWeb
Workbenchを目指す。

## 処理方式の3分類

### Local Processing

AIを使わずJS/WASM等で端末内処理。PNG圧縮、Resize、Image
Splitter、PNG→SVG、SVG Optimize、PDF Merge/Interleave等。

### Local AI

AIモデルをブラウザへ取得し、ユーザーCPU/GPUで推論。Local Line Art
Generator、Smart Rename、Auto Tag等。

### Cloud AI

外部APIまたは運営GPU。高精度Vision、Cloud生成等。運営側に推論費用が発生。

## 料金原則

> **If it runs on your device, it's unlimited.**

Local ProcessingとLocal AIは原則枚数・回数無制限。Cloud
AIのみCredits/Usage Limit。

Freeは基本Local
Tools、個別Download、ZIP、可能な限りUnlimited。Proは枚数ではなく自動化へ課金する。Folder/CSV、Workflow保存、Preset、Auto
Rename、Auto QA、自動SVG Pipeline、広告なし等。

基本思想は **「処理能力ではなく、時間短縮に課金する」**。

## Tool Page設計

CompressPNGを参考に、検索から来たユーザーがAbove the
foldですぐToolを使える構造にする。SEO文章を先に読ませない。

構造: 1. Breadcrumb 2. H1 3. Short description 4. Tool本体 5.
Local/Privacy表示 6. How it works 7. 使い方 8. 品質・技術説明 9. FAQ 10.
Privacy 11. Related tools

各Toolに独立URL。英語 `/image-compressor/`、日本語 `/ja/image-compressor/`
等。

## Download UX

個別ファイルは直接Download。一括保存だけZIP。

1ファイルなら大きな直接Download。大量ならDownload All
(.zip)をPrimaryにしつつ個別Downloadも残す。Batch QAではDownload Accepted
/ Selectedも用意。

## PNG Compressorを初期Toolへ

PNG Compressorは自分自身も枚数制限に困っており、Local Processing、Batch
Engine、ZIP、進捗UIなどSHIAGENT共通基盤を試すのに適している。

想定: 500 PNGを投入 → ブラウザ内圧縮 → 結果一覧。

例: `842 MB → 291 MB / Saved 551 MB (-65.4%)`

各ファイルにBefore / After / 削減率を表示。枚数無制限を基本とする。

## PNG圧縮品質

PNG圧縮は各サービスで同じではない。

LosslessはPixelを変えずPNG内部を最適化。Lossy/Quantizationは色数などを減らして大幅軽量化。色量子化、Dithering、Palette、Alpha、Metadata、Deflate/Zopfli、Optimization
level等で品質と圧縮率が変わる。

## SHIAGENT Compression Modes

技術方式ではなく目的で選ばせる。

### Auto

画像を解析してPresetを自動選択。

### Exact

Pixel-perfect Lossless。

### Balanced

見た目とサイズの標準バランス。

### Smallest

ファイルサイズ最優先。

### Line Art

白黒・モノライン・細線イラスト専用。SHIAGENT独自性候補。

## Auto判定

AI不要。色数、Alpha、彩度、明度分布、Edge密度、白背景率、Grayscale率、Continuous
tone等を高速解析。

例: 色数少＋白背景多＋Edge高＋低彩度 → Line Art。 色数多＋連続階調多 →
Balanced/Photo。 Alphaあり → Transparency-safe設定。

## Line Art Compression

まとプリ系の白背景・黒線・アンチエイリアスGray・極細線を重視。

候補Pipeline: Original → Metadata removal → Grayscale/Palette analysis →
Gray-level optimization → Edge-aware quantization → Alpha preservation →
PNG optimization。

圧縮率だけでなくThin-line preservation、Edge preservation、Alpha
preservationを重要指標とする。

## Advanced Settings

通常はPresetだけ。必要な人のみQuality、Colors、Dithering、Metadata、Optimization
effort、Alpha等を開く。

CompressPNGの簡単さとSquooshの自由度の中間を狙う。

## 圧縮比較ベンチマーク

同一画像をTinyPNG、CompressPNG、Squoosh/OxiPNG/Quantization、iLoveIMG、SHIAGENT候補Pipelineで比較。

測定: - Original / Output size - Compression ratio - SSIM / PSNR - Pixel
difference - Alpha difference - Unique colors - Edge preservation -
Thin-line disappearance - Visual inspection

テストカテゴリ: A. モノライン線画（最重要） B. AI生成イラスト C.
Screenshot/UI D. Photo PNG E. Transparent PNG F. Flat Illustration

各5枚程度、計30枚を目安。まず線画10〜20枚から開始可能。

目的は「どの画像にどのPresetが最適か」を実測で決めること。CompressPNG等より細線を維持しつつ十分小さくできるLine
Art設定が見つかれば差別化にする。

## PNG Compressor UI案

`PNG Compressor`

Drop PNG files here / Select files

Compression: Auto / Exact / Balanced / Smallest / Line Art

Auto detected: 32 Line Art / 11 Illustration / 4 Photo

Compress後: 47 files completed 128 MB → 41 MB Saved 87 MB (-68%)

一覧にfilename / before / after / saved。 個別Download＋Download All
(.zip)。

## Local Batch Engine

PNG CompressorをSHIAGENT共通Batch Engineの最初の実装候補とする。

共通化: Multi-file input / Queue / Progress / Per-file status / Error
isolation / Cancel / Memory cleanup / Result list / Individual Download
/ ZIP / Total statistics。

後にResize、Convert、SVG、AI Generation、Renameへ再利用。

## Top UI

トップは **Search + Category + Tool Cards + Workflows**。

カテゴリは Image / Vector / PDF / AI / Batch。

カードはモノクロIcon、Tool name、1行説明、ON DEVICE / LOCAL AI / CLOUD
AI / BATCH /
PRO等のBadgeのみ。白背景、黒文字、薄いBorder、Shadowほぼなし。紫GradientやGlowは避ける。

## Workflow

単機能Toolを部品として連結。

例: Finish your line art: PNG → Clean → Vectorize → Gap Fix → White Fill
→ Optimize → SVG

Prepare web images: Images → Auto Crop → Resize → Compress → WebP →
Rename → ZIP

## Human-in-the-loop

基本思想: \> **機械が面倒な90%を処理し、人間が最後の10%だけ判断する。**

Preview / Compare / Accept / Regenerate / Edit /
Deleteを短時間で行えるUIを重視。

## 初期Tool優先候補

1.  PNG Compressor
2.  Image Splitter
3.  PNG→SVG + White Fill
4.  SVG Cleaner / Optimizer
5.  SVG Gap Finder
6.  PDF Interleave
7.  Image Resizer
8.  Line Art Cleaner
9.  Smart / Batch Image Renamer
10. Local Batch Line-Art Generator PoC

Local Image Generatorは目玉候補だが技術検証が必要。まず確実なLocal
Processing ToolでサイトとBatch基盤を作り、並行してLocal AI PoCを進める。

## 将来構想: AIによる画像ファイル名の自動生成

Asset Normalizerおよび一括リネームへ、画像内容を認識してファイル名を自動生成する有料機能を将来的に追加する。

例:

```text
IMG_4832.png
    ↓
white-rabbit-running.png
```

実用的な認識精度を優先し、ブラウザ内Local AIではなく外部のVision APIを利用する。APIキーをユーザーへ入力させる方式は採用せず、SHIAGENTがAPI利用料を負担してバックエンドから呼び出す。

### 無料機能との境界

- Sequential namingは無料・無制限・On Deviceのまま維持する。
- AI namingのみ有料のCloud AI機能とする。
- 初期選択は常にSequential namingとし、意図せず画像を外部送信しない。
- AI naming選択時はON DEVICE表示をそのまま使用せず、`CLOUD AI FOR NAMING`を明示する。
- 実行前に「名前の生成時のみ縮小プレビューをAIへ送信する」ことへ同意を得る。
- AI生成名は保存前に一覧で確認・個別修正できるようにする。

UI案:

```text
Naming

○ Sequential        FREE / ON DEVICE
  asset-001.png

● AI naming         PAID / CLOUD AI
  white-rabbit-running.png

Language            English / Japanese / Romaji
Style               Descriptive / Short / SEO
Words               2–5
Separator           - / _
Prefix              Optional
```

### 処理設計

1. 元画像をブラウザ内で長辺512px程度へ縮小する。
2. 送信用JPEGまたはWebPへ変換し、元画像やEXIFは送信しない。
3. `detail: low`でVision APIへ送信する。
4. APIは元ファイルIDと提案名を構造化JSONで返す。
5. 禁止文字除去、拡張子決定、重複回避、連番補完はブラウザ側で行う。
6. ユーザーが一覧を確認・修正してから、Asset Normalizerの書き出し処理へ進む。

大量処理では複数画像を小さなグループへ分け、進捗、個別エラー、再試行を表示する。通常操作で24時間待つ非同期Batch APIは使用せず、即時応答のAPIを基本とする。

品質とコストの両立案:

- 軽量Visionモデルを通常判定に使用する。
- 判定困難、低信頼、名前重複時のみ上位モデルへ再送する。
- 同一画像はローカルハッシュで検出し、同じ操作内の重複API呼び出しを避ける。
- 1回・1日・1アカウント当たりの上限、Rate Limit、月間API予算上限を設定する。
- SHIAGENTのAPIキーはフロントエンドへ配布せず、必ず認証済みバックエンド経由にする。

### 暫定原価試算

2026-09-29時点のVision API料金を前提とした構想値。為替は1 USD = 150円、512px、低解像度入力、短いJSON出力、再試行10%を想定する。モデル料金改定時に再計算し、価格をコードへ固定しない。

```text
                         100枚      500枚      1,000枚     10,000枚
軽量モデル                 約1円       約4円         約8円        約81円
上位バランスモデル          約16円      約81円        約161円     約1,610円
```

推奨構成は軽量モデル80%、上位モデルへの再判定20%。この場合のAI原価は1,000枚あたり約39円を目安とする。ただし最終決定前に実画像300〜500枚で命名品質、再判定率、失敗率、実トークン量を測定する。

### 暫定販売価格

月額契約より先に、利用頻度が不定期なBatch処理と相性の良い買い切り処理枠を検討する。

| 区分 | AI命名可能枚数 | 暫定価格（税込表示想定） |
| --- | ---: | ---: |
| 初回体験 | 20枚 | 無料 |
| Light | 500枚 | 390円 |
| Standard | 2,000枚 | 980円 |
| Pro | 10,000枚 | 3,980円 |

上記は確定価格ではない。Vision API、決済、サーバー、監視、不正利用、再処理、サポートの費用を含めて正式決定する。決済手数料は国内カード決済3.6%を暫定前提とする。

販売時は「1枚単価」よりも「AI命名 500枚分」のような処理枠として表示する。未使用枠の有効期限、返金、消費順序、法務・会計上の扱いは、決済実装前に別途確認する。

### 実装開始の前提条件

- アカウント認証
- 決済と利用枠管理
- API中継バックエンド
- Rate Limitと不正利用対策
- 利用量・原価・エラー率の監視
- クラウド送信への明示同意
- 画像保持期間および削除方針の明文化
- AI生成名のレビュー・修正UI
- 300〜500枚によるモデル品質・原価ベンチマーク

これらが揃うまでは、公開画面へ動作しない有料ボタンやAPIキー入力欄を追加しない。通常のローカル一括リネーム機能を完成状態として維持し、有料AI namingは将来機能として管理する。
