# OpenCode

Un fork opinionato di [OpenCode](https://github.com/anomalyco/opencode).

---

## Iniziare

### Requisiti

- [Bun](https://bun.sh) 1.3+

### Installazione

```bash
bun install
```

### Eseguire

```bash
# Avviare il TUI
bun dev

# Avviare il server API headless
bun dev serve

# Avviare l'interfaccia web
bun dev web

# Eseguire in una directory specifica
bun dev <directory>
```

### Costruire un eseguibile standalone

```bash
./packages/opencode/script/build.ts --single
```

Poi eseguire con:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Sostituisci `<platform>` con la tua piattaforma (ad esempio, `darwin-arm64`, `linux-x64`).

### Agenti

OpenCode include due agenti integrati tra cui puoi passare usando il tasto `Tab`.

- **build** – Predefinito, agente con accesso completo per il lavoro di sviluppo
- **plan** – Agente in sola lettura per analisi ed esplorazione del codice
  - Nega le modifiche ai file per impostazione predefinita
  - Chiede il permesso prima di eseguire comandi bash
  - Ideale per esplorare codebase sconosciute o pianificare modifiche

È inoltre incluso un sotto-agente **general** per ricerche complesse e attività multi-step.
Viene utilizzato internamente e può essere invocato usando `@general` nei messaggi.

### App Desktop

Eseguire l'app desktop in modalità sviluppo:

```bash
bun run --cwd packages/desktop dev
```

Creare una build di produzione:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

Testare le modifiche all'UI:

1. Avviare il server OpenCode (`bun dev serve`)
2. Eseguire:

```bash
bun run --cwd packages/app dev
```

---

### Contribuire

Se sei interessato a contribuire a OpenCode, leggi la nostra [guida alla contribuzione](./CONTRIBUTING.md) prima di inviare una pull request.
