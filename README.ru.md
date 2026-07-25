# OpenCode

Мнение forks [OpenCode](https://github.com/anomalyco/opencode).

---

## Начало

### Требования

- [Bun](https://bun.sh) 1.3+

### Установка

```bash
bun install
```

### Запуск

```bash
# Запустить TUI
bun dev

# Запустить headless API-сервер
bun dev serve

# Запустить веб-интерфейс
bun dev web

# Запустить в конкретной директории
bun dev <directory>
```

### Сборка автономного исполняемого файла

```bash
./packages/opencode/script/build.ts --single
```

Затем запустите:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Замените `<platform>` на вашу платформу (например, `darwin-arm64`, `linux-x64`).

### Agents

В OpenCode есть два встроенных агента, между которыми можно переключаться клавишей `Tab`.

- **build** - По умолчанию, агент с полным доступом для разработки
- **plan** - Агент только для чтения для анализа и изучения кода
  - По умолчанию запрещает редактирование файлов
  - Запрашивает разрешение перед выполнением bash-команд
  - Идеален для изучения незнакомых кодовых баз или планирования изменений

Также включен сабагент **general** для сложных поисков и многошаговых задач.
Он используется внутренне и может быть вызван в сообщениях через `@general`.

### Десктопное приложение

Запуск десктопного приложения в режиме разработки:

```bash
bun run --cwd packages/desktop dev
```

Сборка production-версии:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

Тестирование изменений UI:

1. Запустите сервер OpenCode (`bun dev serve`)
2. Запустите:

```bash
bun run --cwd packages/app dev
```

---

### Вклад

Если вы хотите внести вклад в OpenCode, прочитайте [contributing docs](./CONTRIBUTING.md) перед тем, как отправлять pull request.
