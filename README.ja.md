# opencode-tui-context

**OpenCode のサイドバーで、コンテキスト使用量とトークンの内訳をひと目で確認。**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/SolitudeRA/opencode-tui-context/blob/main/LICENSE)
[![OpenCode: >=1.18.0](https://img.shields.io/badge/OpenCode-%E2%89%A51.18.0-18181b)](#クイックスタート)

[English](https://github.com/SolitudeRA/opencode-tui-context/blob/main/README.md) · [简体中文](https://github.com/SolitudeRA/opencode-tui-context/blob/main/README.zh-CN.md) · 日本語

![コンテキストパネルの表示例：使用率 40%。上段は使用済み・予約分・空き容量、下段はキャッシュ・プロンプト・推論・出力トークンの内訳。](https://raw.githubusercontent.com/SolitudeRA/opencode-tui-context/main/docs/assets/context-preview.svg)

*サンプル値を使った表示イメージです。黄色の出力セグメントを除き、実際の配色は OpenCode のテーマに従います。*

- **2 本のバーで把握：** ウィンドウ全体の使用量と、使用済みトークンの内訳を並べて表示。
- **幅に合わせて自動調整：** バーと凡例がサイドバーの幅に追従します。
- **追加のモデル呼び出しは不要：** OpenCode が持つ使用量データを利用します。

## クイックスタート

**OpenCode `>=1.18.0`** が必要です。Windows の `1.18.31` で実際のインストールと有効化を確認しています。

```sh
opencode plugin -g opencode-tui-context
```

OpenCode がビルド済みパッケージをダウンロードし、グローバルの **`tui.json`** に追加します。
ローカルでのビルドや追加の認証情報は不要です。現在のプロジェクトだけにインストールする場合は `-g` を省略します。

OpenCode を再起動し、セッションを開いてサイドバーを表示してください。
正の出力トークン数を報告したアシスタントの応答があれば、**Context** パネルに使用量が表示されます。
それまでは `no assistant turns yet` と表示されます。

ZIP・ソースからのインストールは[利用ガイド](https://github.com/SolitudeRA/opencode-tui-context/blob/main/docs/guide.ja.md#クイックスタート)を参照してください。
**Context が 2 つ表示される場合**は、[内蔵パネルの無効化と有効状態の確認](https://github.com/SolitudeRA/opencode-tui-context/blob/main/docs/guide.ja.md#パネルを表示する)を参照してください。

## パネルの見方

- **上のバー：** モデルのコンテキストウィンドウを `used`（使用済み）・`reserved`（予約分）・`free`（空き）に分けて表示します。
- **下のバー：** 使用済みトークンを `cached`・`prompt`・`think`・`out` に分けて表示します。

| バー | 凡例 | セグメント | 意味 |
| --- | --- | --- | --- |
| 全体 | `u` | `used` | 使用済みトークンの合計 |
| 全体 | `r` | `reserved` | 残りの出力予約枠（推定） |
| 全体 | `f` | `free` | 使用済みと予約分を差し引いた空き容量 |
| 内訳 | `c` | `cached` | キャッシュ読み取りトークン |
| 内訳 | `p` | `prompt` | 入力 + キャッシュ書き込みトークン |
| 内訳 | `t` | `think` | 推論トークン |
| 内訳 | `o` | `out` | 出力トークン |

`reserved` はモデルの出力上限をもとにした表示用の推定値で、実際にトークンを予約するものではありません。
表示するのは **正の出力トークン数を持つ最新のアシスタントメッセージのスナップショット** です。セッション全体の累積使用量や請求額、次のプロンプトの正確なトークン数ではありません。

各項目の定義や計算式は[使用量の計算方法](https://github.com/SolitudeRA/opencode-tui-context/blob/main/docs/guide.ja.md#使用量の計算方法)にまとめています。

## オプション設定

既定の設定でそのまま使えます。凡例を非表示にしたい場合は、`tui.json` の既存のエントリーを次の形式に変更してください。
他の設定やプラグインは残し、同じプラグインを重複して追加しないでください。バージョンを固定している場合は `@version` も残します。

```json
{
  "plugin": [
    ["opencode-tui-context", { "showLegend": false }]
  ]
}
```

| オプション | 既定値 | 動作 |
| --- | --- | --- |
| `showLegend` | `true` | 幅に余裕があるときに凡例を表示します。`false` で非表示にできます。 |
| `exclude` | `[]` | 指定したセグメントと凡例を非表示にします。`used` は対象外です。 |
| `barWidth` | `24` | 幅を測定する前のパネル外寸の初期幅です。測定後は自動調整され、幅を固定する設定ではありません。 |

変更後は OpenCode を再起動してください。指定できる値やローカルインストールの設定は[設定ガイド](https://github.com/SolitudeRA/opencode-tui-context/blob/main/docs/guide.ja.md#設定)を参照してください。

## ドキュメントとサポート

- [利用ガイド](https://github.com/SolitudeRA/opencode-tui-context/blob/main/docs/guide.ja.md)：インストール、設定、計算方法、トラブルシューティング、更新・削除。
- [コントリビューションガイド](https://github.com/SolitudeRA/opencode-tui-context/blob/main/CONTRIBUTING.ja.md)：開発環境、テスト、ソースコードの構成。
- [リリースガイド](https://github.com/SolitudeRA/opencode-tui-context/blob/main/docs/releasing.md)：パッケージの作成と公開。
- [Issues](https://github.com/SolitudeRA/opencode-tui-context/issues)：不具合の報告や機能の提案。

## ライセンス

[MIT](https://github.com/SolitudeRA/opencode-tui-context/blob/main/LICENSE) © opencode-tui-context contributors.
