[English](README.md) | 简体中文 | [日本語](README.ja.md)

# opencode-tui-context

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

在 OpenCode 的 TUI 侧边栏里，把当前会话的上下文窗口占用画成两条分段进度条：一条总览条显示 `used` / `reserved` / `free`，一条构成条显示 `cached` / `prompt` / `think` / `out`。插件注册宿主提供的 `sidebar_content` 槽位，读取当前会话最后一条 assistant 消息的 token 统计与模型限额，算出各段占比并渲染。插件 id 为 `opencode-tui-context`。

## 功能

- 在侧边栏渲染两条宽度可配的进度条，上下各占一行：总览条以 `window` 为分母，分成 `used` / `reserved` / `free` 三段；构成条以 `used` 为分母，分成 `cached` / `prompt` / `think` / `out` 四段。
- 每条进度条下方各配一排字母图例：总览条是 `u` / `r` / `f`，构成条是 `c` / `p` / `t` / `o`。每个条目是一个与条同款的一格色块，色块与字母、字母与该段的紧凑计数之间各空一格。
- 在面板右上角给出百分比占用；token 总量由总览条那排图例（`u` / `r` / `f` 三项数字）承担，不单列一行。
- 会话有新消息时自动刷新：订阅 `message.updated`、`message.part.updated`、`session.updated`、`session.idle` 四个事件，重绘做 50ms 前置节流；卸载时清理全部订阅，不用定时轮询。
- 还没有 assistant 消息时显示 `no assistant turns yet`，不是空白，也不报错。

## 范围

本项目刻意保持最小范围，以下事情明确不做：面板不做工具级 token 排行，不做 token 趋势图，不拆分或展示子代理用量，不内置 tokenizer（例如 tiktoken），不注册自定义工具，也不提供 `/context` 命令，同样不做 SYSTEM/USER/ASSISTANT 这类角色归因。它只反映「最后一条携带 output token 的 assistant 消息」这一个快照。

## 显示

两条进度条的分段含义与颜色对照如下。

| 所属条 | segment id | 含义 | 颜色 token |
| --- | --- | --- | --- |
| 总览条 | `used` | input + cacheRead + cacheWrite + reasoning + output | `primary` |
| 总览条 | `reserved` | `limit.output - output` 的预留量 | `textMuted` |
| 总览条 | `free` | 窗口剩余 | `text` |
| 构成条 | `cached` | 缓存命中的输入 token（cache read） | `success` |
| 构成条 | `prompt` | input + cacheWrite | `accent` |
| 构成条 | `think` | reasoning | `secondary` |
| 构成条 | `out` | output | `#ffff00`（硬编码） |

除 `out` 外，颜色 token 就是宿主主题里的字段名，取值来自 `api.theme.current.<token>`；`out` 用的是硬编码的 `#ffff00`。

`think` 用 `secondary`，这是一种蓝色，色相约 215 度，它与面板里其余每个颜色的色相距离都不小于约 46 度。`out` 用硬编码的 `#ffff00`，即纯黄，色相约 60 度，之所以硬编码，是因为 opencode 的默认主题里没有亮黄色。主题自带的黄都离得太近：`warning`（`#f5a742`，色相约 34 度）和 `markdownEmph`（`#e5c07b`，色相约 39 度）离 `used` 段所用的 `primary`（色相约 24 度）只有 10 到 15 度，两格色块放在一起几乎分不出来，正是这个面板要避免的撞色；而柠檬黄绿的 `diffHighlightAdded`（`#b8db87`，色相约 85 度）偏绿，不够黄。硬编码也有代价：`#ffff00` 不跟随宿主主题，在浅色（light）主题下观感会不合适。面板上一共五个颜色（`u` / `c` / `p` / `t` / `o`），选色时以「任意两色之间的最小色相距离最大」为准。

面板最外层有一条 `borderSubtle` 色的边框，左右各留一列内边距。框内自上而下依次是标题行、总览条、构成条、第一排图例、第二排图例。标题行两端由 `space-between` 分列：左侧是 `Context` 标题，右端是占用百分比（形如 `42% used`）。

两条进度条都铺满整行，用点阵字符绘制：每一段按分到的格数重复对应字符并染上该段颜色。总览条以 `window` 为分母，`used` 与 `reserved` 是实心 `▓`（U+2593），`free` 是空心 `░`（U+2591）；未占满的余量全部补成末尾的 `free`，所以三段格数之和恰好等于条宽（除非 `free` 被排除）。构成条以 `used` 为分母，`cached`、`prompt`、`think`、`out` 四段一律实心 `▓`，并且刻意不补 `free` 尾巴，四段之和可能比条宽少 0 到 2 格，条右端允许留下这点空隙。

两排图例只在 `showLegend` 为 `true` 时出现。第一排对应总览条，依次是 `u` / `r` / `f`；第二排对应构成条，依次是 `c` / `p` / `t` / `o`。每个条目由三部分组成，相邻两部分之间空一格：一个与条同款的一格色块，非 `free` 段是实心 `▓`（U+2593），`free` 段是空心 `░`（U+2591）；接着是一个小写字母；最后是该段的紧凑计数（如 `17.4K`）。字母取所属段的颜色，计数统一用 `textMuted`。

被 `exclude` 排除的段会同时从它所属的条和对应图例条目里消失，字母与计数一并消失。右上角的百分比与总览条的 `used` 段同色（`primary`），不随占用分档变色。两条进度条的总列数都由面板实测宽度决定，会跟随实际可用宽度自适应：面板变宽时两条条一起变长，侧边栏收窄时两条条一起缩短，不会换行；右上角的百分比固定显示，不受条宽影响。

## 安装

前提：`opencode` 可用，版本满足「兼容性」一节的要求。本插件从源码构建后以本地目录形式加载，不经过任何包管理器。

```
git clone https://github.com/SolitudeRA/opencode-tui-context.git
cd opencode-tui-context
bun install
bun run build
mkdir -p ~/.config/opencode/local-plugins/opencode-tui-context
cp -r dist package.json ~/.config/opencode/local-plugins/opencode-tui-context/
```

最后一步只复制 `dist/` 与 `package.json`，本地方式用不到源码与开发依赖，不必把它们放进目标目录。

接着把目标目录写进 `~/.config/opencode/tui.json` 的 `plugin` 数组：

```json
{
  "plugin": ["~/.config/opencode/local-plugins/opencode-tui-context"]
}
```

`tui.json` 只在 opencode 启动时读取一次，不做热重载，改完要重启 `opencode` 才生效。

若维护者在 GitHub Release 上附带了构建好的 `tui.js`，可以直接下载后放进目标目录，跳过 `bun install` 与 `bun run build` 两步。


## 配置

选项写在 `plugin` 数组的元组第二项，形如 `["<spec>", { ... }]`，`<spec>` 是本地目录路径。

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

| 选项 | 默认值 | 规则与回退 |
| --- | --- | --- |
| `barWidth` | `24` | 面板实测宽度出来之前的初始条宽（字符数）。先四舍五入，再夹到 `8-120`。非数字或非有限值（`NaN`、`±Infinity`）回退到 `24`；`0` 会被夹到 `8`，`999` 夹到 `120`。首帧之后条宽由面板实测宽度决定并自动跟随，`barWidth` 只在尚未测量时兜底。 |
| `exclude` | `[]` | 要从两条进度条和对应图例里隐藏的 segment id 列表。只接受 `cached`、`prompt`、`think`、`out`、`reserved`、`free` 六个值，非法值被丢掉，重复值去重并保留首次出现的顺序。非数组回退到 `[]`。 |
| `showLegend` | `true` | 是否显示两排字母图例。非布尔值回退到 `true`。设为 `false` 时只隐藏两排图例，两条进度条与右上角百分比保留。 |

所有选项都经过规范化。配置缺省、为 `null`、类型不对，甚至整个选项对象根本不是对象，都不会抛错，一律回退到上表默认值。

## 计算口径

设 `input`、`cacheRead`、`cacheWrite`、`reasoning`、`output` 为被测量消息的 token 统计，`limit.context` 与 `limit.output` 为该消息所用模型的上下文与输出限额。各量定义如下：

```
used     = input + cacheRead + cacheWrite + reasoning + output
window   = limit.context
reserved = max(0, limit.output - output)
free     = max(0, window - used - reserved)
prompt   = input + cacheWrite
percent  = min(100, round(used / window * 100))
```

几点说明：

- 被测量的对象是会话里最新的一条携带 `tokens.output > 0` 的 assistant 消息。从消息列表尾部往前找，第一条同时满足 `role === "assistant"` 与 `tokens.output > 0` 的消息就是数据源。
- 当 `window` 为 `0`（模型限额拿不到）时，`free` 与 `percent` 都取 `0`，总览条因为没有分母而整体留空，构成条与两排图例照常渲染。
- `reserved` 只在 `limit.output > 0` 时计算，否则为 `0`。
- 总览条的 `used` 与 `reserved` 按 `round(段 token / window * barWidth)` 分配，未占满的余量全部补成末尾的 `free` 段（除非 `free` 在 `exclude` 里），三段之和恰好等于条宽。
- 构成条的 `cached`、`prompt`、`think`、`out` 按 `round(段 token / used * barWidth)` 分配，刻意不补 `free` 尾巴，四段之和可能比条宽少 0 到 2 格。
- 视觉保底对两条条都生效：一个 `token > 0` 的段若四舍五入后不足 `1` 格，会被补足为 `1` 格，避免整段从条里消失。补格时先扣未分配的余量，余量不足则从当前最宽的段借一格；若两者都腾不出格子，该段仍不显示。
- 只有 token 数 `> 0` 的段才会进入条。两排图例都会列出所有未被排除的段，因此 token 数为 `0` 的段仍会以计数 `0` 出现在图例里。

## 兼容性

- 实测的 `opencode` 版本：`1.18.31`；`package.json` 的 engines 对它的要求是 `>=1.18.0`。
- `@opentui/solid` 在本项目实测解析到的版本：`0.4.5`；`package.json` 对它的 peer 要求是 `>=0.4.5`。
- 宿主会把本插件对 `@opentui/solid` 与 `solid-js` 的导入重写到宿主自带的模块上。也就是说，插件的 `devDependencies` 版本只影响构建产物的形状，不决定运行时的模块解析；运行时用的是宿主自己的那一份。
- 本插件没有运行时依赖（`dependencies` 为空），产物只引用宿主提供的模块与 Node 内置模块。

## 与其它插件共存

`sidebar_content` 是宿主提供的一个共享槽位，多个插件可以同时往同一个槽位注册内容。本插件以 `order: 60` 注册该槽位。`order` 的值定义在插件实现里，不写在 `tui.json` 中。

若另一个插件也往 `sidebar_content` 写上下文面板，两者同时启用时侧边栏会出现两个内容重叠的面板。此时保留其中一个即可：把不需要的那个从 `tui.json` 的 `plugin` 数组里移除。

宿主内置的上下文面板同样注册这个槽位。若不想让它与本插件重叠，可在 `tui.json` 的 `plugin_enabled` 里把 `"internal:sidebar-context"` 设为 `false`。本插件在 `plugin_enabled` 里没有条目，因此保持启用。

## 停用与卸载

只想暂时停用、保留文件以便日后重新启用：打开 `~/.config/opencode/tui.json`，从 `plugin` 数组里移除 `~/.config/opencode/local-plugins/opencode-tui-context` 这一项即可。如果想把宿主内置的上下文面板请回来，再在 `plugin_enabled` 里把 `"internal:sidebar-context"` 设为 `true`。

彻底卸载：先按上面的步骤停用，再删掉本地目录：

```
rm -rf ~/.config/opencode/local-plugins/opencode-tui-context
```

改 `tui.json` 时最好先做一次备份，记下哈希：

```
B=/tmp/tui.json.before-$(date +%s%N)
cp ~/.config/opencode/tui.json "$B"
sha256sum "$B"
```

需要还原时把备份复制回去，再校验哈希与备份一致：

```
cp /tmp/tui.json.before-<timestamp> ~/.config/opencode/tui.json
sha256sum ~/.config/opencode/tui.json
```

`tui.json` 只在 opencode 启动时读取一次，不做热重载，改完要重启 `opencode` 才生效。

## 许可证

本项目以 MIT 许可证发布，完整条款见 [LICENSE](LICENSE)。
