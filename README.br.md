# OpenCode

Um fork opinado do [OpenCode](https://github.com/anomalyco/opencode).

---

## Começar

### Requisitos

- [Bun](https://bun.sh) 1.3+

### Instalação

```bash
bun install
```

### Executar

```bash
# Iniciar TUI
bun dev

# Iniciar servidor API headless
bun dev serve

# Iniciar interface web
bun dev web

# Executar em um diretório específico
bun dev <directory>
```

### Construir um executável standalone

```bash
./packages/opencode/script/build.ts --single
```

Depois execute com:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Substitua `<platform>` pela sua plataforma (por exemplo, `darwin-arm64`, `linux-x64`).

### Agents

O OpenCode inclui dois agents integrados, que você pode alternar com a tecla `Tab`.

- **build** - Padrão, agent com acesso total para trabalho de desenvolvimento
- **plan** - Agent somente leitura para análise e exploração de código
  - Nega edições de arquivos por padrão
  - Pede permissão antes de executar comandos bash
  - Ideal para explorar codebases desconhecidas ou planejar mudanças

Também há um subagent **general** para buscas complexas e tarefas em várias etapas.
Ele é usado internamente e pode ser invocado com `@general` nas mensagens.

### App desktop

Executar a app desktop em modo de desenvolvimento:

```bash
bun run --cwd packages/desktop dev
```

Criar build de produção:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

Testar mudanças na UI:

1. Iniciar o servidor OpenCode (`bun dev serve`)
2. Executar:

```bash
bun run --cwd packages/app dev
```

---

### Contribuir

Se você tem interesse em contribuir com o OpenCode, leia os [contributing docs](./CONTRIBUTING.md) antes de enviar um pull request.
