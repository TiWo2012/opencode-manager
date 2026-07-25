# OpenCode

Un fork con opiniones de [OpenCode](https://github.com/anomalyco/opencode).

---

## Empezar

### Requisitos

- [Bun](https://bun.sh) 1.3+

### Instalación

```bash
bun install
```

### Ejecutar

```bash
# Iniciar TUI
bun dev

# Iniciar servidor API sin cabeza
bun dev serve

# Iniciar interfaz web
bun dev web

# Ejecutar en un directorio específico
bun dev <directory>
```

### Construir un ejecutable independiente

```bash
./packages/opencode/script/build.ts --single
```

Luego ejecutar con:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Reemplaza `<platform>` con tu plataforma (por ejemplo, `darwin-arm64`, `linux-x64`).

### Agentes

OpenCode incluye dos agentes integrados que puedes alternar con la tecla `Tab`.

- **build** - Por defecto, agente con acceso completo para tareas de desarrollo
- **plan** - Agente de solo lectura para análisis y exploración de código
  - Deniega ediciones de archivos por defecto
  - Pide permiso antes de ejecutar comandos bash
  - Ideal para explorar codebases desconocidas o planificar cambios

Además, incluye un subagente **general** para búsquedas complejas y tareas de varios pasos.
Se usa internamente y se puede invocar con `@general` en los mensajes.

### App de escritorio

Ejecutar la app de escritorio en modo desarrollo:

```bash
bun run --cwd packages/desktop dev
```

Crear build de producción:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

Probar cambios en la UI:

1. Iniciar el servidor de OpenCode (`bun dev serve`)
2. Ejecutar:

```bash
bun run --cwd packages/app dev
```

---

### Contribuir

Si te interesa contribuir a OpenCode, lee nuestras [docs de contribución](./CONTRIBUTING.md) antes de enviar un pull request.
