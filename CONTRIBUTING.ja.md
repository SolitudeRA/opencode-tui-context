# コントリビューションガイド

[README に戻る](README.ja.md) · [English](CONTRIBUTING.md) · [简体中文](CONTRIBUTING.zh-CN.md) · 日本語

開発環境の準備、動作確認、プルリクエストの方針をまとめています。インストールや設定については[利用ガイド](docs/guide.ja.md)を参照してください。

- [開発環境と確認](#開発環境と確認)
- [ソースコードの構成](#ソースコードの構成)
- [変更の提案](#変更の提案)

## 開発環境と確認

開発には Git、Bun、Node.js を使い、ホスト検証には OpenCode `2.0.32` を使います。V2 SDK は `package.json` でバージョンを固定しています。リポジトリをクローンした後に実行してください。

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run test:render
```

npm パッケージ、ビルド済み ZIP、チェックサムをローカルで生成するには：

```sh
npm run release:pack
```

成果物は `release/` に出力されます。このコマンドは公開を行いません。初回の npm 設定、自動公開、ホストへのインストール確認については[リリースガイド](docs/releasing.md)を参照してください。

単体テストはオプション、使用量、有効なコンテキスト、セル割り当て、配色、凡例、狭い幅を検証します。`test:render` は `dist/tui.js` を再ビルドし、V2 ホスト Context のモックと実際の OpenTUI テストレンダラーで実行します。9 グループのシナリオで、空の状態、トークン更新、メッセージのモデル参照、セッション・ロケーション切り替え、巻き戻し境界、コンパクション、幅変更、テーマ変更、終了処理を確認します。ネットワーク通信も OpenCode の起動も行いません。

ホストの受け入れ確認では、OpenCode 内でも同じシナリオを確認してください。正確なホストバージョンを記録し、ローカルのテストデータと実際のプロバイダー使用量を区別します。描画の契約テストだけでは、ホストのプラグイン読み込みや npm インストールは確認できません。

## ソースコードの構成

| ファイル | 役割 |
| --- | --- |
| [`tui.js`](tui.js) | ローカルディレクトリの入口として `dist/tui.js` を読み込む |
| [`src/tui.tsx`](src/tui.tsx) | V2 `Plugin.define()` エントリーと ID（`opencode-tui-context`） |
| [`src/plugin.tsx`](src/plugin.tsx) | オプションと `sidebar.content` スロットの登録・解除 |
| [`src/panel.tsx`](src/panel.tsx) | テーマの配色、モデルの参照、幅に応じた描画 |
| [`src/usage.ts`](src/usage.ts) | メッセージの選択と使用量の計算 |
| [`src/format.ts`](src/format.ts) | 数値の省略表記と文字セルの割り当て |
| [`src/options.ts`](src/options.ts) | 設定の既定値と検証 |
| [`scripts/build.mjs`](scripts/build.mjs) | Babel で Solid JSX をコンパイルし、esbuild で ESM をバンドル |
| [`scripts/test-render.mjs`](scripts/test-render.mjs) | 実際の OpenTUI テストレンダラーでビルド済みバンドルの 9 グループを検証 |
| [`scripts/release.mjs`](scripts/release.mjs) | npm パッケージ、ビルド済み ZIP、SHA-256 チェックサムの生成と検証 |

バンドルでは `@opencode/plugin/tui`、OpenTUI、Solid を外部参照として残し、V2 ホストのモジュールを使います。省略可能な peer dependencies を宣言し、実行時の `dependencies` はありません。開発用依存関係のコピーは不要です。ローカル版には `package.json`、ルートの `tui.js`、`dist/tui.js` が必要で、npm はマニフェストの `./tui` エクスポートを使います。Solid JSX の変換は維持してください。汎用の JSX 変換では、コンパイルが成功してもリアクティブな描画が壊れる場合があります。

## 変更の提案

コントリビューションを歓迎します。変更の範囲を絞り、上記のチェックを実行したうえで、プルリクエストにはユーザーから見える動作と検証内容を記載してください。動作を変更する場合は関連するテストを更新し、英語・中国語・日本語の README、[利用ガイド](docs/guide.ja.md)、コントリビューションガイドを揃えてください。大きなスコープ変更は、先に Issue で相談してください。
