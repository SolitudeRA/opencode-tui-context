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

- **OpenCode `>=1.18.0`**。[package.json](../package.json) で宣言している要件です。開発用 SDK は `1.18.31` に固定していますが、それ以降のすべてのホストバージョンで動作確認済みという意味ではありません。
- 以下の標準インストールコマンドは **OpenCode `1.18.31`** に照らして確認しています。古いバージョンでは `opencode plugin --help` を確認するか、OpenCode を更新してください。
- npm とビルド済み ZIP のインストールにはローカルでのビルドは不要です。ソースからのインストールにのみ **Git、[Bun](https://bun.sh/)、[Node.js](https://nodejs.org/)** が必要です。

### npm からインストール（推奨）

```sh
opencode plugin -g opencode-tui-context
```

OpenCode がビルド済みパッケージをダウンロードし、グローバルの `tui.json` に追加します。OpenCode を再起動すると読み込まれます。現在のプロジェクトだけにインストールする場合は `-g` を省略します。コマンドパレットから **Install plugin** を選び、`opencode-tui-context` を入力してグローバルスコープを選択することもできます。ホストの[インストールガイド](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/specs/tui-plugins.md#package-manifest-and-install)を参照してください。

ローカルインストールから移行する場合は、`tui.json` の古いパスエントリーを削除し、プラグインの重複を避けてください。

### 代替方法：ビルド済み ZIP

リリースにはビルド済み ZIP が含まれています。npm が利用できない環境ではこちらを使えます。

1. [Releases](https://github.com/SolitudeRA/opencode-tui-context/releases) を開き、**Assets** から `opencode-tui-context-<version>.zip` をダウンロードします。GitHub が自動生成する **Source code** アーカイブはビルドが必要です。
2. アーカイブ内の `opencode-tui-context` ディレクトリを、`tui.json` と同じ場所にある `local-plugins/` に展開します。既定のグローバル設定では `~/.config/opencode/local-plugins/`（Windows は `$HOME\.config\opencode\local-plugins\`）です。`package.json` と `dist/tui.js` をそのまま保ってください。
3. 下記の[ローカルプラグイン設定](#ローカルインストールを有効にする)を追加し、OpenCode を再起動します。

### ソースからインストール

Git、Bun、Node.js が必要です。リポジトリをクローンし、`dist/tui.js` をビルドします。

```sh
git clone https://github.com/SolitudeRA/opencode-tui-context.git
cd opencode-tui-context
bun install --frozen-lockfile
bun run build
```

ビルドすると `dist/tui.js` が生成されます。

リポジトリのルートで、ビルド結果とマニフェストをグローバルのプラグインディレクトリへコピーします。

**macOS / Linux**

```sh
mkdir -p "$HOME/.config/opencode/local-plugins/opencode-tui-context"
cp -R dist package.json "$HOME/.config/opencode/local-plugins/opencode-tui-context/"
```

**Windows PowerShell**

```powershell
$pluginDir = Join-Path $HOME ".config/opencode/local-plugins/opencode-tui-context"
New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
Copy-Item -Path dist, package.json -Destination $pluginDir -Recurse -Force
```

### ローカルインストールを有効にする

ZIP またはソースからインストールした場合は、既存の設定やプラグインを残したまま、`~/.config/opencode/tui.json`（Windows では `$HOME\.config\opencode\tui.json`）に次のエントリーを追加します。

```json
{
  "plugin": ["./local-plugins/opencode-tui-context"]
}
```

次の構成を保ってください。マニフェストの `./tui` エクスポートは `dist/tui.js` を参照します。コピー先にソースファイルや `node_modules` は不要です。

```text
local-plugins/opencode-tui-context/
├── package.json
└── dist/
    └── tui.js
```

パスは `tui.json` があるディレクトリを基準とした相対パスです。設定ファイルを別の場所に置いている場合は、コピー先を調整するか、プラグインの絶対パスを指定してください。Windows の JSON 内でも `D:/Codeing/opencode-tui-context` のようにスラッシュを使えます。JSON のプラグインエントリーには `~/...` を使わないでください。`1.18.31` のローダーは `~` を展開しません。ホストの[設定パス解決処理](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/src/config/plugin.ts#L38-L54)と[プラグインパス判定処理](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/src/plugin/shared.ts#L158-L176)を参照してください。

### パネルを表示する

設定先は **`tui.json`** です。`opencode.json` のサーバープラグイン一覧には追加しません。OpenCode を再起動し、セッションを開いてサイドバーを表示してください。アシスタントメッセージに出力トークンが報告されると、**Context** パネルに使用量が表示されます。それまでは `no assistant turns yet` と表示されます。

OpenCode 内蔵のコンテキストパネルを置き換える場合は、次の設定も追加します。

```json
{
  "plugin_enabled": {
    "internal:sidebar-context": false
  }
}
```

両方のパネルが表示される場合は、OpenCode のプラグインマネージャーに保存された有効・無効の状態を確認してください。保存済みの状態が設定ファイルより優先される場合があります。他のサイドバープラグインは有効なままで構いません。有効状態の優先順位については、ホストの [TUI プラグインガイド](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/specs/tui-plugins.md)を参照してください。

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

ほとんどの色はホストテーマから取得します。対応は `used` → `primary`、`cached` → `success`、`prompt` → `accent`、`think` → `secondary`、`reserved` → `textMuted`、`free` → `text` です。出力には固定の黄色（`#ffff00`）を使うため、ライトテーマではコントラストが低くなる場合があります。

## 設定

npm からインストールした場合、`tui.json` のパッケージエントリーを `[package, options]` のタプルに置き換えます。既存のエントリーに `@version` があり、そのバージョンを維持したい場合は接尾辞を残してください。

```json
{
  "plugin": [
    [
      "opencode-tui-context",
      {
        "barWidth": 24,
        "exclude": [],
        "showLegend": true
      }
    ]
  ]
}
```

ZIP またはソースからインストールした場合、この例のパッケージ名を `"./local-plugins/opencode-tui-context"` に置き換えます。既存のエントリーを編集し、重複して追加しないでください。

| オプション | 型 | 既定値 | 動作 |
| --- | --- | --- | --- |
| `barWidth` | `number` | `24` | 幅を測定する前の**パネル外寸の初期幅**です。四捨五入したうえで `8–120` に収めます。バーには枠線と余白を除いた 4 列分狭い幅を使います。測定後は実際のサイドバー幅に追従します。バーの幅を固定する設定ではありません。 |
| `exclude` | `string[]` | `[]` | `cached`、`prompt`、`think`、`out`、`reserved`、`free` の各セグメントとその凡例を非表示にします。`used` は非表示にできません。 |
| `showLegend` | `boolean` | `true` | 幅に余裕があるときに 2 つの凡例グループを表示します。`false` にすると凡例を隠し、バーとタイトルを残します。 |

オプションの型が不正な場合は既定値を使い、未知のセグメント ID や重複した ID は取り除きます。表示を簡素にするには `"showLegend": false`、末尾の空き部分を省くには `"exclude": ["free"]` を指定します。

セグメントを除外しても、使用済みトークンの合計やパーセントは変わりません。内訳バーでは、残ったセグメントを引き伸ばしてバーを埋めることもありません。**`free` を残して `reserved` を隠すと、予約分のセルが見た目上は末尾の空き部分に含まれますが、空きトークン数の計算では引き続き予約分を差し引きます。** バー末尾の長さと空きトークン数を比較する場合は、`reserved` を表示したままにしてください。

設定を変更したり、ビルド済みプラグインを差し替えたりした後は、OpenCode を再起動してください。

## 使用量の計算方法

プラグインは現在のセッションを末尾からたどり、数値の `tokens.output > 0` を持つ最新のアシスタントメッセージを探します。そのメッセージのトークン情報を読み取り、メッセージ自身の `providerID` / `modelID` に対応する上限を参照します。その後に別のモデルへ切り替えていても、測定対象のメッセージを生成したモデルを使います。

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

プラグインは `message.updated`、`message.part.updated`、`session.updated`、`session.idle` を購読します。50 ms の先行エッジスロットルにより、その間に発生したイベントは無視されます。ポーリングや、間隔の終了後に再更新するタイマーはありません。プラグインの終了処理で購読を解除します。新しい応答の出力トークンが報告されるまでは、前のスナップショットが表示される場合があります。

</details>

## トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| インストールコマンドが使えない | `opencode plugin --help` を確認してください。本ガイドの標準インストール手順は `1.18.31` に基づきます。OpenCode を更新するか、ローカルインストールを利用してください。 |
| npm でパッケージが見つからない | パッケージ名、指定バージョン、レジストリへの接続を確認してください。npm が利用できない場合は、ビルド済み ZIP を使えます。 |
| パネルが表示されない | OpenCode のバージョン、サイドバーの表示状態、`tui.json` のエントリー、プラグインマネージャーの有効状態を確認してください。ローカルインストールでは `package.json` + `dist/tui.js` の配置も確認します。変更後は再起動してください。 |
| `no assistant turns yet` と表示される | 正の出力トークン数を報告したアシスタントメッセージがまだありません。出力トークン数がゼロのメッセージは対象になりません。 |
| トークンは表示されるが全体バーが空 / `0% used` になる | 測定対象のメッセージを生成したモデルについて、正のコンテキスト上限を取得できていません。そのモデルのプロバイダーメタデータを確認してください。 |
| サイドバーを狭くすると数値やパーセントが消える | 幅に収まらない詳細情報は自動で非表示になります。ターミナルまたはサイドバーを広げてください。`barWidth` で測定済みの幅を上書きすることはできません。 |
| コンテキストパネルが 2 つ表示される | 内蔵の `internal:sidebar-context` パネル、または同じ情報を表示する別のプラグインを無効にしてください。`plugin_enabled` が効かないように見える場合は、プラグインマネージャーに保存された状態を確認します。 |
| 請求用の合計や次のプロンプトの値と一致しない | 表示しているのは、報告済みの 1 つのアシスタントメッセージのスナップショットです。複数ターンの合計でも、請求額の計算でも、トークナイザーによる計測でもありません。 |

解決しない場合は、OpenCode のバージョン、OS・ターミナル、プラグインのオプション、最小限の再現手順を添えて [Issue を作成](https://github.com/SolitudeRA/opencode-tui-context/issues)してください。表示上の問題には、機密情報を伏せたスクリーンショットも添えてください。

## 更新と削除

**npm：**`<version>` を公開済みのバージョンに置き換えて実行します。

```sh
opencode plugin -g "opencode-tui-context@<version>" --force
```

プロジェクト単位のインストールでは `-g` を省略します。OpenCode `1.18.31` では、`--force` が設定内のパッケージバージョンを置き換え、タプルのオプションは維持します。明示したバージョンは固定され、パッケージ名だけの場合は `latest` に追従します。更新後は OpenCode を再起動してください。ホストの[更新動作の説明](https://github.com/anomalyco/opencode/blob/v1.18.31/packages/opencode/specs/tui-plugins.md#package-manifest-and-install)を参照してください。

**ZIP：**新しいビルド済みアセットをダウンロードし、`tui.json` のパスを変えずにインストール先ディレクトリを置き換えます。**ソース：**ローカルで変更していないチェックアウトで `git pull --ff-only` を実行し、ビルドとコピーの手順を繰り返します。完了後、OpenCode を再起動します。

読み込みを停止するには、`tui.json` の `plugin` 配列からエントリーを削除し、再起動します。ローカルインストールの場合は、コピーした `local-plugins/opencode-tui-context` ディレクトリも削除できます。OpenCode `1.18.31` にプラグインのアンインストールコマンドはなく、設定を削除しても npm キャッシュは残ります。内蔵のコンテキストパネルを無効にしていた場合は、`plugin_enabled` またはプラグインマネージャーで再び有効にしてください。
