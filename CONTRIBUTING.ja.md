# コントリビューションガイド

[README に戻る](README.ja.md) · [English](CONTRIBUTING.md) · [简体中文](CONTRIBUTING.zh-CN.md) · 日本語

開発環境の準備、動作確認、プルリクエストの方針をまとめています。インストールや設定については[利用ガイド](docs/guide.ja.md)を参照してください。

- [開発環境と確認](#開発環境と確認)
- [ソースコードの構成](#ソースコードの構成)
- [変更の提案](#変更の提案)

## 開発環境と確認

開発には Git、Bun、Node.js を使います。リポジトリをクローンした後に実行してください。

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build
```

npm パッケージ、ビルド済み ZIP、チェックサムをローカルで生成するには：

```sh
npm run release:pack
```

成果物は `release/` に出力されます。このコマンドは公開を行いません。初回の npm 設定、自動公開、ホストへのインストール確認については[リリースガイド](docs/releasing.md)を参照してください。

テストでは、オプションの正規化、使用量の計算、バーのセル割り当て、配色、凡例、狭い幅での動作を検証します。OpenCode 内でのスモークテストも必要です。UI を変更した後は、空のセッション、トークンデータを持つ応答、狭いサイドバー、他のプラグインとの併用を確認してください。

## ソースコードの構成

| ファイル | 役割 |
| --- | --- |
| [`src/tui.tsx`](src/tui.tsx) | プラグインモジュールと ID（`opencode-tui-context`） |
| [`src/plugin.tsx`](src/plugin.tsx) | イベント購読と、順序 `60` での `sidebar_content` 登録 |
| [`src/panel.tsx`](src/panel.tsx) | テーマの配色、モデルの参照、幅に応じた描画 |
| [`src/usage.ts`](src/usage.ts) | メッセージの選択と使用量の計算 |
| [`src/format.ts`](src/format.ts) | 数値の省略表記と文字セルの割り当て |
| [`src/options.ts`](src/options.ts) | 設定の既定値と検証 |
| [`scripts/build.mjs`](scripts/build.mjs) | esbuild による ESM バンドルの生成 |
| [`scripts/release.mjs`](scripts/release.mjs) | npm パッケージ、ビルド済み ZIP、SHA-256 チェックサムの生成と検証 |

バンドルでは OpenTUI と Solid のインポートを外部参照として残し、ホストが提供するモジュールを使います。マニフェストには省略可能な peer dependencies を宣言し、実行時の `dependencies` はありません。インストール先に開発用依存関係をコピーする必要はありません。

## 変更の提案

コントリビューションを歓迎します。変更の範囲を絞り、上記のチェックを実行したうえで、プルリクエストにはユーザーから見える動作と検証内容を記載してください。動作を変更する場合は関連するテストを更新し、英語・中国語・日本語の README、[利用ガイド](docs/guide.ja.md)、コントリビューションガイドを揃えてください。大きなスコープ変更は、先に Issue で相談してください。
