# SHIAGENT --- UI / Brand / Product Spec

更新日: 2026-09-25

## ブランド

サービス名は **SHIAGENT（シアゲント）**。

意味: - SHIAGE = 仕上げ - GEN = Generate / Generation - AGENT =
将来の自動化・Workflow Agent -
日本語の「仕上げんと（いけない）」という言い回しも掛ける

英語コピー候補: **Generate. Refine. Finish.** 日本語候補:
**つくる。整える。仕上げる。**

コンセプトは **Local-first Creative Toolkit**。
画像・SVG・PDF・AI生成素材を「実際に使える状態まで仕上げる」Webツール群。

## Local-first

可能な処理はブラウザ内で実行する。 - インストール不要 -
可能な限りアップロード不要 - ファイルを外部へ送信しない - Local
AIはユーザーPCで推論 - 必要な場合だけCloud AI - Image / Vector / PDF /
AI / Batchを横断

訴求候補: **Runs on your device.** **Your files stay in your browser.**

## カテゴリ

初期は5カテゴリ程度。

### Image

Image Splitter / Auto Crop / Line Art Cleaner / Resizer / Background
Remover / B&W

### Vector

PNG→SVG / SVG White Fill / Gap Finder / Cleaner / Optimizer / Simplifier
/ Resize

### PDF

Interleave / Reorder / Merge / Split / PDF→Images / Images→PDF

### AI

Local Line Art Generator / Smart Image Renamer / Auto Tagger / Similar
Image Finder

### Batch

Batch Generation / Rename / Convert / Folder・CSV Processing

## SEOとWorkspace

SEOでは各Toolに独立URLを持つ。

例: - `/image-to-svg/` - `/svg-white-fill/` - `/image-splitter/` -
`/line-art-generator/` - `/pdf-interleave/`

ただし実際の作業は共通Workspaceで行い、一度読み込んだファイルを保持したまま、
**Generate → Clean → Vectorize → Fill → Optimize → Export**
などを連続実行可能にする。

原則: **入口は単機能。作業体験は一体型。**

# トップページUI

基本順序: 1. Header 2. Hero 3. Tool Search 4. Category Filter 5. Popular
Tools 6. Workflows 7. All Tools 8. Local-first / Privacy 9. Footer

## Header

左: SHIAGENT

右: Tools / Workflows / Language / 将来Pricing・Account

言語はヘッダーから即切替。 `EN | 日本語` または Globe icon。

## Hero

情報を載せすぎない。

日本語: **つくる。整える。仕上げる。**
画像・SVG・PDFをブラウザだけで処理。

英語: **Generate. Refine. Finish.** Creative tools that run in your
browser.

近接位置でLocal-firstを簡潔に伝える。

## Tool Search

トップ上部の重要機能。 30〜50ツールに増えてもカード一覧から探させない。

検索対象: Tool name / Short description / Keywords / Category / Alias

日本語キーワードも持つ。

## Category Filter

Search直下にChip: **All \| Image \| Vector \| PDF \| AI \| Batch**

モバイルでは横スクロールまたはWrap。

# Tool Card

カード型を採用。ただし情報を詰め込みすぎない。

基本: - モノクロIcon - Tool name - 1行Short description - 必要なBadge -
Card全体クリック

例:

**PNG → SVG** 線画PNGを編集可能なSVGへ `LOCAL`

Badge候補: LOCAL / AI / BATCH / PRO

無料・アップロード不要等は毎カードに繰り返さず、サイト共通メッセージとして表示。

## Card Design

-   White background
-   Black / near-black text
-   Light gray border
-   小さめ角丸
-   Shadowほぼなし
-   Hover時のみ薄いgray
-   十分な余白
-   Monochrome icon
-   控えめAnimation

避ける:
AI系でありがちな紫青Gradient、Glow、Neon、過剰Glassmorphism、大Shadow。

方向性: **道具として信頼できる、静かで洗練されたUI。**

# Workflow

SHIAGENTの重要な差別化。

Tool = 単機能 Workflow = 複数Toolを接続して目的達成

### Finish your line art

PNG → Clean → Vectorize → Gap Fix → White Fill → Optimize → SVG

### Generate SVG assets

Prompt List → Local AI → Generate → Clean → Vectorize → QA → ZIP

### Prepare web images

Images → Auto Crop → Resize → Optimize → Rename → ZIP

詳しい人はTool、処理方法を知らない人はWorkflowから開始。

ToolとWorkflowは同じ処理コンポーネントを再利用し、重複実装しない。

# 多言語

初期: - English - 日本語

URL例: English `/image-to-svg/` Japanese `/ja/image-to-svg/`

ユーザーが手動変更した言語はlocalStorage等に保存。
SEOでは言語別URL＋hreflang。

UI本体・Layoutは共通で、文字列をi18n辞書で切替。
最初からコードへ日本語/英語をベタ書きしない。

レスポンシブで言語差を吸収: - 固定幅Buttonを避ける - Paddingでサイズ -
Flex/Grid - Wrapping許容 - Card高さを過度に固定しない - Hero 2〜3行許容

FontはFallback設計。
SEOタイトル・説明・本文は単純翻訳ではなく各言語の検索意図に合わせる。

# Local-first表示

カードごとではなくHero付近で共通訴求。

**Runs on your device** Your files stay in your browser.

Cloud AIを使う機能はLocalではないことを明示する。

# Local AI Model Manager

将来、必要なモデルだけユーザーが追加。

例: Image Recognition / Background Removal / Line Art Generator

大型モデルは訪問時に自動DLしない。 ユーザー操作後にSize、Local
processing、Storage usage等を明示して取得。 削除も可能にする。

# Local Batch Line-Art Generator

複数Prompt → Generate All → Sequential Local AI → Thumbnail QA → Accept
/ Regenerate / Delete → ZIP。

将来: Generate → Cleaner → Threshold → Vectorize → Gap Fix → White Fill
→ Optimize → Rename → ZIP

までWorkflow化。

# Human-in-the-loop

基本思想: **機械が面倒な90%を処理し、人間が最後の10%だけ判断する。**

例: 100 generated → 87 Accept / 9 Regenerate / 4 Delete

# 収益化候補

### Free

基本Local Tools / 1枚Local生成 / 可能な限り生成無制限 / 広告 /
Login不要優先

### Pro

Batch / CSV・Folder / Workflow保存 / Preset / ZIP / 広告なし /
高度Export / 自動SVG Pipeline

### Cloud AI Credits

Localで難しい高精度処理のみ。

### Pro Local Model

将来的な高品質専用Local Modelの買い切り・Pro特典。

# トップページWireframe

``` text
┌──────────────────────────────────────────────┐
│ SHIAGENT             Tools  Workflows  EN ▼ │
├──────────────────────────────────────────────┤
│                                              │
│      Generate. Refine. Finish.               │
│      Creative tools that run in your browser │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Search tools...                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  All   Image   Vector   PDF   AI   Batch     │
├──────────────────────────────────────────────┤
│ Popular tools                                │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │PNG → SVG │ │Line Art  │ │Image     │      │
│ │ LOCAL    │ │Generator │ │Splitter  │      │
│ └──────────┘ └──────────┘ └──────────┘      │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │SVG Fill  │ │SVG Clean │ │PDF       │      │
│ │          │ │          │ │Interleave│      │
│ └──────────┘ └──────────┘ └──────────┘      │
├──────────────────────────────────────────────┤
│ Workflows                                    │
│ Finish your line art                         │
│ PNG → Clean → SVG → Fill → Optimize          │
│ [ Start workflow ]                           │
│                                              │
│ Generate SVG assets                          │
│ Prompt → Local AI → Clean → SVG → QA → ZIP  │
│ [ Start workflow ]                           │
├──────────────────────────────────────────────┤
│ Runs on your device                          │
│ Your files stay in your browser.             │
└──────────────────────────────────────────────┘
```

# Codex UI原則

1.  Mobile-first / Responsive
2.  Desktop Tool Card 3〜4列
3.  Tablet 2列
4.  Mobile 1列または必要時2列
5.  Search即時Filter
6.  Category stateをURL/queryへ反映可能
7.  Tool metadataをJSON/DB化
8.  Cardをハードコードしない
9.  i18n前提
10. Light mode基準
11. Dark mode追加可能なCSS variables
12. ColorをCSS variablesで一元管理
13. Tool / Workflowで処理ロジック共通化
14. Local / Cloudを正確に表示
15. Accessibility確保

# UI方針まとめ

**カードは使う。ただしカード一覧サイトにはしない。**

中心導線: **Search + Category + Tool Cards + Workflows**

Tool Cardは個別作業への入口。 Workflowは目的への入口。
作業開始後は共通Workspaceへ入り、一度読み込んだ素材を保持したまま複数処理を続けられる。

SHIAGENTは「便利ツールを大量に並べたサイト」ではなく、

**制作物を最後まで仕上げるためのWeb Workbench**

として設計する。
