# 使用指南

[返回 README](../README.zh-CN.md) · [English](guide.md) · 简体中文 · [日本語](guide.ja.md)

安装方式、配置选项、用量计算与故障排查的完整参考。首次使用可先阅读 README 中的快速开始。

[安装](#安装) · [读懂面板](#读懂面板) · [配置](#配置) · [用量如何计算](#用量如何计算) · [常见问题](#常见问题) · [更新与移除](#更新与移除)

## 安装

### 环境要求

- **OpenCode `>=2.0.32 <3`**，以及本插件的 `2.x` 源码。开发 SDK 固定为 `@opencode/plugin@2.0.32`；声明范围不表示每个宿主版本均已实测。详见 [package.json](../package.json)。
- **`2.0.0` 尚未发布。** 本地体验请按下文从源码安装；npm 和 ZIP 步骤供 V2 版本发布后使用。
- V1 用户请固定使用 **`opencode-tui-context@1.0.1`**，并参考 [V1 README](https://github.com/SolitudeRA/opencode-tui-context/blob/v1.0.1/README.zh-CN.md)。V2 构建产物不能在 V1 中加载。
- 源码安装需要 **Git、[Bun](https://bun.sh/) 和 [Node.js](https://nodejs.org/)**；已发布的 npm 包和 ZIP 无需本地构建。

### npm 安装

`2.0.0` 发布后运行：

```sh
opencode plugin add opencode-tui-context@2.0.0
```

此命令将纯 CLI 插件写入全局 `cli.json`。OpenCode V2 只有全局 CLI 配置，不支持项目级 `cli.json`。详见宿主的[插件命令](https://opencode.ai/v2/docs/cli/commands/#plugin)和 [CLI 设置](https://opencode.ai/v2/docs/cli/config/)。

从 V1 迁移时，从 `tui.json` 中移除本插件旧条目，再将 V2 条目加入 `cli.json`。原有 `[package, options]` 元组需改为[对象形式](#配置)。保留其他设置和插件，避免同时加载本地副本与 npm 包。

### 备用方式：预构建 ZIP

Release 提供预构建 ZIP，可在 npm 不可用时安装：

1. 打开 [Releases](https://github.com/SolitudeRA/opencode-tui-context/releases)，在 **Assets** 中下载 `opencode-tui-context-<version>.zip`。GitHub 自动生成的 **Source code** 压缩包仍需编译。
2. 将压缩包中的 `opencode-tui-context` 目录解压到 `cli.json` 同级的 `local-plugins/` 中。默认全局位置是 `~/.config/opencode/local-plugins/`（Windows 为 `$HOME\.config\opencode\local-plugins\`）。保留其中的 `package.json`、根目录 `tui.js` 和 `dist/tui.js`。
3. 添加下方的[本地插件配置](#启用本地安装)，然后重启 OpenCode。

### 从源码安装

需要 Git、Bun 和 Node.js。克隆仓库并构建 `dist/tui.js`：

```sh
git clone https://github.com/SolitudeRA/opencode-tui-context.git
cd opencode-tui-context
bun install --frozen-lockfile
bun run build
```

构建产物为 `dist/tui.js`；仓库根目录的 `tui.js` 用于在本地安装时加载它。

在仓库根目录，根据系统将构建产物与清单复制到全局插件目录。

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

### 启用本地安装

将下列条目合并到全局 `cli.json`，保留其他设置和插件。默认位置为 `~/.config/opencode/cli.json`（Windows 为 `$HOME\.config\opencode\cli.json`）；设置了 `$XDG_CONFIG_HOME` 时，用它代替 `~/.config`。

```json
{
  "plugins": ["./local-plugins/opencode-tui-context"]
}
```

请完整保留下列三个文件。本地目录加载需要根目录 `tui.js`，npm 加载使用清单的 `./tui` 导出，两者都指向同一份 `dist/tui.js`。安装目录无需源码或 `node_modules`。

```text
local-plugins/opencode-tui-context/
├── package.json
├── tui.js
└── dist/
    └── tui.js
```

路径相对于 `cli.json` 所在目录解析。使用自定义配置位置时，请调整复制目录或指定插件绝对路径。Windows JSON 路径可用正斜杠，例如 `D:/Codeing/opencode-tui-context`；插件条目内使用完整路径，避免 `~/...`。详见 [CLI 插件配置](https://opencode.ai/v2/docs/cli/plugins/)。

### 显示面板

重启 OpenCode 并打开会话。在 `cli.json` 中将 `session.sidebar` 设为 `"auto"`，并使用足够宽的终端。**Context** 面板追加在 `sidebar.content` 末尾，与宿主原有内容共存，不会替换其他侧栏组件。

面板读取当前有效上下文内最近一份 assistant 用量；没有符合条件的数据，或压缩完成后尚未产生新的 assistant 用量时，显示 `no usage snapshot yet`。V2 不使用 V1 的 `plugin_enabled` 配置。详见宿主的[侧栏设置](https://opencode.ai/v2/docs/cli/config/#sessions)。

## 读懂面板

**上方总览条**把模型上下文窗口划分为已用、预留和剩余空间；**下方构成条**只拆分已用 token。两条的分母不同，因此上方仍有大量空闲时，下方也可能已经填满。

| 所属条 | 图例 | 分段 | 含义 |
| --- | --- | --- | --- |
| 总览 | `u` | `used` | 输入 + 缓存读取 + 缓存写入 + 推理 + 输出 |
| 总览 | `r` | `reserved` | 模型输出上限减去已报告的输出量，最低为零 |
| 总览 | `f` | `free` | 上下文窗口减去已用量和预留量，最低为零 |
| 构成 | `c` | `cached` | 缓存读取 token |
| 构成 | `p` | `prompt` | 输入 + 缓存写入 token |
| 构成 | `t` | `think` | 推理 token |
| 构成 | `o` | `out` | 输出 token |

标题中的百分比由 `used / window` 四舍五入得到。图例使用 `17.5K` 这样的紧凑计数。实心 `▓` 表示用量或预留量，`░` 表示总览条的剩余空间。

侧边栏变窄时，每组图例会依次将计数移到标记下方、隐藏计数、隐藏整组图例。标题会先隐藏百分比，再隐藏 `Context`。增大侧边栏宽度后，细节会重新显示。

大多数颜色随 V2 宿主主题变化，分别使用交互色、强调色、成功和信息文字色、弱化文字色与基础文字色。输出段固定使用黄色（`#ffff00`），在浅色主题下可能对比度不足。

## 配置

npm 安装时，在 `cli.json` 中使用对象形式。保留版本后缀即可固定版本：

```json
{
  "plugins": [
    {
      "package": "opencode-tui-context@2.0.0",
      "options": {
        "barWidth": 24,
        "exclude": [],
        "showLegend": true
      }
    }
  ]
}
```

ZIP 或源码安装请将示例中的包名替换为 `"./local-plugins/opencode-tui-context"`。修改已有条目即可，不要重复添加。

| 选项 | 类型 | 默认值 | 行为 |
| --- | --- | --- | --- |
| `barWidth` | `number` | `24` | 实测前的初始**面板外宽**，四舍五入后限制在 `8–120`。进度条会扣除边框和内边距占用的四列。取得测量值后，跟随侧边栏的实际宽度；此选项不能固定进度条宽度。 |
| `exclude` | `string[]` | `[]` | 隐藏指定分段及其图例。可选值为 `cached`、`prompt`、`think`、`out`、`reserved`、`free`；`used` 不可隐藏。 |
| `showLegend` | `boolean` | `true` | 空间允许时显示两组图例。设为 `false` 后保留进度条和标题，隐藏图例。 |

类型无效的选项回退到默认值；未知或重复的分段 ID 会被忽略。需要更精简的面板时可设 `"showLegend": false`；要隐藏剩余空间尾段，可设 `"exclude": ["free"]`。

排除分段不会改变已用总量或百分比，构成条中剩余的分段也不会重新放大以填满宽度。**如果隐藏 `reserved` 而保留 `free`，预留段的格子会并入视觉上的剩余空间，但剩余 token 计数仍然扣除预留量。**需要对照剩余条宽与数字时，请保留 `reserved`。

修改配置或替换构建产物后，请重启 OpenCode。

## 用量如何计算

插件在当前有效上下文中从后向前查找，选取最新一条 `tokens.output` 为数值且大于零的 assistant 消息。已回退的消息不参与计算，也不会越过已完成的压缩边界。压缩完成后，面板等待新的 assistant 用量快照，不显示压缩前的用量或压缩请求本身的 token。模型上限根据该消息的 `model.providerID` / `model.id` 查找，即使你后来切换了模型也是如此。

```text
used     = input + cacheRead + cacheWrite + reasoning + output
prompt   = input + cacheWrite
window   = model.limit.context
reserved = max(0, model.limit.output - output)
free     = max(0, window - used - reserved)
percent  = min(100, round(used / window × 100))
```

缺失或无效的 token 计数按零处理。插件自行加总这些字段，不使用 `tokens.total`。没有有效的正数输出上限时，`reserved` 为零；没有有效的正数上下文上限时，总览条为空，`free` 和显示的百分比均为零，构成条仍可显示 token。**此时 `0% used` 表示容量未知，不表示没有用量。**

`reserved` 是根据模型输出上限计算出的显示值。它不会在 OpenCode 中实际预留 token，也不预测下一次输出量或表示自动压缩阈值。计数取决于 OpenCode 和提供商报告的用量，插件不会对消息文本重新分词。它不汇总其他轮次、子代理、工具或消息角色的用量，也不新增命令或自定义工具。

<details>
<summary>条形取整与刷新细节</summary>

每个分段按比例获得四舍五入后的字符格数，最多使用当前剩余宽度。如果正数用量被取整为零格，会在剩余空间或较宽分段可让出格子时，补到至少一格。总览条把余下格子填充为 `free`，除非它被排除；构成条不填补取整后的空隙。因此条宽是近似展示，尤其是用量很小的分段。

面板通过 Solid 响应式读取 OpenCode V2 的会话、消息、模型和主题缓存。每个挂载面板独立测量宽度，没有轮询或事件节流；插件卸载时由宿主移除插槽和响应式计算。新回复尚未报告输出 token 时，面板可能仍然显示上一份符合条件的快照。

</details>

## 常见问题

| 现象 | 检查方法 |
| --- | --- |
| 安装命令不可用 | 运行 `opencode --version` 和 `opencode plugin --help`。当前插件需要 V2；继续使用 V1 时，请保留插件 `1.0.1`。 |
| npm 找不到 `2.0.0` | 此版本尚未发布，请使用包含 V2 改动的源码，不要用 V1 包替代。 |
| 没有面板 | 检查宿主版本、`cli.json` 条目和 `session.sidebar: "auto"`，并加宽终端。本地安装还需确认 `package.json` + 根目录 `tui.js` + `dist/tui.js` 布局，然后重启。 |
| 显示 `no usage snapshot yet` | 当前没有符合条件且输出 token 为正数的 assistant 消息；已回退消息和已完成压缩之前的用量会被排除。 |
| 有 token，但总览条为空 / 显示 `0% used` | 无法取得生成该消息的模型的正数上下文上限，请检查其提供商元数据。 |
| 窄侧栏中计数或百分比消失 | 响应式布局会隐藏放不下的信息。请加宽终端或侧栏；`barWidth` 不会覆盖实际测量宽度。 |
| 仍然显示其他上下文信息 | 本插件追加面板，不会停用宿主内容或其他插件。 |
| 与账单合计或下次提示词大小不一致 | 这里展示一份 assistant 用量快照，不累计账单，也不重新分词。 |

仍有问题时，请[提交 issue](https://github.com/SolitudeRA/opencode-tui-context/issues)，附上 OpenCode 版本、操作系统／终端、插件选项与最小复现步骤；显示问题可附脱敏截图。

## 更新与移除

**npm：**运行 `opencode plugin check` 检查可用更新。需要指定某个已发布 V2 版本时，仅修改 `cli.json` 中本插件的 `package` 版本后缀，保留选项并重启。宿主更新命令的参数见 `opencode plugin update --help`。V1 用户应继续固定 `1.0.1`。

**ZIP：**用新版 V2 产物替换安装目录，保留 `cli.json` 中的路径。**源码：**更新没有本地改动的工作副本，重新构建并复制产物，然后重启 OpenCode。

从全局配置移除 npm 条目：

```sh
opencode plugin remove opencode-tui-context
```

也可从 `cli.json` 的 `plugins` 数组中移除本插件条目后重启。本地安装随后可删除复制出的 `local-plugins/opencode-tui-context` 目录。请保留其他插件和 OpenCode 配置。
