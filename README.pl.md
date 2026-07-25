# OpenCode

Opinionated fork [OpenCode](https://github.com/anomalyco/opencode).

---

## Początek

### Wymagania

- [Bun](https://bun.sh) 1.3+

### Instalacja

```bash
bun install
```

### Uruchamianie

```bash
# Uruchom TUI
bun dev

# Uruchom serwer API headless
bun dev serve

# Uruchom interfejs web
bun dev web

# Uruchom w konkretnym katalogu
bun dev <directory>
```

### Budowanie samodzielnego pliku wykonywalnego

```bash
./packages/opencode/script/build.ts --single
```

Następnie uruchom:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Zamień `<platform>` na swoją platformę (np. `darwin-arm64`, `linux-x64`).

### Agents

OpenCode zawiera dwóch wbudowanych agentów, między którymi możesz przełączać się klawiszem `Tab`.

- **build** - Domyślny agent z pełnym dostępem do pracy developerskiej
- **plan** - Agent tylko do odczytu do analizy i eksploracji kodu
  - Domyślnie odmawia edycji plików
  - Pyta o zgodę przed uruchomieniem komend bash
  - Idealny do poznawania nieznanych baz kodu lub planowania zmian

Dodatkowo jest subagent **general** do złożonych wyszukiwań i wieloetapowych zadań.
Jest używany wewnętrznie i można go wywołać w wiadomościach przez `@general`.

### Aplikacja desktopowa

Uruchom aplikację desktopową w trybie deweloperskim:

```bash
bun run --cwd packages/desktop dev
```

Utwórz build produkcyjny:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

Przetestuj zmiany w UI:

1. Uruchom serwer OpenCode (`bun dev serve`)
2. Uruchom:

```bash
bun run --cwd packages/app dev
```

---

### Współtworzenie

Jeśli chcesz współtworzyć OpenCode, przeczytaj [contributing docs](./CONTRIBUTING.md) przed wysłaniem pull requesta.
