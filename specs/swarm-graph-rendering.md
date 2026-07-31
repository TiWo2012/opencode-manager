# Swarm Graph Data + OpenTUI Rendering Surface

Research notes for the "add actual graphs to the swarm mode displaying what agents
rely on" work. Everything below was read from the `swarm-mode` branch (the swarm
feature branch) plus the installed `@opentui` v0.4.5 packages and the existing
snapshot test in `packages/tui`. Downstream tasks can rely on this without
re-deriving it.

Source of truth for file locations (branch `swarm-mode` unless noted):

- `packages/schema/src/swarm.ts` — wire model (self-exporting `export * as Swarm from "./swarm"`)
- `packages/tui/src/context/swarm.tsx` — `useSwarm()` store + SDK calls
- `packages/tui/src/routes/swarm.tsx` — `SwarmView` route that consumes the data
- `packages/tui/src/app.tsx` — route wiring (`<Match when={route.data.type === "swarm"}><SwarmView /></Match>`, slash command `swarm.open`, terminal title "OCM | Swarm")
- `packages/opencode/src/swarm/graph.ts` — existing pure graph helpers (`ready`, `blocked`, `topoOrder`, `isDone`, `allSucceeded`, success/terminal status sets)
- `packages/opencode/src/swarm/{manager,planner,service,yolo,notify,policy}.ts` — backend orchestration (not needed by the TUI renderer)
- `packages/tui/src/feature-plugins/system/swarm-notifications.ts` — event -> attention notifications

---

## 1. Swarm wire model (`packages/schema/src/swarm.ts`)

Import style used everywhere in the TUI:

```ts
import type { Swarm } from "@opencode-ai/schema/swarm"
```

### `Swarm.PlanTask` (the plan's units of work)

```ts
export const PlanTask = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: optional(Schema.String),
  /** agent type to run the task with (e.g. "general", "explore"). */
  agent: optional(Schema.String),
  /** task ids that must complete successfully first. */
  dependsOn: Schema.Array(Schema.String),
  requiresReview: optional(Schema.Boolean),
  /** validation/verification steps for this task. */
  validation: optional(Schema.Array(Schema.String)),
})
```

Important correction to the briefing: **`PlanTask` has NO `status` field.**
Runtime status lives on `Swarm.Agent.status`, not on the plan task. Task-level
progress is derived by matching `PlanTask.id` against `Agent.id` (the planner
creates one agent per plan task; `Agent.task` mirrors the task title).

`optional()` here is Effect's `Schema.optionalKey`-based helper — the field is
absent-or-present (not `undefined` union); use `task.description` in `Show`
guards, or `(task.description?.length ?? 0) > 0` for arrays.

### `Swarm.Agent` (runtime execution state)

```ts
export const Agent = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  role: optional(Schema.String),
  task: Schema.String,
  status: AgentStatus,
  dependsOn: Schema.Array(Schema.String),  // agent/task ids that must finish first
  branch: optional(Schema.String),
  worktree: optional(Schema.String),
  sessionID: optional(SessionID),
  startedAt: optional(NonNegativeInt),
  completedAt: optional(NonNegativeInt),
  filesChanged: optional(NonNegativeInt),
  additions: optional(NonNegativeInt),
  deletions: optional(NonNegativeInt),
  error: optional(Schema.String),
  review: optional(Review),
  merge: optional(MergeState),
})
```

`AgentStatus` literals (drives glyphs + colors in the TUI):

```ts
["planning", "queued", "waiting", "working", "blocked",
 "awaiting-review", "merging", "merged", "completed", "failed", "cancelled"]
```

`MergeState = { status: "pending" | "merging" | "merged" | "conflict" | "failed", target: string, message?: string }`
`Review = { status: "required" | "in-progress" | "passed" | "issues", findings: { severity: "info"|"warning"|"error", message: string }[] }`

### `Swarm.Info` (whole-swarm document, the top-level wire object)

```ts
{
  id: ID,                     // branded "swm_" + ascending() string
  projectID: string,
  title: string,
  mode: "normal" | "yolo",
  status: "idle" | "planning" | "running" | "paused" | "completed" | "failed" | "cancelled",
  task?: string,
  plan?: Plan,                // { summary: string, tasks: PlanTask[], risk: RiskAssessment }
  agents: Agent[],
  integrationBranch?: string, // "yolo" in yolo mode
  baseBranch?: string,
  risk?: RiskAssessment,
  approved?: boolean,
  result?: string,
  createdAt: number,          // ms epoch
  updatedAt: number,          // ms epoch
}
```

---

## 2. How `swarm.tsx` consumes the data via `useSwarm()`

### The hook (`packages/tui/src/context/swarm.tsx`)

`createSimpleContext`-based context. Returned API:

```ts
{
  data: {                       // solid store (reactive)
    swarms: Swarm.Info[]        // newest-first; reconciles by id
    loaded: boolean
    pendingApproval: { swarmID: string; action: string; message: string } | null
  },
  get(id: string): Swarm.Info | undefined
  refresh(): Promise<void>
  create(input: { title: string; mode: "normal" | "yolo"; task?: string }): Promise<Swarm.Info>
  plan(input: { swarmID: string; prompt: string }): Promise<Swarm.Info>
  approve(swarmID: string): Promise<Swarm.Info>
  start(swarmID: string): Promise<Swarm.Info>
  cancel(swarmID: string): Promise<Swarm.Info>
  agent(input: { swarmID: string; agentID: string; action: "cancel"|"merge"|"review"|"retry"|"approve-merge"; message?: string }): Promise<Swarm.Info>
  clearApproval(): void
}
```

Updates arrive two ways: every `swarm.*` method POSTs to the server and
`reconcile()`s the returned `Swarm.Info` into `data.swarms`; `onMount` also
subscribes to events `swarm.created`, `swarm.updated`, `swarm.requires.approval`
(server events are NOT in the generated SDK event union, so the event type is
widened with `as never` and the payload cast to the documented shape). The list
is refreshed once on mount via `POST /swarm/list` (degrading silently if the
endpoint is missing).

### Consumption in `SwarmView` (`packages/tui/src/routes/swarm.tsx`)

- `const swarm = useSwarm()`.
- `current` memo: `swarm.data.swarms.find(item => item.id === selectedID()) ?? swarm.data.swarms[0]`.
- `agents = createMemo(() => current()?.agents ?? [])`.
- `plan = createMemo(() => current()?.plan)`.
- Render structure:
  - Header row: project title, `swarm`, `info.title`, `info.mode`, spinner while active, `info.status` (colored via `swarmStatusColor`).
  - `SwarmActivity` line: counts `working`/`waiting`/`awaiting review`/`done` by filtering `info.agents` on status, or "Planning…"/"paused".
  - `PlanPanel` when `plan()` is present: renders `plan.tasks` with `task.title`, `task.agent` (tag), `task.description` (truncated to 90), `task.dependsOn` as `after: <ids joined>`, `task.requiresReview`, `task.validation`; risk block from `plan.risk`.
  - `AgentList` inside a `scrollbox`: one `AgentRow` per agent — glyph from `AGENT_GLYPH[agent.status]`, `agent.name`, `agent.task` (truncated 40), `agent.status` (colored), runtime duration from `startedAt`/`completedAt`, `agent.branch`, `+additions -deletions filesChanged`, `deps: <dependsOn joined>`.
  - `ReviewerPanel` when the selected agent has `review.findings`, `ChangesSummary` (merge conflicts via `agent.merge?.status === "conflict"`), `Composer` input.

Key detail for the graph work: **both the plan tasks (`PlanTask`) and the
runtime agents (`Agent`) are already visible on the same screen**, and both
carry a `dependsOn: string[]` of IDs. The renderer must join `PlanTask`/`Agent`
by `id` to draw dependency edges. `dependsOn` references sibling task/agent ids
(plan tasks reference other plan task ids; agents reference other agent ids).
The backend `packages/opencode/src/swarm/graph.ts` already computes `ready`,
`blocked`, and `topoOrder(plan.tasks)` — pure functions, safe to mirror into the
TUI if needed, or import is not allowed across the TUI package boundary
(`packages/tui` must not import `@opencode-ai/core` or `packages/opencode`).

Existing glyph/color mapping already in `swarm.tsx` (reuse it):

```ts
const AGENT_GLYPH: Record<Swarm.Agent["status"], string> = {
  planning: "◌", queued: "○", waiting: "▽", working: "●", blocked: "▲",
  "awaiting-review": "◈", merging: "⟳", merged: "⊞",
  completed: "✓", failed: "✕", cancelled: "⊘",
}
```

---

## 3. OpenTUI rendering surface (`@opentui/solid` 0.4.5 + `@opentui/core` 0.4.5)

Renderer is a character-cell terminal renderer (no pixel output). Components are
composed via Solid JSX (`/** @jsxImportSource @opentui/solid */`); layout is
Yoga flexbox, text is styled with `fg`/`bg`/`attributes`.

### Intrinsic elements (component catalogue)

Layout & display: `box`, `text`, `scrollbox`, `ascii_font`
Input: `input`, `textarea`, `select`, `tab_select`
Code/diff: `code`, `line_number`, `diff`, `markdown`
Text modifiers (inside `text`): `span`, `b`/`strong`, `i`/`em`, `u`, `br`, `a` (href)

### `<box>` props (BoxOptions — the workhorse for the graph)

- `border?: boolean | ("top"|"right"|"bottom"|"left")[]` — default `false`
- `borderStyle?: "single" | "double" | "rounded" | "heavy"` — default `"single"`
- `borderColor?: string | RGBA`
- `title?: string`, `titleColor?: string | RGBA`, `titleAlignment?: "left"|"center"|"right"`
- `bottomTitle?: string`, `bottomTitleAlignment?: "left"|"center"|"right"`
- `backgroundColor?: string | RGBA`
- `gap?: number | \`${number}%\``, `rowGap`, `columnGap`
- `focusedBorderColor`, `focusable`, `shouldFill`
- Layout (all renderables): `flexDirection: "column"|"column-reverse"|"row"|"row-reverse"`, `flexGrow`, `flexShrink`, `flexBasis`, `flexWrap`, `alignItems`, `alignSelf`, `justifyContent`, `overflow: "visible"|"hidden"|"scroll"`, `width`/`height` (`number | "auto" | `${number}%``), `minWidth`/`minHeight`/`maxWidth`/`maxHeight`, `margin*`, `padding*`, `top/right/bottom/left` (offsets, numbers or "auto" or percentages), `zIndex`, `visible`, `opacity`
- Mouse: `onMouseDown`, `onMouseUp`, `onMouseMove`, `onMouseScroll`, etc. (needed for clickable graph nodes)
- `position?: "static" | "relative" | "absolute"` — NOTE: `absolute` IS supported
  for overlays (existing usage: toast, dialogs, autocomplete, startup-loading,
  diff-viewer fullscreen). The briefing's "NO absolute positioning" is
  inaccurate; what does NOT exist is a free-form canvas/drawing primitive.

### `<text>` props (TextOptions)

- Children: string | number | boolean | JSX elements (`span`/`b`/`br`/...)
- `content?: StyledText | string` (or pass children)
- `fg?: string | RGBA`, `bg?: string | RGBA`, `attributes?: number` (bitmask, e.g. `TextAttributes.BOLD` from `@opentui/core`)
- `wrapMode?: "none" | "char" | "word"`, `truncate?: boolean`
- Inherits all layout/event props above (padding, flex, mouse, etc.)

### `<scrollbox>` props (ScrollBoxOptions)

- Extends `BoxOptions` (so it has `border`, `borderColor`, `title`, `gap`, padding, etc.)
- `scrollbarOptions?: { visible?: boolean; ... }` (swarm.tsx uses `{ visible: false }`)
- `scrollAcceleration?: ScrollAcceleration` (from `../util/scroll` `getScrollAcceleration(tuiConfig)`)
- `stickyScroll?: boolean`, `stickyStart?: "bottom"|"top"|"left"|"right"`
- `scrollX`/`scrollY`, `viewportCulling`, `rootOptions`/`wrapperOptions`/`viewportOptions`/`contentOptions`
- Container with children; scrolls when content overflows.

### Hooks

- `useTerminalDimensions(): Accessor<{ width: number; height: number }>` — reactive; used in swarm.tsx as `dimensions().height - 16` to cap the agent list height.
- `useRenderer(): CliRenderer` — e.g. `renderer.currentFocusedEditor`.
- `useKeyboard(handler, opts?)`, `usePaste`, `onResize(cb)`, `onFocus`, `onBlur`, `useSelectionHandler`, `useTimeline`.
- `Portal` (overlay into another mount node, useful for tooltips/modals), `Dynamic`, `extend({ name: RenderableClass })`, `getComponentCatalogue()`.
- `Spinner` local component: `packages/tui/src/component/spinner.tsx` (`<spinner frames={...} interval={80} color={...}/>` after `registerOpencodeSpinner()`).

### What this means for "drawing a graph"

There is no canvas and no arbitrary x/y drawing. The idiomatic way to render a
dependency graph:

1. Compose nested `<box>` elements with `flexDirection="row"`/`"column"` and `gap`.
2. Draw edges with box-drawing/arrow glyphs inside `<text>` (the codebase already does this: `diff-viewer-file-tree` uses `├─ └─ │` line glyphs; `swarm.tsx` uses `◌ ● ✓` status glyphs).
3. Use `<scrollbox>` for overflow, `useTerminalDimensions()` for viewport-aware sizing.
4. `position="absolute"` is available for overlays (e.g. a tooltip showing a node's task description), and `onMouseDown`/`onMouseUp` make nodes clickable.
5. A full grid layout would be rows of `PlanTask`/`Agent` nodes; `dependsOn` joins by id.

---

## 4. Snapshot test pattern (existing precedent)

Reference file (present in this worktree at HEAD and on swarm-mode):

`packages/tui/test/cli/tui/diff-viewer-file-tree.test.tsx`

Pattern, exactly as used:

```tsx
/** @jsxImportSource @opentui/solid */
import { describe, expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import type { JSX } from "solid-js"
import { TestTuiContexts } from "../../fixture/tui-environment"   // test/fixture/tui-environment.tsx
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"
import { KVProvider } from "../../../src/context/kv"
import { ThemeProvider } from "../../../src/context/theme"
import { TuiConfigProvider } from "../../../src/config"

const app = await testRender(() => withTheme(() => <Component ... />), { width: 40, height: 20 })
try {
  await renderOnceSettled(app)
  const lines = visibleLines(app.captureCharFrame())
  expect(lines).toEqual([...])
} finally {
  app.renderer.destroy()
}

async function renderOnceSettled(app: Awaited<ReturnType<typeof testRender>>) {
  await app.renderOnce()
  await new Promise((resolve) => setTimeout(resolve, 25))
  await app.renderOnce()
}

async function captureSettledFrame(app: Awaited<ReturnType<typeof testRender>>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const frame = app.captureCharFrame()
    if (frame.trim().length > 0) return frame
    await new Promise((resolve) => setTimeout(resolve, 25))
    await app.renderOnce()
  }
  return app.captureCharFrame()
}

function withTheme(component: () => JSX.Element) {
  return (
    <TestTuiContexts>
      <TuiConfigProvider config={createTuiResolvedConfig()}>
        <KVProvider>
          <ThemeProvider mode="dark">{component()}</ThemeProvider>
        </KVProvider>
      </TuiConfigProvider>
    </TestTuiContexts>
  )
}

function visibleLines(frame: string) {
  return frame
    .split("\n")
    .map((line) => line.trimEnd())
    .map((line) => line.replace(/^ ?│ ?/, "").replace(/[ │]*$/, ""))
    .map((line) => (line.startsWith(" ") ? line.slice(1) : line))
    .filter((line) => line.length > 0 && !/^┌|^└|^─+$/.test(line))
}
```

`testRender` comes from `@opentui/solid` and returns a `TestRendererSetup`:
`{ renderer, mockInput, mockMouse, renderOnce, flush, waitFor, waitForFrame,
waitForVisualIdle, externalOutput, getNativeStats, captureCharFrame,
captureSpans, resize }`. `captureCharFrame()` returns the current frame as a
string; `app.renderer.destroy()` must be called (use `try/finally`).

Theming: use the local `ThemeProvider mode="dark"` (swarm.tsx's
`useTheme().theme` returns RGBA fields like `theme.text`, `theme.textMuted`,
`theme.success`, `theme.error`, `theme.info`, `theme.warning`,
`theme.primary`, `theme.backgroundElement`). The file-tree test defines a
minimal literal `theme` object passed directly as a prop — either approach works.

The `visibleLines` helper strips borders (`┌ └ ─`) and empty/edge lines, so it
is the right tool for asserting graph glyph rows; if the graph test must assert
borders/titles, call `captureCharFrame()` and compare raw lines instead.

Test guard (AGENTS.md): **never run tests from the repo root**
(`bun test` from root exits 1 via the `do-not-run-tests-from-root` guard).
Run from the package directory: `cd packages/tui && bun test` (script is
`bun test --timeout 30000 --only-failures`). Typecheck from the package dir too:
`cd packages/tui && bun typecheck` (script `tsgo --noEmit`; `packages/tui`
uses `jsx: "preserve"` + `jsxImportSource: "@opentui/solid"` and
`bunfig.toml` preloads `@opentui/solid/preload` for both run and test).

---

## 5. Verification notes / gotchas

- `packages/schema/src/swarm.ts` lives ONLY on branch `swarm-mode` (it is not in
  `dev`/worktree HEAD as of this research). Any work on the graph feature must be
  based on `swarm-mode`.
- `PlanTask.id` and `Agent.id` are plain `string`s that must line up between the
  plan and the agent list; `dependsOn` arrays hold those ids.
- The TUI package boundary forbids importing `@opencode-ai/core` or
  `packages/opencode` from `packages/tui`; the graph layout logic must be
  re-implemented locally in the TUI or added to the schema package.
- Existing snapshots use `test.skip` on the heaviest test; keep heavy/new
  snapshot tests deterministic by settling with `renderOnceSettled` before
  capturing.
- Agent status glyphs and colors in `swarm.tsx` are the canonical presentation
  vocabulary to reuse for graph nodes.
