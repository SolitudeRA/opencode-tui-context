[English](README.md) | [简体中文](README.zh-CN.md) | 日本語

# opencode-tui-context

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

OpenCode の TUI サイドバーに、現在のセッションのコンテキストウィンドウ使用量を 2 本のセグメントバーで描画します。1 本目は `used` / `reserved` / `free` を示す全体バー、2 本目は `cached` / `prompt` / `think` / `out` を示す構成バーです。このプラグインはホストが提供する `sidebar_content` スロットに登録し、現在のセッションの最後の assistant メッセージの token 統計とモデルの上限を読み取って、各セグメントの割合を計算して描画します。プラグイン id は `opencode-tui-context` です。

## 機能

- サイドバーに幅を設定できる 2 本のバーを、上下 1 行ずつで描画します。全体バーは `window` を分母に `used` / `reserved` / `free` の 3 セグメントへ、構成バーは `used` を分母に `cached` / `prompt` / `think` / `out` の 4 セグメントへ分かれます。
- 各バーの下に 1 行の英字レジェンドが付きます。全体バーは `u` / `r` / `f`、構成バーは `c` / `p` / `t` / `o` の順です。各項目はバーと同じ 1 セルの色ブロックで、色ブロックと英字、英字とそのセグメントの省略カウントの間にそれぞれ 1 スペース入ります。
- パネル右上に使用率をパーセントで表示します。token の合計は全体バーのレジェンド（`u` / `r` / `f` の 3 つの数値）が担い、独立した行は設けません。
- セッションに新しいメッセージがあると自動更新します。`message.updated`、`message.part.updated`、`session.updated`、`session.idle` の 4 イベントを購読し、再描画には 50ms の先行スロットルをかけます。アンマウント時にはすべての購読を解除し、定期ポーリングは使いません。
- assistant メッセージがまだないときは `no assistant turns yet` と表示します。空白にはならず、エラーも出ません。

## スコープ

本プロジェクトは意図的に範囲を最小限に保っています。次のことは明確にやりません。パネルはツール単位の token ランキングを行わず、token の推移グラフも作らず、サブエージェントの使用量の分割や表示もせず、tokenizer（例えば tiktoken）を内蔵せず、カスタムツールも登録せず、`/context` コマンドも提供せず、SYSTEM/USER/ASSISTANT のようなロール別の内訳も行いません。反映するのは「output token を持つ最後の assistant メッセージ」という 1 つのスナップショットだけです。

## 表示

2 本のバーのセグメントの意味と色の対応は次のとおりです。

| バー | segment id | 意味 | 色 token |
| --- | --- | --- | --- |
| 全体バー | `used` | input + cacheRead + cacheWrite + reasoning + output | `primary` |
| 全体バー | `reserved` | `limit.output - output` の予約量 | `textMuted` |
| 全体バー | `free` | ウィンドウの残り | `text` |
| 構成バー | `cached` | キャッシュヒットした入力 token（cache read） | `success` |
| 構成バー | `prompt` | input + cacheWrite | `accent` |
| 構成バー | `think` | reasoning | `secondary` |
| 構成バー | `out` | output | `#ffff00`（ハードコード） |

`out` 以外の色 token はホストテーマのフィールド名そのもので、値は `api.theme.current.<token>` から取ります。`out` はハードコードした `#ffff00` を使います。

`think` は `secondary`（青系、色相は約 215 度）を使い、パネル内の他のどの色とも色相が約 46 度以上離れています。`out` はハードコードした `#ffff00`、つまり純粋な黄色（色相は約 60 度）を使います。ハードコードしたのは、opencode の既定テーマに明るい黄色がないためです。テーマ標準の黄色はどれも近すぎます。`warning`（`#f5a742`、色相約 34 度）と `markdownEmph`（`#e5c07b`、色相約 39 度）は、`used` セグメントが使う `primary`（色相約 24 度）からわずか 10 から 15 度しか離れておらず、2 つのセルを並べるとほとんど見分けがつきません。これはまさにこのパネルが避けたい色衝突です。またレモンイエローの `diffHighlightAdded`（`#b8db87`、色相約 85 度）は緑寄りで、黄色としては不十分です。ハードコードには代償もあります。`#ffff00` はホストテーマに追従しないため、ライトテーマでは見栄えが適切でないことがあります。パネル上の色は全部で 5 つ（`u` / `c` / `p` / `t` / `o`）で、色選びは「任意の 2 色間の最小色相距離を最大にする」ことを基準にしています。

パネルの最外郭には `borderSubtle` 色の枠があり、左右に 1 列ずつ内側余白があります。枠内は上から順にタイトル行、全体バー、構成バー、1 行目のレジェンド、2 行目のレジェンドです。タイトル行の両端は `space-between` で配置し、左は `Context` タイトル、右端は使用率（`42% used` の形）です。

2 本のバーはどちらも行全体を埋め、ブロック文字で描画します。各セグメントは割り当てられたセル数だけ対応する文字を繰り返し、そのセグメントの色で塗ります。全体バーは `window` を分母にし、`used` と `reserved` は塗りつぶしの `▓`（U+2593）、`free` は中抜きの `░`（U+2591）です。埋まらなかった余りはすべて末尾の `free` に足されるので、3 セグメントのセル数の合計はちょうどバー幅になります（`free` が除外されている場合を除く）。構成バーは `used` を分母にし、`cached`、`prompt`、`think`、`out` の 4 セグメントはすべて塗りつぶしの `▓` で、`free` の末尾は意図的に足しません。4 セグメントの合計はバー幅より 0 から 2 セル少なくなることがあり、バー右端にその分の隙間が残ります。

2 行のレジェンドは `showLegend` が `true` のときだけ表示されます。1 行目は全体バーに対応し、`u` / `r` / `f` の順です。2 行目は構成バーに対応し、`c` / `p` / `t` / `o` の順です。各項目は 3 つの部分からなり、隣り合う部分の間には 1 スペース入ります。バーと同じ 1 セルの色ブロック（`free` 以外は塗りつぶしの `▓`（U+2593）、`free` は中抜きの `░`（U+2591））、続いて小文字の英字、最後にそのセグメントの省略カウント（`17.4K` など）です。英字は所属セグメントの色を取り、カウントは一律 `textMuted` を使います。

`exclude` で除外されたセグメントは、所属するバーと対応するレジェンド項目の両方から消え、英字とカウントも一緒に消えます。右上のパーセントは全体バーの `used` セグメントと同じ色（`primary`）で、使用量による色分けはしません。2 本のバーの総列数はどちらもパネルの実測幅で決まり、実際の使用可能幅に追従します。パネルが広がれば 2 本とも長くなり、サイドバーが狭まれば 2 本とも短くなり、折り返しはしません。右上のパーセントは常に表示され、バー幅の影響を受けません。

## インストール

前提：`opencode` が使えること、バージョンが「互換性」の節の要件を満たすこと。このプラグインはソースからビルドしたものをローカルディレクトリとして読み込む方式で、パッケージマネージャは経由しません。

```
git clone https://github.com/owner/opencode-tui-context.git
cd opencode-tui-context
bun install
bun run build
mkdir -p ~/.config/opencode/local-plugins/opencode-tui-context
cp -r dist package.json ~/.config/opencode/local-plugins/opencode-tui-context/
```

最後の手順は `dist/` と `package.json` だけをコピーします。ローカル方式ではソースと開発依存は不要なので、コピー先に入れる必要はありません。

次に、コピー先のディレクトリを `~/.config/opencode/tui.json` の `plugin` 配列に書きます。

```json
{
  "plugin": ["~/.config/opencode/local-plugins/opencode-tui-context"]
}
```

`tui.json` は opencode の起動時に 1 度だけ読まれ、ホットリロードはしません。変更後は `opencode` を再起動すると反映されます。

GitHub Release にビルド済みの `tui.js` が添付されている場合は、それをダウンロードしてコピー先に置けば、`bun install` と `bun run build` の 2 手順を省略できます。

コマンド内の `owner` は GitHub アカウントのプレースホルダです。正式リリース前に実際のアカウントへ置き換える必要があり、置き換え箇所は `package.json` と 3 つの README です。

## 設定

オプションは `plugin` 配列のタプルの 2 番目に書きます。形は `["<spec>", { ... }]` で、`<spec>` はローカルディレクトリのパスです。

```json
{
  "plugin": [
    [
      "~/.config/opencode/local-plugins/opencode-tui-context",
      { "barWidth": 40, "exclude": ["free"], "showLegend": true }
    ]
  ]
}
```

| オプション | 既定値 | ルールとフォールバック |
| --- | --- | --- |
| `barWidth` | `24` | パネルの実測幅が出るまでの初期バー幅（文字数）。まず四捨五入し、次に `8-120` にクランプします。数値でない場合や有限でない値（`NaN`、`±Infinity`）は `24` にフォールバックします。`0` は `8` に、`999` は `120` にクランプされます。初回フレーム以降のバー幅はパネルの実測幅で決まり自動追従するため、`barWidth` は未計測時のフォールバックとしてだけ働きます。 |
| `exclude` | `[]` | 2 本のバーと対応するレジェンドから隠す segment id のリスト。受け付けるのは `cached`、`prompt`、`think`、`out`、`reserved`、`free` の 6 つのみで、不正な値は捨てられ、重複は除去して最初に現れた順序を保ちます。配列でない場合は `[]` にフォールバックします。 |
| `showLegend` | `true` | 2 行の英字レジェンドを表示するかどうか。真偽値でない場合は `true` にフォールバックします。`false` にすると 2 行のレジェンドだけが隠れ、2 本のバーと右上のパーセントは残ります。 |

すべてのオプションは正規化されます。設定が欠けている場合、`null` の場合、型が違う場合、さらにはオプションオブジェクトがオブジェクトですらない場合でも例外は投げず、必ず上の表の既定値にフォールバックします。

## 計算方法

計測対象のメッセージの token 統計を `input`、`cacheRead`、`cacheWrite`、`reasoning`、`output`、そのメッセージが使ったモデルのコンテキスト上限と出力上限を `limit.context`、`limit.output` とします。各量の定義は次のとおりです。

```
used     = input + cacheRead + cacheWrite + reasoning + output
window   = limit.context
reserved = max(0, limit.output - output)
free     = max(0, window - used - reserved)
prompt   = input + cacheWrite
percent  = min(100, round(used / window * 100))
```

補足：

- 計測対象はセッション内で最新の、`tokens.output > 0` を持つ assistant メッセージです。メッセージ一覧を末尾から前にたどり、`role === "assistant"` と `tokens.output > 0` を同時に満たす最初のメッセージがデータ源になります。
- `window` が `0` のとき（モデル上限が取得できないとき）は `free` と `percent` がともに `0` になり、全体バーは分母がないため全体が空になり、構成バーと 2 行のレジェンドは通常どおり描画されます。
- `reserved` は `limit.output > 0` のときだけ計算し、それ以外は `0` です。
- 全体バーの `used` と `reserved` は `round(セグメント token / window * barWidth)` で配分し、埋まらなかった余りはすべて末尾の `free` セグメントに足します（`free` が `exclude` にある場合を除く）。3 セグメントの合計はちょうどバー幅になります。
- 構成バーの `cached`、`prompt`、`think`、`out` は `round(セグメント token / used * barWidth)` で配分し、`free` の末尾は意図的に足しません。4 セグメントの合計はバー幅より 0 から 2 セル少なくなることがあります。
- 視覚的な下限は 2 本のバーの両方に効きます。`token > 0` のセグメントが四捨五入で `1` セル未満になる場合、`1` セルに引き上げ、セグメントがバーとレジェンドから消えるのを防ぎます。セルを補うときはまず未配分の余りから引き、余りが足りなければ現在最も幅の広いセグメントから 1 セル借ります。どちらからもセルを出せない場合、そのセグメントは表示されません。
- token 数が `> 0` のセグメントだけがバーに入ります。両方のレジェンド行は除外されていないセグメントをすべて並べるため、token 数が `0` のセグメントも `0` という表示でレジェンドに現れます。

## 互換性

- 実測した `opencode` のバージョンは `1.18.31` で、`package.json` の engines が要求するのは `>=1.18.0` です。
- `@opentui/solid` が本プロジェクトで実際に解決されたバージョンは `0.4.5` で、`package.json` の peer 要求は `>=0.4.5` です。
- ホストは本プラグインの `@opentui/solid` と `solid-js` のインポートを、ホスト自身が持つモジュールへ書き換えます。つまりプラグインの `devDependencies` のバージョンはビルド成果物の形に影響するだけで、実行時のモジュール解決は決めません。実行時はホスト自身のものを使います。
- 本プラグインに実行時依存はありません（`dependencies` は空）。成果物はホストが提供するモジュールと Node 組み込みモジュールだけを参照します。

## 他のプラグインとの共存

`sidebar_content` はホストが提供する共有スロットで、複数のプラグインが同じスロットに内容を登録できます。本プラグインはこのスロットに `order: 60` で登録します。`order` の値はプラグインの実装で定義され、`tui.json` には書きません。

別のプラグインも `sidebar_content` にコンテキストパネルを書いている場合、両方を有効にするとサイドバーに内容の重なったパネルが 2 つ現れます。そのときはどちらか一方だけを残してください。不要な方を `tui.json` の `plugin` 配列から外します。

ホスト内蔵のコンテキストパネルも同じスロットに登録します。本プラグインと重ねたくない場合は、`tui.json` の `plugin_enabled` で `"internal:sidebar-context"` を `false` にします。本プラグインは `plugin_enabled` に項目がないため、有効のままです。

## 無効化とアンインストール

一時的に無効化するだけで、ファイルを残して後で再有効化したい場合：`~/.config/opencode/tui.json` を開き、`plugin` 配列から `~/.config/opencode/local-plugins/opencode-tui-context` の項目を外すだけです。ホスト内蔵のコンテキストパネルを戻したい場合は、`plugin_enabled` で `"internal:sidebar-context"` を `true` にします。

完全にアンインストールする場合：まず上の手順で無効化し、次にローカルディレクトリを削除します。

```
rm -rf ~/.config/opencode/local-plugins/opencode-tui-context
```

`tui.json` を変更するときは、先にバックアップを取り、ハッシュを記録しておくのがよいでしょう。

```
B=/tmp/tui.json.before-$(date +%s%N)
cp ~/.config/opencode/tui.json "$B"
sha256sum "$B"
```

復元するときはバックアップをコピーし直し、ハッシュがバックアップと一致することを確認します。

```
cp /tmp/tui.json.before-<timestamp> ~/.config/opencode/tui.json
sha256sum ~/.config/opencode/tui.json
```

`tui.json` は opencode の起動時に 1 度だけ読まれ、ホットリロードはしません。変更後は `opencode` を再起動すると反映されます。

## ライセンス

本プロジェクトは MIT ライセンスで公開されています。全文は [LICENSE](LICENSE) を参照してください。
