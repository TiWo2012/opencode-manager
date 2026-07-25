# OpenCode

En holdningspræget fork af [OpenCode](https://github.com/anomalyco/opencode).

---

## Kom i gang

### Krav

- [Bun](https://bun.sh) 1.3+

### Installation

```bash
bun install
```

### Kør

```bash
# Start TUI
bun dev

# Start headless API-server
bun dev serve

# Start webgrænseflade
bun dev web

# Kør i en bestemt mappe
bun dev <directory>
```

### Byg en selvstændig eksekverbar fil

```bash
./packages/opencode/script/build.ts --single
```

Kør derefter med:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Erstat `<platform>` med din platform (f.eks. `darwin-arm64`, `linux-x64`).

### Agents

OpenCode har to indbyggede agents, som du kan skifte mellem med `Tab`-tasten.

- **build** - Standard, agent med fuld adgang til udviklingsarbejde
- **plan** - Skrivebeskyttet agent til analyse og kodeudforskning
  - Afviser filredigering som standard
  - Spørger om tilladelse før bash-kommandoer
  - Ideel til at udforske ukendte kodebaser eller planlægge ændringer

Derudover findes der en **general**-subagent til komplekse søgninger og flertrinsopgaver.
Den bruges internt og kan kaldes via `@general` i beskeder.

### Desktop-app

Kør desktop-appen i udviklingstilstand:

```bash
bun run --cwd packages/desktop dev
```

Byg produktionsversion:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

Test UI-ændringer:

1. Start OpenCode-serveren (`bun dev serve`)
2. Kør:

```bash
bun run --cwd packages/app dev
```

---

### Bidrag

Hvis du vil bidrage til OpenCode, så læs vores [contributing docs](./CONTRIBUTING.md) før du sender en pull request.
