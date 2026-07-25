# OpenCode

[OpenCode](https://github.com/anomalyco/opencode) 的一個有主見的分支。

---

## 開始使用

### 要求

- [Bun](https://bun.sh) 1.3+

### 安裝

```bash
bun install
```

### 執行

```bash
# 啟動 TUI
bun dev

# 啟動無頭 API 伺服器
bun dev serve

# 啟動 Web 介面
bun dev web

# 在指定目錄運行
bun dev <directory>
```

### 建置獨立可執行檔

```bash
./packages/opencode/script/build.ts --single
```

然後運行：

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

將 `<platform>` 替換為您的平台（例如 `darwin-arm64`、`linux-x64`）。

### Agents

OpenCode 內建了兩種 Agent，您可以使用 `Tab` 鍵快速切換。

- **build** - 預設模式，具備完整權限的 Agent，適用於開發工作。
- **plan** - 唯讀模式，適用於程式碼分析與探索。
  - 預設禁止修改檔案。
  - 執行 bash 指令前會詢問權限。
  - 非常適合用來探索陌生的程式碼庫或規劃變更。

此外，OpenCode 還包含一個 **general** 子 Agent，用於處理複雜搜尋與多步驟任務。此 Agent 供系統內部使用，亦可透過在訊息中輸入 `@general` 來呼叫。

### 桌面應用程式

在開發模式下運行桌面應用程式：

```bash
bun run --cwd packages/desktop dev
```

建立正式版本：

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

測試 UI 變更：

1. 啟動 OpenCode 伺服器（`bun dev serve`）
2. 運行：

```bash
bun run --cwd packages/app dev
```

---

### 參與貢獻

如果您有興趣參與 OpenCode 的開發，請在提交 Pull Request 前先閱讀我們的 [貢獻指南 (Contributing Docs)](./CONTRIBUTING.md)。
