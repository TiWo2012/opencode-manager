# OpenCode

[OpenCode](https://github.com/anomalyco/opencode) のオピニオンフォルクです。

---

## はじめに

### 必要要件

- [Bun](https://bun.sh) 1.3+

### インストール

```bash
bun install
```

### 実行

```bash
# TUI を起動
bun dev

# ヘッドレス API サーバーを起動
bun dev serve

# Web インターフェースを起動
bun dev web

# 特定のディレクトリで実行
bun dev <directory>
```

### スタンドアロンの実行可能ファイルをビルド

```bash
./packages/opencode/script/build.ts --single
```

然后运行：

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

`<platform>` を使用しているプラットフォームに置き換えてください（例：`darwin-arm64`、`linux-x64`）。

### Agents

OpenCode には組み込みの Agent が2つあり、`Tab` キーで切り替えられます。

- **build** - デフォルト。開発向けのフルアクセス Agent
- **plan** - 分析とコード探索向けの読み取り専用 Agent
  - デフォルトでファイル編集を拒否
  - bash コマンド実行前に確認
  - 未知のコードベース探索や変更計画に最適

また、複雑な検索やマルチステップのタスク向けに **general** サブ Agent も含まれています。
内部的に使用されており、メッセージで `@general` と入力して呼び出せます。

### デスクトップアプリ

開発モードでデスクトップアプリを実行：

```bash
bun run --cwd packages/desktop dev
```

プロダクションビルドを作成：

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

UI の変更をテスト：

1. OpenCode サーバーを起動（`bun dev serve`）
2. 実行：

```bash
bun run --cwd packages/app dev
```

---

### コントリビュート

OpenCode に貢献したい場合は、Pull Request を送る前に [contributing docs](./CONTRIBUTING.md) を読んでください。
