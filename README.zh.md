# OpenCode

[OpenCode](https://github.com/anomalyco/opencode) 的一个有主见的分支。

---

## 开始使用

### 要求

- [Bun](https://bun.sh) 1.3+

### 安装

```bash
bun install
```

### 运行

```bash
# 启动 TUI
bun dev

# 启动无头 API 服务器
bun dev serve

# 启动 Web 界面
bun dev web

# 在指定目录运行
bun dev <directory>
```

### 构建独立可执行文件

```bash
./packages/opencode/script/build.ts --single
```

然后运行：

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

将 `<platform>` 替换为您的平台（例如 `darwin-arm64`、`linux-x64`）。

### Agents

OpenCode 内置两种 Agent，可用 `Tab` 键快速切换：

- **build** - 默认模式，具备完整权限，适合开发工作
- **plan** - 只读模式，适合代码分析与探索
  - 默认拒绝修改文件
  - 运行 bash 命令前会询问
  - 便于探索未知代码库或规划改动

另外还包含一个 **general** 子 Agent，用于复杂搜索和多步任务，内部使用，也可在消息中输入 `@general` 调用。

### 桌面应用

在开发模式下运行桌面应用：

```bash
bun run --cwd packages/desktop dev
```

创建生产版本：

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

测试 UI 更改：

1. 启动 OpenCode 服务器（`bun dev serve`）
2. 运行：

```bash
bun run --cwd packages/app dev
```

---

### 参与贡献

如有兴趣贡献代码，请在提交 PR 前阅读 [贡献指南 (Contributing Docs)](./CONTRIBUTING.md)。
