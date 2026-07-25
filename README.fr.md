# OpenCode

Un fork opinionné d'[OpenCode](https://github.com/anomalyco/opencode).

---

## Commencer

### Prérequis

- [Bun](https://bun.sh) 1.3+

### Installation

```bash
bun install
```

### Exécuter

```bash
# Démarrer le TUI
bun dev

# Démarrer le serveur API headless
bun dev serve

# Démarrer l'interface web
bun dev web

# Exécuter dans un répertoire spécifique
bun dev <directory>
```

### Construire un exécutable autonome

```bash
./packages/opencode/script/build.ts --single
```

Puis exécuter avec :

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Remplacez `<platform>` par votre plateforme (par exemple, `darwin-arm64`, `linux-x64`).

### Agents

OpenCode inclut deux agents intégrés que vous pouvez basculer avec la touche `Tab`.

- **build** - Par défaut, agent avec accès complet pour le travail de développement
- **plan** - Agent en lecture seule pour l'analyse et l'exploration du code
  - Refuse les modifications de fichiers par défaut
  - Demande l'autorisation avant d'exécuter des commandes bash
  - Idéal pour explorer une base de code inconnue ou planifier des changements

Un sous-agent **general** est aussi inclus pour les recherches complexes et les tâches en plusieurs étapes.
Il est utilisé en interne et peut être invoqué via `@general` dans les messages.

### Application de bureau

Exécuter l'application de bureau en mode développement :

```bash
bun run --cwd packages/desktop dev
```

Créer une version de production :

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

Tester les modifications de l'UI :

1. Démarrer le serveur OpenCode (`bun dev serve`)
2. Exécuter :

```bash
bun run --cwd packages/app dev
```

---

### Contribuer

Si vous souhaitez contribuer à OpenCode, lisez nos [docs de contribution](./CONTRIBUTING.md) avant de soumettre une pull request.
