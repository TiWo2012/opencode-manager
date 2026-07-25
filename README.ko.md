# OpenCode

[OpenCode](https://github.com/anomalyco/opencode) 의 의견이 반영된 포크입니다.

---

## 시작하기

### 요구사항

- [Bun](https://bun.sh) 1.3+

### 설치

```bash
bun install
```

### 실행

```bash
# TUI 시작
bun dev

# 헤드리스 API 서버 시작
bun dev serve

# 웹 인터페이스 시작
bun dev web

# 특정 디렉토리에서 실행
bun dev <directory>
```

### 독립 실행 파일 빌드

```bash
./packages/opencode/script/build.ts --single
```

실행:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

`<platform>`을 사용 중인 플랫폼으로 바꾸세요 (예: `darwin-arm64`, `linux-x64`).

### Agents

OpenCode 에는 내장 에이전트 2개가 있으며 `Tab` 키로 전환할 수 있습니다.

- **build** - 기본값, 개발 작업을 위한 전체 권한 에이전트
- **plan** - 분석 및 코드 탐색을 위한 읽기 전용 에이전트
  - 기본적으로 파일 편집을 거부
  - bash 명령 실행 전에 권한을 요청
  - 낯선 코드베이스를 탐색하거나 변경을 계획할 때 적합

또한 복잡한 검색과 여러 단계 작업을 위한 **general** 서브 에이전트가 포함되어 있습니다.
내부적으로 사용되며, 메시지에서 `@general` 로 호출할 수 있습니다.

### 데스크톱 앱

개발 모드에서 데스크톱 앱 실행:

```bash
bun run --cwd packages/desktop dev
```

프로덕션 빌드:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

UI 변경 사항 테스트:

1. OpenCode 서버 시작 (`bun dev serve`)
2. 실행:

```bash
bun run --cwd packages/app dev
```

---

### 기여하기

OpenCode 에 기여하고 싶다면, Pull Request 를 제출하기 전에 [contributing docs](./CONTRIBUTING.md) 를 읽어주세요.
