# OpenCode

Ein meinungsstarker Fork von [OpenCode](https://github.com/anomalyco/opencode).

---

## Loslegen

### Voraussetzungen

- [Bun](https://bun.sh) 1.3+

### Installation

```bash
bun install
```

### Ausführen

```bash
# TUI starten
bun dev

# Headless-API-Server starten
bun dev serve

# Weboberfläche starten
bun dev web

# In einem bestimmten Verzeichnis ausführen
bun dev <directory>
```

### Eigenständige ausführbare Datei erstellen

```bash
./packages/opencode/script/build.ts --single
```

Dann ausführen mit:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Ersetze `<platform>` durch deine Plattform (z.B. `darwin-arm64`, `linux-x64`).

### Agents

OpenCode enthält zwei eingebaute Agents, zwischen denen du mit der `Tab`-Taste wechseln kannst.

- **build** - Standard-Agent mit vollem Zugriff für Entwicklungsarbeit
- **plan** - Nur-Lese-Agent für Analyse und Code-Exploration
  - Verweigert Datei-Edits standardmäßig
  - Fragt vor dem Ausführen von bash-Befehlen nach
  - Ideal zum Erkunden unbekannter Codebases oder zum Planen von Änderungen

Außerdem ist ein **general**-Subagent für komplexe Suchen und mehrstufige Aufgaben enthalten.
Dieser wird intern genutzt und kann in Nachrichten mit `@general` aufgerufen werden.

### Desktop-App

Desktop-App im Entwicklungsmodus ausführen:

```bash
bun run --cwd packages/desktop dev
```

Produktions-Build erstellen:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

UI-Änderungen testen:

1. OpenCode-Server starten (`bun dev serve`)
2. Ausführen:

```bash
bun run --cwd packages/app dev
```

---

### Beitragen

Wenn du zu OpenCode beitragen möchtest, lies bitte unsere [Contributing Docs](./CONTRIBUTING.md), bevor du einen Pull Request einreichst.
