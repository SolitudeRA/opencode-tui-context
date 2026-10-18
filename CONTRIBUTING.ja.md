# コントリビューションガイド

[README に戻る](README.ja.md) · [English](CONTRIBUTING.md) · [简体中文](CONTRIBUTING.zh-CN.md) · 日本語

## 開発環境と確認

開発には Git、Bun、Node.js を使います。ホスト検証の基準は OpenCode V1 `1.18.31` と V2 `2.0.32` で、SDK バージョンは `package.json` に固定しています。クローン後に実行してください。

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run test:render
npm run release:pack
```

`release:pack` は npm パッケージ、ZIP、チェックサムを `release/` に出力し、公開は行いません。公開とホスト検証については[リリースガイド](docs/releasing.md)を参照してください。

単体テストは設定、使用量、両 API の有効なコンテキスト選択、イベント解除、幅に応じた描画を検証します。`test:render` は 3 つのバンドルをビルドし、入口の遅延読み込みと、各バージョンに対応する実際の OpenTUI テストレンダラーで両アダプターを確認します。ホスト Context はモックです。モデル呼び出しや OpenCode の起動は行わないため、実際のホスト読み込みや npm インストールは両ホストで別途確認し、テストデータと実際のプロバイダー使用量を区別してください。

## ソースコードの構成

| ファイル | 役割 |
| --- | --- |
| [`tui.js`](tui.js) | ローカルディレクトリ読み込みの入口 |
| [`src/tui.tsx`](src/tui.tsx) | 共通入口。V1 `tui` または V2 `setup` アダプターを遅延読み込み |
| [`src/tui-v1.tsx`](src/tui-v1.tsx)、[`src/v1/plugin.tsx`](src/v1/plugin.tsx) | V1 モジュール、状態・イベント、テーマ、`sidebar_content` の登録 |
| [`src/tui-v2.tsx`](src/tui-v2.tsx)、[`src/plugin.tsx`](src/plugin.tsx) | V2 `Plugin.define()`、オプション、`sidebar.content` の登録 |
| [`src/panel.tsx`](src/panel.tsx) | 共通の描画と V2 のデータ・テーマ変換 |
| [`src/usage.ts`](src/usage.ts)、[`src/v1/usage.ts`](src/v1/usage.ts) | 共通の計算とホスト別のメッセージ・モデル選択 |
| [`src/v1/refresh.ts`](src/v1/refresh.ts) | V1 イベントの購読と解除 |
| [`src/format.ts`](src/format.ts)、[`src/options.ts`](src/options.ts) | セル割り当て、数値の省略表記、設定の検証 |
| [`scripts/build.mjs`](scripts/build.mjs) | Solid JSX の変換と固定名の 3 つの ESM バンドル |
| [`scripts/test-entrypoints.mjs`](scripts/test-entrypoints.mjs) | 入口の遅延読み込みと依存関係の分離を検証 |
| [`scripts/test-render.mjs`](scripts/test-render.mjs)、[`scripts/test-render-v1.mjs`](scripts/test-render-v1.mjs) | V2・V1 のネイティブレンダラーによる契約検証 |
| [`scripts/release.mjs`](scripts/release.mjs) | アーカイブ内容、エクスポート、チェックサムの検証 |

共通入口には SDK やレンダラーの実行時インポートを置かず、各ホストが自身のアダプターだけを読み込むようにします。V2 は `@opencode/plugin/tui` と `Plugin.define()`、V1 は旧モジュール契約を使います。OpenTUI と Solid は外部参照のままホストから提供されます。省略可能な peer dependencies で互換性を宣言し、実行時 `dependencies` や開発用依存関係のコピーは不要です。

ローカル版には `package.json`、ルートの `tui.js`、`dist/` 内の `tui.js`・`tui-v1.js`・`tui-v2.js` が必要です。Solid JSX の変換は維持してください。汎用の JSX 変換では、コンパイルが成功してもリアクティブな描画が壊れる場合があります。

変更の範囲を絞り、上記のチェックを実行し、プルリクエストにユーザーから見える動作と検証結果を記載してください。動作の変更時は関連テストを更新し、英語・中国語・日本語の README、利用ガイド、コントリビューションガイドを揃えてください。大きなスコープ変更は、先に Issue で相談してください。
