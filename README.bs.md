# OpenCode

Mišljenje fork [OpenCode](https://github.com/anomalyco/opencode).

---

## Početak

### Zahtjevi

- [Bun](https://bun.sh) 1.3+

### Instalacija

```bash
bun install
```

### Pokretanje

```bash
# Pokreni TUI
bun dev

# Pokreni headless API server
bun dev serve

# Pokreni web interfejs
bun dev web

# Pokreni u određenom direktoriju
bun dev <directory>
```

### Izgradnja samostalne izvršne datoteke

```bash
./packages/opencode/script/build.ts --single
```

Zatim pokrenite sa:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Zamijenite `<platform>` sa vašom platformom (npr. `darwin-arm64`, `linux-x64`).

### Agenti

OpenCode uključuje dva ugrađena agenta između kojih možeš prebacivati tasterom `Tab`.

- **build** - Podrazumijevani agent sa punim pristupom za razvoj
- **plan** - Agent samo za čitanje za analizu i istraživanje koda
  - Podrazumijevano zabranjuje izmjene datoteka
  - Traži dozvolu prije pokretanja bash komandi
  - Idealan za istraživanje nepoznatih codebase-ova ili planiranje izmjena

Uključen je i **general** pod-agent za složene pretrage i višekoračne zadatke.
Koristi se interno i može se pozvati pomoću `@general` u porukama.

### Desktop aplikacija

Pokretanje desktop aplikacije u razvojnom režimu:

```bash
bun run --cwd packages/desktop dev
```

Izgradnja produkcijske verzije:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

Testiranje UI promjena:

1. Pokrenite OpenCode server (`bun dev serve`)
2. Pokrenite:

```bash
bun run --cwd packages/app dev
```

---

### Doprinosi

Ako želiš doprinositi OpenCode-u, pročitaj [upute za doprinošenje](./CONTRIBUTING.md) prije slanja pull requesta.
