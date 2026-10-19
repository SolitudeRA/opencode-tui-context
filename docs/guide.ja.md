# 利用ガイド

[README に戻る](../README.ja.md) · [English](guide.md) · [简体中文](guide.zh-CN.md) · 日本語

インストール方法、設定、使用量の計算、トラブルシューティングを説明します。通常の npm インストールだけなら、[README のクイックスタート](../README.ja.md#クイックスタート)から始められます。

- [インストールとパネルの表示](#クイックスタート)
- [パネルの見方](#パネルの見方)
- [設定](#設定)
- [使用量の計算方法](#使用量の計算方法)
- [トラブルシューティング](#トラブルシューティング)
- [更新と削除](#更新と削除)

## クイックスタート

### 前提条件

- **OpenCode V1 `>=1.18.31 <2` または V2 `>=2.0.32 <3`** が必要です。同じ `2.1.1` パッケージに両アダプターが含まれ、ホスト API に合わせて自動選択されます。検証の基準は V1 `1.18.31` と V2 `2.0.32` であり、宣言範囲の全バージョンで確認済みという意味ではありません。[package.json](../package.json) を参照してください。
- ソースからのインストールには **Git、[Bun](https://bun.sh/)、[Node.js](https://nodejs.org/)** が必要です。npm パッケージと ZIP はビルド不要です。
- V1 でも `2.1.1` に更新できます。既存のインストールを維持する場合は、`1.0.1` と[当時のガイド](https://github.com/SolitudeRA/opencode-tui-context/blob/v1.0.1/README.ja.md)も利用できます。

### npm からインストール

`opencode --version` を確認し、対応するコマンドを実行してください。

| ホスト | コマンド | 設定先 |
| --- | --- | --- |
| V1 | `opencode plugin -g opencode-tui-context@2.1.1` | グローバル `tui.json` の `plugin` 配列 |
| V2 | `opencode plugin add opencode-tui-context@2.1.1` | グローバル `cli.json` の `plugins` 配列 |

V1 は `-g` を省くとプロジェクトにインストールできます。[V1 プラグイン仕様](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/specs/tui-plugins.md#package-manifest-and-install)を参照してください。V2 の CLI 設定はグローバルのみです。[V2 プラグインコマンド](https://opencode.ai/v2/docs/cli/commands/#plugin)も参照してください。

OpenCode を V1 から V2 に更新する場合は、本プラグインのエントリーを `tui.json` から `cli.json` に移し、タプルを[オブジェクト形式](#設定)に変更します。他の設定とプラグインを残し、本プラグインの npm 版とローカル版を重複して登録しないでください。

### 代替方法：ビルド済み ZIP

リリースにはビルド済み ZIP が含まれています。npm が利用できない環境ではこちらを使えます。

1. [Releases](https://github.com/SolitudeRA/opencode-tui-context/releases) を開き、**Assets** から `opencode-tui-context-<version>.zip` をダウンロードします。GitHub が自動生成する **Source code** アーカイブはビルドが必要です。
2. アーカイブ内の `opencode-tui-context` ディレクトリを、`tui.json`（V1）または `cli.json`（V2）と同じ場所にある `local-plugins/` に展開します。既定のグローバル設定では `~/.config/opencode/local-plugins/`（Windows は `$HOME\.config\opencode\local-plugins\`）です。`package.json`、ルートの `tui.js`、`dist/` ディレクトリ全体を残してください。
3. 下記の[ローカルプラグイン設定](#ローカルインストールを有効にする)を追加し、OpenCode を再起動します。

### ソースからインストール

Git、Bun、Node.js が必要です。リポジトリをクローンし、パッケージをビルドします。

```sh
git clone https://github.com/SolitudeRA/opencode-tui-context.git
cd opencode-tui-context
bun install --frozen-lockfile
bun run build
```

ビルドすると `dist/tui.js`、`dist/tui-v1.js`、`dist/tui-v2.js` が生成されます。ルートの `tui.js` はローカル読み込みの入口です。

リポジトリのルートで、ビルド結果とマニフェストをグローバルのプラグインディレクトリへコピーします。

**macOS / Linux**

```sh
mkdir -p "$HOME/.config/opencode/local-plugins/opencode-tui-context"
cp -R dist package.json tui.js "$HOME/.config/opencode/local-plugins/opencode-tui-context/"
```

**Windows PowerShell**

```powershell
$pluginDir = Join-Path $HOME ".config/opencode/local-plugins/opencode-tui-context"
New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
Copy-Item -Path dist, package.json, tui.js -Destination $pluginDir -Recurse -Force
```

### ローカルインストールを有効にする

対応する設定ファイルの隣にプラグインを配置します。V1 は `tui.json`、V2 は `cli.json` を使います。既定のグローバルディレクトリは `~/.config/opencode/`（Windows は `$HOME\.config\opencode\`）です。`$XDG_CONFIG_HOME` が設定されている場合は `~/.config` の代わりに使います。

**V1 — `tui.json`**

```json
{
  "plugin": ["./local-plugins/opencode-tui-context"]
}
```

**V2 — `cli.json`**

```json
{
  "plugins": ["./local-plugins/opencode-tui-context"]
}
```

次の 5 ファイルをすべて残してください。ルートのエントリーと npm の `./tui` エクスポートは `dist/tui.js` を経由し、対応するアダプターを遅延読み込みします。一方のアダプターだけをコピーしないでください。コピー先にソースや `node_modules` は不要です。

```text
local-plugins/opencode-tui-context/
├── package.json
├── tui.js
└── dist/
    ├── tui.js
    ├── tui-v1.js
    └── tui-v2.js
```

パスはエントリーを含む設定ファイルがあるディレクトリを基準にします。設定先が異なる場合はコピー先を合わせるか、絶対パスを使ってください。Windows の JSON では `D:/Codeing/opencode-tui-context` のようにスラッシュを使えます。`~/...` を避け、完全なパスを指定してください。

### パネルを表示する

OpenCode を再起動し、セッションのサイドバーを表示します。**Context** パネルは既存のサイドバーに追加されます。対象のアシスタント使用量がまだない場合は `no usage snapshot yet` と表示されます。

- **V1：**プラグインマネージャーで `opencode-tui-context` を有効にします。内蔵コンテキストパネルを隠す場合は、`tui.json` の `plugin_enabled["internal:sidebar-context"]` を `false` にします。マネージャーに保存された状態が優先される場合があります。[有効状態の優先順位](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/specs/tui-plugins.md#tui-config)を参照してください。
- **V2：**`cli.json` の `session.sidebar` を `"auto"` にして、十分な幅のターミナルを使います。V1 の `plugin_enabled` は使いません。[サイドバー設定](https://opencode.ai/v2/docs/cli/config/#sessions)を参照してください。

## パネルの見方

**上のバー**は、モデルのコンテキストウィンドウを使用済み・予約分・空きに分けて表示します。**下のバー**は、使用済みトークンだけを 4 つの区分に分けて表示します。分母が異なるため、上のバーに空きが多くても、下のバーがいっぱいになることがあります。

| バー | 凡例 | セグメント | 意味 |
| --- | --- | --- | --- |
| 全体 | `u` | `used` | 入力 + キャッシュ読み取り + キャッシュ書き込み + 推論 + 出力 |
| 全体 | `r` | `reserved` | モデルの出力上限から報告済みの出力を引いた値。最小値はゼロ |
| 全体 | `f` | `free` | コンテキストウィンドウから使用済みと予約分を引いた値。最小値はゼロ |
| 内訳 | `c` | `cached` | キャッシュ読み取りトークン |
| 内訳 | `p` | `prompt` | 入力 + キャッシュ書き込みトークン |
| 内訳 | `t` | `think` | 推論トークン |
| 内訳 | `o` | `out` | 出力トークン |

タイトルには `used / window` を四捨五入したパーセントで表示します。凡例の数値には `17.5K` のような省略表記を使います。濃い `▓` のセルは使用済みまたは予約分、`░` のセルは全体バーの空き容量を表します。

幅が狭くなると、各凡例グループはまず数値をマーカーの下に移し、さらに狭くなると数値を隠し、最後にグループ全体を隠します。タイトルはパーセント表示を先に隠し、その後に `Context` を隠します。サイドバーを広げると詳細が再び表示されます。

各アダプターが対応するホストテーマを読み取り、配色の多くをテーマに合わせます。出力には固定の黄色（`#ffff00`）を使うため、ライトテーマではコントラストが低くなる場合があります。

## 設定

両アダプターで同じオプションを使えます。ホストに対応する既存のエントリーを編集し、バージョン接尾辞と他の設定は残してください。

**V1 — `tui.json`**

```json
{
  "plugin": [
    ["opencode-tui-context@2.1.1", {
      "barWidth": 24,
      "exclude": [],
      "showLegend": true
    }]
  ]
}
```

**V2 — `cli.json`**

```json
{
  "plugins": [
    {
      "package": "opencode-tui-context@2.1.1",
      "options": {
        "barWidth": 24,
        "exclude": [],
        "showLegend": true
      }
    }
  ]
}
```

ZIP またはソースからのインストールでは、対応する例のパッケージ名を `"./local-plugins/opencode-tui-context"` に置き換えます。既存のエントリーを編集し、重複して追加しないでください。

| オプション | 型 | 既定値 | 動作 |
| --- | --- | --- | --- |
| `barWidth` | `number` | `24` | 幅を測定する前の**パネル外寸の初期幅**です。四捨五入したうえで `8–120` に収めます。バーには枠線と余白を除いた 4 列分狭い幅を使います。測定後は実際のサイドバー幅に追従します。バーの幅を固定する設定ではありません。 |
| `exclude` | `string[]` | `[]` | `cached`、`prompt`、`think`、`out`、`reserved`、`free` の各セグメントとその凡例を非表示にします。`used` は非表示にできません。 |
| `showLegend` | `boolean` | `true` | 幅に余裕があるときに 2 つの凡例グループを表示します。`false` にすると凡例を隠し、バーとタイトルを残します。 |

オプションの型が不正な場合は既定値を使い、未知のセグメント ID や重複した ID は取り除きます。表示を簡素にするには `"showLegend": false`、末尾の空き部分を省くには `"exclude": ["free"]` を指定します。

セグメントを除外しても、使用済みトークンの合計やパーセントは変わりません。内訳バーでは、残ったセグメントを引き伸ばしてバーを埋めることもありません。**`free` を残して `reserved` を隠すと、予約分のセルが見た目上は末尾の空き部分に含まれますが、空きトークン数の計算では引き続き予約分を差し引きます。** バー末尾の長さと空きトークン数を比較する場合は、`reserved` を表示したままにしてください。

設定を変更したり、ビルド済みプラグインを差し替えたりした後は、OpenCode を再起動してください。

## 使用量の計算方法

プラグインは現在有効なコンテキストを末尾からたどり、数値の `tokens.output > 0` を持つ最新のアシスタントメッセージを探します。巻き戻したメッセージは対象外で、完了したコンパクションの境界より前には戻りません。コンパクション後は新しい使用量を待ち、それ以前の使用量やコンパクション要求自体のトークンは表示しません。上限はメッセージ自身のモデル識別子（V1 の `providerID` / `modelID`、V2 の `model.providerID` / `model.id`） で参照するため、その後モデルを切り替えても測定対象のモデルを使います。

```text
used     = input + cacheRead + cacheWrite + reasoning + output
prompt   = input + cacheWrite
window   = model.limit.context
reserved = max(0, model.limit.output - output)
free     = max(0, window - used - reserved)
percent  = min(100, round(used / window × 100))
```

欠落した、または不正なトークン数はゼロとして扱います。プラグインは各フィールドを自ら合計し、`tokens.total` は使いません。正の出力上限を取得できない場合、`reserved` はゼロになります。正のコンテキスト上限を取得できない場合、全体バーは空になり、`free` と表示上のパーセントはゼロになりますが、内訳バーにはトークンを表示できます。**この場合の `0% used` は、使用量がゼロという意味ではなく、容量が不明という意味です。**

`reserved` はモデルの出力上限をもとにした表示用の計算値です。OpenCode 内でトークンを実際に予約するものでも、次の応答を予測するものでも、自動圧縮のしきい値を表すものでもありません。数値は OpenCode とプロバイダーが報告する使用量データに依存し、プラグインがメッセージ本文をトークン化することはありません。他のターン、サブエージェント、ツール、メッセージのロールごとの集計は行わず、コマンドやカスタムツールも追加しません。

<details>
<summary>バーの丸め処理と更新動作</summary>

各セグメントには、利用可能な文字セル数に対する割合を四捨五入し、残り幅を上限としてセルを割り当てます。トークン数が正でも丸め結果がゼロになるセグメントには、未割り当て分や幅の広いセグメントから余地を確保できる場合、最低 1 セルを割り当てます。全体バーは `free` が除外されていなければ残りのセルを `free` で埋めますが、内訳バーでは丸めによる隙間をそのまま残します。そのため、セルの幅はおおよその比率を示すもので、特に小さなセグメントでは誤差が目立つことがあります。

V2 は Solid を通じてホストのリアクティブなキャッシュを読み取り、V1 はホストの状態とイベントに応じて更新します。パネルごとに幅を測定し、終了時にスロットと購読を解除します。どちらもポーリングは行いません。新しい応答に出力トークンが報告されるまでは、直前の対象スナップショットが表示される場合があります。

</details>

## トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| インストールコマンドが使えない | `opencode --version` と `opencode plugin --help` を確認してください。ホストに合う V1 または V2 のコマンドを選んでください。 |
| パネルが表示されない | 対応する設定（V1 は `tui.json`、V2 は `cli.json`）、プラグインの有効状態、サイドバーの表示を確認してください。ローカル版はルートの入口と `dist/` の 3 ファイルを残し、再起動します。 |
| `no usage snapshot yet` と表示される | 正の出力トークンを持つ対象メッセージがありません。巻き戻したメッセージと、完了したコンパクションより前の使用量は対象外です。 |
| トークンはあるが全体バーが空 / `0% used` になる | 対象メッセージを生成したモデルの正のコンテキスト上限を取得できていません。プロバイダーのメタデータを確認してください。 |
| 狭いサイドバーで数値やパーセントが消える | 収まらない情報は自動で隠れます。幅を広げてください。`barWidth` で測定済みの幅は上書きできません。 |
| 他のコンテキスト情報も表示される | このプラグインはパネルを追加します。ホストの内容や他のプラグインは無効にしません。 |
| 請求用の合計や次のプロンプトの値と違う | 1 つのアシスタント使用量のスナップショットであり、累積の請求額やトークナイザーの計測値ではありません。 |

解決しない場合は、OpenCode のバージョン、OS・ターミナル、オプション、最小限の再現手順を添えて [Issue を作成](https://github.com/SolitudeRA/opencode-tui-context/issues)してください。表示上の問題には、機密情報を伏せたスクリーンショットも添えてください。

## 更新と削除

**V1 npm：**既存のタプルオプションを保って更新するには：

```sh
opencode plugin -g opencode-tui-context@2.1.1 --force
```

**V2 npm：**`opencode plugin check` で更新を確認します。公開済みのバージョンを指定するには、`cli.json` 内の本プラグインの `package` 接尾辞だけを変更し、オプションは残します。更新コマンドは `opencode plugin update --help` を参照してください。

**ZIP：**設定のパスを変えず、インストール先のディレクトリ全体を置き換えます。**ソース：**未変更のチェックアウトを更新し、ビルドとコピーを繰り返します。その後 OpenCode を再起動してください。

削除するには、V1 の `tui.json` → `plugin` または V2 の `cli.json` → `plugins` から本プラグインのエントリーを削除し、再起動します。V2 は `opencode plugin remove opencode-tui-context` も使えます。V1 `1.18.31` にアンインストールコマンドはありません。ローカル版はコピーしたディレクトリも削除できます。他のプラグインや設定は残し、V1 の内蔵コンテキストパネルを無効にしていた場合は再度有効にしてください。
