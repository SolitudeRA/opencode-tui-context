# opencode-tui-context

**在 OpenCode 侧边栏，一眼看清上下文占用与 token 构成。**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/SolitudeRA/opencode-tui-context/blob/main/LICENSE)
[![OpenCode: >=1.18.0](https://img.shields.io/badge/OpenCode-%E2%89%A51.18.0-18181b)](#快速开始)

[English](https://github.com/SolitudeRA/opencode-tui-context/blob/main/README.md) · 简体中文 · [日本語](https://github.com/SolitudeRA/opencode-tui-context/blob/main/README.ja.md)

![上下文面板示意：已用 40%，上方显示已用、预留和剩余空间，下方显示缓存、提示、推理和输出 token 的构成。](https://raw.githubusercontent.com/SolitudeRA/opencode-tui-context/main/docs/assets/context-preview.svg)

*图中为示例数据与配色；实际颜色随 OpenCode 主题变化，输出段固定为黄色。*

- **双条视图**：上方看上下文窗口容量，下方看已用 token 的构成。
- **自动适应侧边栏**：进度条随宽度缩放，图例在空间不足时简化。
- **读取已有用量**：随会话更新，无需额外模型调用、tokenizer 或凭据。

## 快速开始

需要 **OpenCode `>=1.18.0`**；已在 Windows 上使用 **`1.18.31`** 验证真实安装与插件启用。

```sh
opencode plugin -g opencode-tui-context
```

OpenCode 会下载预构建包，并自动写入全局 `tui.json`，无需本地编译。仅为当前项目安装时，省略 `-g`。

重启 OpenCode，打开会话侧边栏。收到报告正数输出 token 的 assistant 回复后，**Context** 面板即可显示用量；此前显示 `no assistant turns yet`。

其他安装方式见[使用指南](https://github.com/SolitudeRA/opencode-tui-context/blob/main/docs/guide.zh-CN.md#安装)。若出现两个 Context 面板，可按[显示面板](https://github.com/SolitudeRA/opencode-tui-context/blob/main/docs/guide.zh-CN.md#显示面板)中的说明停用内置面板。

## 读懂面板

- **上方总览条**：显示上下文窗口的已用、输出预留与剩余空间。
- **下方构成条**：显示已用 token 中缓存、提示、推理和输出各自的占比。

| 所属条 | 图例 | 分段 | 含义 |
| --- | --- | --- | --- |
| 总览 | `u` | `used` | 已用 token 总量 |
| 总览 | `r` | `reserved` | 剩余输出预留（估算） |
| 总览 | `f` | `free` | 扣除已用与预留后的剩余空间 |
| 构成 | `c` | `cached` | 缓存读取 token |
| 构成 | `p` | `prompt` | 输入 + 缓存写入 token |
| 构成 | `t` | `think` | 推理 token |
| 构成 | `o` | `out` | 输出 token |

`reserved` 只是基于模型输出上限的显示估算，不会实际预留 token，也不表示自动压缩阈值。

面板反映的是**最近一条报告正数输出 token 的 assistant 消息快照**，并非整个会话的累计账单，也不是下一次提示词的精确计数。完整口径见[用量如何计算](https://github.com/SolitudeRA/opencode-tui-context/blob/main/docs/guide.zh-CN.md#用量如何计算)。

## 可选配置

默认配置即可使用。需要隐藏图例时，在 **`tui.json`** 中把已有插件条目改为：

```json
{
  "plugin": [
    ["opencode-tui-context", { "showLegend": false }]
  ]
}
```

请保留其他设置和插件；若已有条目带有固定版本后缀（如 `@1.0.1`），也请保留。修改原条目即可，不要重复添加。

| 选项 | 默认值 | 作用 |
| --- | --- | --- |
| `showLegend` | `true` | 显示两组图例；设为 `false` 可隐藏。 |
| `exclude` | `[]` | 隐藏指定分段及其图例。 |
| `barWidth` | `24` | 测量前的初始面板宽度；之后随侧边栏调整，不能固定进度条宽度。 |

修改后重启 OpenCode。全部选项、本地安装配置和显示边界见[完整配置](https://github.com/SolitudeRA/opencode-tui-context/blob/main/docs/guide.zh-CN.md#配置)。

## 文档与支持

- [使用指南](https://github.com/SolitudeRA/opencode-tui-context/blob/main/docs/guide.zh-CN.md)：ZIP／源码安装、配置、计算口径、常见问题、更新与移除。
- [贡献指南](https://github.com/SolitudeRA/opencode-tui-context/blob/main/CONTRIBUTING.zh-CN.md)：开发环境、验证命令与源码结构。
- [发布指南](https://github.com/SolitudeRA/opencode-tui-context/blob/main/docs/releasing.md)：打包、自动发布与安装验收。
- [提交 issue](https://github.com/SolitudeRA/opencode-tui-context/issues)：请附上 OpenCode 版本、操作系统、终端及复现步骤。

## 许可证

[MIT](https://github.com/SolitudeRA/opencode-tui-context/blob/main/LICENSE) © opencode-tui-context contributors.
