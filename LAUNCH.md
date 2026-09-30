# SHIAGENT 公開手順書

## ビルドと確認

1. 依存パッケージをインストールし、`npm run build` を実行する。
2. `npm test` と `npm run launch:check` を実行する。
3. プロジェクトのルートにある公開用ファイルを配置する。各ツールのフォルダ、`assets/`、ルートのHTML、検索エンジン向けのファイルは、すでに本番のURLと同じ配置になっている。`node_modules/`、`src/`、`scripts/`、`test/` などの開発用フォルダはアップロードしない。`_headers` は Cloudflare Pages と Netlify で使われる。Xserver では同じヘッダーを `.htaccess` で設定しており、開発用フォルダもこのファイルで非公開にしている（「自動デプロイ」を参照）。
4. 存在しないURLにアクセスしたとき、独自の `404.html` がステータス404で返ることを確認する。
5. 本番のレスポンスヘッダーを確認し、すべてのツールで Worker と WebAssembly のファイルが読み込めることを確認する。

## 自動デプロイ

まとプリと同じく、`main` ブランチに push すると本番が更新される。`.github/workflows/deploy.yml` が `node --test` と `npm run check` を実行し、両方が通ったときだけ、新しいパッチバージョンのタグを付けたうえで Xserver に SSH 接続し、公開フォルダで `git fetch origin main && git reset --hard origin/main` を実行する。サーバー側ではビルドしないため、`src/` を変更したときは `npm run build` で作り直した `assets/dist/` も必ずコミットすること。

初回だけ必要な設定：

1. Xserver のサーバーパネルで `shiagent.com` を追加し、SSL と SSH を有効にする。公開フォルダは通常 `/home/<サーバーID>/shiagent.com/public_html`。
2. SSH で接続し、公開フォルダをこのリポジトリの `main` ブランチのクローンにする。先に Xserver が置いた初期ファイルを `public_html` の外へ移動し、`public_html` の中で `git clone -b main https://github.com/yamasato001/shiagent.git .` を実行する。リポジトリが非公開の場合は、サーバー上で読み取り専用のデプロイキーを作成し、GitHub のリポジトリの Settings → Deploy keys に登録したうえで、SSH 経由でクローンする。
3. GitHub Actions から SSH 接続できるようにする。サーバーパネルで公開鍵を登録し、対応する秘密鍵を次の手順で使う。同じサーバーアカウントなら、まとプリのデプロイで使っている鍵をそのまま使える。
4. shiagent リポジトリの Settings → Secrets and variables → Actions で、次の5つを登録する。
   - `XSERVER_HOST`：SSH のホスト名（例：`svXXXX.xserver.jp`）
   - `XSERVER_USER`：サーバーID
   - `XSERVER_SSH_KEY`：手順3の秘密鍵
   - `XSERVER_PORT`：`10022`
   - `XSERVER_DEPLOY_PATH`：手順1の公開フォルダのパス
5. Actions タブから「Deploy to Xserver」ワークフローを一度手動で実行する（Run workflow）。または `main` に push する。
6. `https://shiagent.com/` が表示されること、`https://shiagent.com/src/` と `https://shiagent.com/.git/HEAD` が404になること、レスポンスヘッダーに `Content-Security-Policy` が含まれることを確認する。

`.htaccess` と `_headers` の内容はそろえておくこと。両者が食い違うと `test/deploy-config.test.js` が失敗する。

## お問い合わせフォームの有効化

最初に実際のフォーム送信があると、FormSubmit から `yamamotoshiki@yahoo.co.jp` に有効化のメールが届く。そのメールを開いてフォームを承認する。承認するまでは、以降のお問い合わせが正常に届かない。公開後にテスト用のお問い合わせを1件送り、返信までの一連の流れを確認する。

## 検索エンジンでの所有権確認

1. Search Console に `https://shiagent.com/` をプロパティとして追加する。
2. 確認方法で「HTMLタグ」を選び、`content` の値（トークン）だけをコピーする。
3. 本番用のビルド環境で `GOOGLE_SITE_VERIFICATION` にトークンを設定し、ビルドし直す。
4. 必要に応じて、Bing Webmaster Tools 用に `BING_SITE_VERIFICATION` も同じ方法で設定する。
5. 所有権を確認し、`https://shiagent.com/sitemap.xml` を送信して、トップページと主なツールページを検査する。

メタデータの生成スクリプトは、確認用タグを `/` と `/ja/` にだけ挿入する。トークンはリポジトリにコミットしない。

注意：自動デプロイではサーバー側でビルドしないため、手順3のようにビルド環境でトークンを設定する方法はそのままでは使えない。トークンを含めてビルドした結果をコミットしない限り、本番には反映されない。Search Console の確認方法として「DNSレコード」（ドメインプロバイダ）を選べば、ビルドやコミットをせずに所有権を確認できる。

## プライバシーに配慮した診断情報

サイトは、個人情報を除いた診断イベントを、表示中のタブの `sessionStorage` に最大30件まで保持する。自動では何も送信しない。利用者は、お問い合わせフォームでこの診断情報を添付するかどうかを自分で選べる。ファイル名、ファイルの中身、プロンプトの文章、生成したSVGのデータは、診断イベントに含めないこと。
