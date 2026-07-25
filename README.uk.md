# OpenCode

Думка forks [OpenCode](https://github.com/anomalyco/opencode).

---

## Початок

### Вимоги

- [Bun](https://bun.sh) 1.3+

### Встановлення

```bash
bun install
```

### Запуск

```bash
# Запустити TUI
bun dev

# Запустити headless API-сервер
bun dev serve

# Запустити веб-інтерфейс
bun dev web

# Запустити в конкретній директорії
bun dev <directory>
```

### Збірка автономного виконуваного файлу

```bash
./packages/opencode/script/build.ts --single
```

Потім запустіть:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Замініть `<platform>` на вашу платформу (наприклад, `darwin-arm64`, `linux-x64`).

### Агенти

OpenCode містить два вбудовані агенти, між якими можна перемикатися клавішею `Tab`.

- **build** - Агент за замовчуванням із повним доступом для завдань розробки
- **plan** - Агент лише для читання для аналізу та дослідження коду
  - За замовчуванням забороняє редагування файлів
  - Запитує дозвіл перед запуском bash-команд
  - Ідеально підходить для дослідження незнайомих кодових баз або планування змін

Також доступний допоміжний агент **general** для складного пошуку та багатокрокових завдань.
Він використовується всередині системи й може бути викликаний у повідомленнях через `@general`.

### Десктопний застосунок

Запуск десктопного застосунку в режимі розробки:

```bash
bun run --cwd packages/desktop dev
```

Збірка production-версії:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

Тестування змін UI:

1. Запустіть сервер OpenCode (`bun dev serve`)
2. Запустіть:

```bash
bun run --cwd packages/app dev
```

---

### Внесок

Якщо ви хочете зробити внесок в OpenCode, будь ласка, прочитайте нашу [документацію для контриб'юторів](./CONTRIBUTING.md) перед надсиланням pull request.
