# OpenCode

An opinionated fork of [OpenCode](https://github.com/anomalyco/opencode).

---

## Getting Started

### Requirements

- [Bun](https://bun.sh) 1.3+

### Installation

```bash
bun install
```

### Running

```bash
# Start the TUI
bun dev

# Start the headless API server
bun dev serve

# Start the web interface
bun dev web

# Run against a specific directory
bun dev <directory>
```

### Building a Standalone Executable

```bash
./packages/opencode/script/build.ts --single
```

Then run it with:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Replace `<platform>` with your platform (e.g., `darwin-arm64`, `linux-x64`).

### Agents

OpenCode includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

### Desktop App

To run the desktop app in development:

```bash
bun run --cwd packages/desktop dev
```

To create a production build:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

To test UI changes during development:

1. Start the OpenCode server (`bun dev serve`)
2. Run:

```bash
bun run --cwd packages/app dev
```

---

### Contributing

If you're interested in contributing to OpenCode, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.
