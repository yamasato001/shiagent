# SHIAGENT SEO改善 実装記録

更新日：2026-10-19

## 1. フェーズ0監査

重点ページのうち、まずCanvas Paddingを確認した。日英ページにはすでに固有のtitle、meta description、H1、自己参照canonical、日英hreflang、`index,follow`、FAQ、sitemap掲載がある。現時点の少数GSCデータだけを根拠にtitleは変更せず、検索者が機能と結果を判断できる実例および用途別の内部リンクを補う方針とした。

検索意図の担当は次のように固定する。

| 検索意図 | 主担当URL |
|---|---|
| 画像に余白を追加する | `/canvas-padding/`、`/ja/canvas-padding/` |
| 白・透明背景の余白を削除する | `/image-cropper/`、`/ja/image-cropper/` |
| 画像自体の縦横サイズを変更する | `/image-resizer/`、`/ja/image-resizer/` |
| Canvas・余白・対象物の占有率を統一する | `/workflows/asset-normalizer/`、`/ja/workflows/asset-normalizer/` |
| SVGの閉じた領域を白塗りする | `/svg-white-fill/`、`/ja/svg-white-fill/` |

## 2. Canvas Padding改修

対象：`/canvas-padding/`、`/ja/canvas-padding/`

- 日本語H1を「余白追加」から「画像に余白を追加」へ明確化した。titleは維持した。
- 実際のツールと同じ`relativePaddingPlacement`を使い、160×120 RGBA PNGへ10%の透明余白を追加した。
- 横方向は左右16px、縦方向は上下12pxとなり、出力が192×144 PNGになることを生成スクリプトとテストで確認した。
- Before / After画像、入力、設定、出力、変化しない点（拡大・変形なし）を日英ページへ掲載した。
- 透明余白、24pxの白い余白、512×512 Canvas中央配置の3用途を説明した。
- 余白削除はImage Cropper、寸法変更はImage Resizer、占有率統一はAsset Normalizerという役割の違いを本文リンクで示した。
- スマホでは比較画像、設定値、用途カードを1列にして横幅不足を防いだ。

実例画像は`scripts/generate-canvas-padding-example.mjs`で再生成できる。入力は`test/fixtures/sample.png`であり、生成物は`assets/examples/`に保存する。

## 3. 検証項目

- Before / After PNGのIHDR寸法
- 実例生成がツール本体と同じ配置計算を使用していること
- 日英ページの実例、数値、画像参照
- Cropper、Resizer、Asset Normalizerへの用途別リンク
- モバイル1列表示
- 全ページ共通のSEOメタデータ、canonical、hreflang、内部リンク

## 4. SVG White Fill改修

対象：`/svg-white-fill/`、`/ja/svg-white-fill/`

- 実際の`closedRegionMask`と「標準」プリセットを使い、完全な閉領域、検出用画像上の2pxの切れ目、8pxの切れ目を処理した。
- 完全な閉領域は1領域、小さな切れ目は補完され1領域、大きな切れ目は0領域となることをテストで固定した。
- 3ケースそれぞれのBefore / After SVGと、設定・結果・制約を日英ページへ掲載した。
- 大きな隙間は自動処理で埋まると約束せず、SVG手動白塗りで補助線を追加する導線を設置した。
- 前工程は線画→SVGワークフロー、後工程はSVGクリーナーという用途別リンクを追加した。
- 切れ目の判定はSVG座標ではなく描画後の検出用画像に依存するため、線幅と描画解像度で結果が変わることを明記した。

実例は`scripts/generate-svg-white-fill-examples.mjs`で再生成でき、生成物は`assets/examples/`に保存する。

## 5. 検証結果

- 最新`main`統合後の専用テストおよび既存テスト：378件成功、失敗0件。
- `git diff --check`：問題なし。
- `npm run build`：ローカルの`node_modules`に`tesseract.js`が解決可能な状態で存在せず失敗。今回変更した画像・SVGツールのコードに起因するエラーではない。途中生成物はGitの開始時点へ復元した。

## 6. 未実施・次の順序

1. デプロイ後14日でクロール、インデックス、表示・操作不具合を確認する。
2. 28日でクエリ数、表示回数、クリックの初期傾向を確認する。
3. データ量が不足する場合は56日まで延長し、Image Cropper改修の優先度を判断する。

Search Consoleでのインデックス確認と効果測定はデプロイ後の作業であり、このローカル改修時点では未実施である。
