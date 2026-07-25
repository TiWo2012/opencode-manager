# OpenCode

En meningssterk fork av [OpenCode](https://github.com/anomalyco/opencode).

---

## Kom i gang

### Krav

- [Bun](https://bun.sh) 1.3+

### Installasjon

```bash
bun install
```

### Kjør

```bash
# Start TUI
bun dev

# Start headless API-server
bun dev serve

# Start webgrensesnitt
bun dev web

# Kjør i en bestemt mappe
bun dev <directory>
```

### Bygg en selvstendig kjørbar fil

```bash
./packages/opencode/script/build.ts --single
```

Kjør deretter med:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Erstatt `<platform>` med din plattform (f.eks. `darwin-arm64`, `linux-x64`).

### Agents

OpenCode har to innebygde agents du kan bytte mellom med `Tab`-tasten.

- **build** - Standard, agent med full tilgang for utviklingsarbeid
- **plan** - Skrivebeskyttet agent for analyse og kodeutforsking
  - Nekter filendringer som standard
  - Spør om tillatelse før bash-kommandoer
  - Ideell for å utforske ukjente kodebaser eller planlegge endringer

Det finnes også en **general**-subagent for komplekse søk og flertrinnsoppgaver.
Den brukes internt og kan kalles via `@general` i meldinger.

### Desktop-app

Kjør desktop-appen i utviklermodus:

```bash
bun run --cwd packages/desktop dev
```

Bygg produksjonsversjon:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

Test UI-endringer:

1. Start OpenCode-serveren (`bun dev serve`)
2. Kjør:

```bash
bun run --cwd packages/app dev
```

---

### Bidra

Hvis du vil bidra til OpenCode, les [contributing docs](./CONTRIBUTING.md) før du sender en pull request.
