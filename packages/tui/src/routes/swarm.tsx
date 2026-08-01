import { InputRenderable, RGBA, TextAttributes } from "@opentui/core"
import { useRenderer, useTerminalDimensions } from "@opentui/solid"
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { useSwarm } from "../context/swarm"
import { useRoute } from "../context/route"
import { useTheme } from "../context/theme"
import { useProject } from "../context/project"
import { useTuiConfig } from "../config"
import { useToast, Toast } from "../ui/toast"
import { useDialog } from "../ui/dialog"
import { DialogConfirm } from "../ui/dialog-confirm"
import { DialogPrompt } from "../ui/dialog-prompt"
import { Locale } from "../util/locale"
import { getScrollAcceleration } from "../util/scroll"
import { OPENCODE_BASE_MODE, useBindings } from "../keymap"
import { Spinner } from "../component/spinner"
import { useArgs } from "../context/args"
import { createDictationManager, defaultDictationConfig, type DictationStatus } from "../dictation"
import type { Swarm } from "@opencode-ai/schema/swarm"
import path from "path"

const AGENT_GLYPH: Record<Swarm.Agent["status"], string> = {
  planning: "◌",
  queued: "○",
  waiting: "▽",
  working: "●",
  blocked: "▲",
  "awaiting-review": "◈",
  merging: "⟳",
  merged: "⊞",
  completed: "✓",
  failed: "✕",
  cancelled: "⊘",
}

function agentStatusColor(status: Swarm.Agent["status"], theme: ReturnType<typeof useTheme>["theme"]) {
  if (status === "completed" || status === "merged") return theme.success
  if (status === "failed" || status === "blocked") return theme.error
  if (status === "working" || status === "merging") return theme.info
  if (status === "awaiting-review") return theme.warning
  return theme.textMuted
}

function swarmStatusColor(status: Swarm.Status, theme: ReturnType<typeof useTheme>["theme"]) {
  if (status === "completed") return theme.success
  if (status === "failed") return theme.error
  if (status === "running" || status === "planning") return theme.info
  if (status === "paused") return theme.warning
  return theme.textMuted
}

function swarmActive(status: Swarm.Status) {
  return status === "running" || status === "planning" || status === "paused"
}

/** Live activity line under the header so it is obvious the swarm is doing something. */
function SwarmActivity(props: { agents: readonly Swarm.Agent[]; status: Swarm.Status }) {
  const { theme } = useTheme()
  if (props.status === "planning") {
    return (
      <box flexDirection="row" gap={1} paddingBottom={1}>
        <Spinner color={theme.info} />
        <text fg={theme.textMuted}>Planning…</text>
      </box>
    )
  }
  if (props.status === "running") {
    const working = props.agents.filter((agent) => agent.status === "working" || agent.status === "merging").length
    const waiting = props.agents.filter((agent) => agent.status === "waiting" || agent.status === "queued").length
    const reviewing = props.agents.filter((agent) => agent.status === "awaiting-review").length
    const done = props.agents.filter((agent) => agent.status === "completed" || agent.status === "merged").length
    const parts: string[] = []
    if (working > 0) parts.push(`${working} working`)
    if (waiting > 0) parts.push(`${waiting} waiting`)
    if (reviewing > 0) parts.push(`${reviewing} awaiting review`)
    if (done > 0) parts.push(`${done} done`)
    const label = parts.length > 0 ? parts.join(" · ") : "starting agents…"
    return (
      <box flexDirection="row" gap={1} paddingBottom={1}>
        <Spinner color={theme.info} />
        <text fg={theme.textMuted}>{label}</text>
      </box>
    )
  }
  if (props.status === "paused") {
    return (
      <box flexDirection="row" gap={1} paddingBottom={1}>
        <text fg={theme.warning}>⏸ paused</text>
      </box>
    )
  }
  return null
}

function agentRuntime(agent: Swarm.Agent, now: number) {
  if (agent.startedAt === undefined) return "—"
  const end = agent.completedAt ?? now
  return Locale.duration(Math.max(0, end - agent.startedAt))
}

export function SwarmView() {
  const swarm = useSwarm()
  const route = useRoute()
  const tuiConfig = useTuiConfig()
  const toast = useToast()
  const dialog = useDialog()
  const renderer = useRenderer()
  const { theme } = useTheme()
  const project = useProject()
  const args = useArgs()
  const yoloSession = () => args.yolo === true
  const [tick, setTick] = createSignal(Date.now())
  const [selectedID, setSelectedID] = createSignal<string>()
  const [agentIndex, setAgentIndex] = createSignal(0)
  const [task, setTask] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [dictationStatus, setDictationStatus] = createSignal<DictationStatus>("idle")
  const [interimText, setInterimText] = createSignal<string>()
  let dictationManager: ReturnType<typeof createDictationManager> | undefined
  let composer: InputRenderable | undefined

  onMount(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000)
    onCleanup(() => clearInterval(timer))
    setTimeout(() => {
      if (!composer || composer.isDestroyed) return
      composer.focus()
    }, 1)

    dictationManager = createDictationManager({
      config: defaultDictationConfig,
      onText: (text) => {
        if (!composer || composer.isDestroyed) return
        composer.cursorOffset = composer.plainText.length
        composer.insertText(text)
        setInterimText(undefined)
      },
      onStatusChange: (status) => {
        setDictationStatus(status)
        if (status === "error") {
          void toast.show({
            variant: "error",
            message: dictationManager?.errorMessage ?? "Dictation error",
            duration: 5000,
          })
        }
      },
      onInterimResult: (text) => setInterimText(text),
    })
  })

  onCleanup(() => {
    if (dictationManager && dictationManager.status === "listening") {
      dictationManager.stop()
    }
  })

  async function toggleDictation() {
    if (!dictationManager) return
    if (dictationManager.status === "listening") {
      await dictationManager.stop()
      setInterimText(undefined)
    } else {
      try {
        await dictationManager.start()
      } catch (error) {
        toast.show({
          variant: "error",
          message: (error as Error).message,
          duration: 5000,
        })
      }
    }
  }

  function focusComposer() {
    setTimeout(() => {
      if (!composer || composer.isDestroyed) return
      composer.focus()
    }, 1)
  }

  const current = createMemo(() => {
    const id = selectedID()
    return swarm.data.swarms.find((item) => item.id === id) ?? swarm.data.swarms[0]
  })

  createEffect(() => {
    void current()?.id
    setAgentIndex(0)
  })

  const agents = createMemo(() => current()?.agents ?? [])
  const plan = createMemo(() => current()?.plan)
  const approval = createMemo(() => {
    const info = current()
    const pending = swarm.data.pendingApproval
    if (!info || !pending || pending.swarmID !== info.id) return undefined
    return pending
  })
  const selectedAgent = createMemo(() => {
    const list = agents()
    const index = Math.min(agentIndex(), list.length - 1)
    return index >= 0 ? list[index] : undefined
  })
  const hasReview = createMemo(() => (selectedAgent()?.review?.findings.length ?? 0) > 0)
  const showPlanActions = createMemo(() => {
    const info = current()
    return info !== undefined && info.status === "planning" && info.approved !== true
  })
  const showApprove = createMemo(() => {
    const info = current()
    if (!info) return false
    if (info.mode === "normal") return true
    return info.plan?.risk.policy === "human-approval"
  })

  const projectTitle = createMemo(() => {
    const worktree = project.data.project.worktree
    if (worktree) return path.basename(worktree)
    return project.data.project.id ?? "project"
  })

  function moveAgent(delta: number) {
    const count = agents().length
    if (count === 0) return
    setAgentIndex((index) => Math.max(0, Math.min(count - 1, index + delta)))
  }

  function selectAgent(id: string) {
    setAgentIndex(agents().findIndex((agent) => agent.id === id))
    composer?.blur()
  }

  function submitTask(value: string) {
    const input = value.trim()
    if (!input || busy()) return
    const yoloSuffix = /\s--yolo\s*$/.test(input)
    const title = yoloSuffix ? input.replace(/\s--yolo\s*$/, "") : input
    // `--yolo` in the input wins; otherwise the CLI `--yolo` flag defaults the
    // whole session to yolo mode.
    const mode: "normal" | "yolo" = yoloSuffix ? "yolo" : yoloSession() ? "yolo" : "normal"
    setBusy(true)
    const existing = current()
    const reuse = existing !== undefined && (existing.status === "idle" || existing.status === "planning")
    const start = reuse ? Promise.resolve(existing) : swarm.create({ title, mode })
    start
      .then((info) => swarm.plan({ swarmID: info.id, prompt: title }))
      .then(() => {
        setTask("")
        setBusy(false)
        focusComposer()
      })
      .catch((error) => {
        toast.error(error)
        setBusy(false)
      })
  }

  function approveCurrent() {
    const info = current()
    if (!info) return
    void swarm.approve(info.id).catch(toast.error)
  }

  function startCurrent() {
    const info = current()
    if (!info) return
    void swarm.start(info.id).catch(toast.error)
  }

  function cancelCurrent() {
    const info = current()
    if (!info) return
    void swarm.cancel(info.id).catch(toast.error)
  }

  function focusAgent() {
    const agent = selectedAgent()
    if (!agent?.sessionID) return
    route.navigate({ type: "session", sessionID: agent.sessionID })
  }

  async function cancelSelected() {
    const info = current()
    const agent = selectedAgent()
    if (!info || !agent) return
    const confirmed = await DialogConfirm.show(dialog, "Cancel Agent", `Cancel agent "${agent.name}"?`)
    if (!confirmed) return
    swarm.agent({ swarmID: info.id, agentID: agent.id, action: "cancel" }).catch(toast.error)
  }

  function mergeSelected() {
    const info = current()
    const agent = selectedAgent()
    if (!info || !agent) return
    void swarm.agent({ swarmID: info.id, agentID: agent.id, action: "merge" }).catch(toast.error)
  }

  function reviewSelected() {
    const info = current()
    const agent = selectedAgent()
    if (!info || !agent) return
    void swarm.agent({ swarmID: info.id, agentID: agent.id, action: "review" }).catch(toast.error)
  }

  async function sendFeedback() {
    const info = current()
    const agent = selectedAgent()
    if (!info || !agent) return
    const message = await DialogPrompt.show(dialog, `Send feedback to ${agent.name}`, {
      placeholder: "Describe what the agent should fix",
    })
    if (!message) return
    swarm.agent({ swarmID: info.id, agentID: agent.id, action: "retry", message }).catch(toast.error)
  }

  useBindings(() => ({
    commands: [
      {
        name: "swarm.cancel",
        title: "Cancel agent",
        category: "Swarm",
        run: cancelSelected,
      },
      {
        name: "swarm.merge",
        title: "Merge agent",
        category: "Swarm",
        run: mergeSelected,
      },
      {
        name: "swarm.review",
        title: "Review agent",
        category: "Swarm",
        run: reviewSelected,
      },
      {
        title: "Toggle voice dictation",
        name: "dictation.toggle",
        category: "Swarm",
        hidden: true,
        run: () => {
          void toggleDictation()
        },
      },
    ],
  }))

  useBindings(() => ({
    mode: OPENCODE_BASE_MODE,
    target: () => composer,
    enabled: () => defaultDictationConfig.enabled,
    bindings: tuiConfig.keybinds.get("dictation.toggle"),
  }))

  useBindings(() => ({
    mode: OPENCODE_BASE_MODE,
    enabled: () => renderer.currentFocusedEditor === null,
    bindings: tuiConfig.keybinds.gather("swarm", ["swarm.cancel", "swarm.merge", "swarm.review"]),
  }))

  useBindings(() => ({
    mode: OPENCODE_BASE_MODE,
    enabled: () => renderer.currentFocusedEditor === null,
    bindings: [
      { key: "j", desc: "Next agent", group: "Swarm", cmd: () => moveAgent(1) },
      { key: "k", desc: "Previous agent", group: "Swarm", cmd: () => moveAgent(-1) },
      { key: "return", desc: "Focus agent session", group: "Swarm", cmd: focusAgent },
    ],
  }))

  return (
    <box flexDirection="column" flexGrow={1} minHeight={0} paddingLeft={2} paddingRight={2} paddingTop={1} gap={1}>
      <box flexDirection="row" alignItems="center" gap={2} paddingBottom={1}>
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {projectTitle()}
        </text>
        <text fg={theme.textMuted}>swarm</text>
        <Show when={current()} keyed>
          {(info) => (
            <>
              <text attributes={TextAttributes.BOLD} fg={theme.text}>
                {info.title}
              </text>
              <text fg={theme.textMuted}>{info.mode}</text>
              <Show when={swarmActive(info.status)}>
                <Spinner color={theme.info} />
              </Show>
              <text fg={swarmStatusColor(info.status, theme)}>{info.status}</text>
            </>
          )}
        </Show>
      </box>
      <Show when={current()} keyed>
        {(info) => <SwarmActivity agents={info.agents} status={info.status} />}
      </Show>
      <Show when={current()} fallback={<EmptyState yolo={yoloSession()} />} keyed>
        {(info) => (
          <>
            <Show when={info.mode === "yolo"}>
              <YoloBanner info={info} />
            </Show>
            <Show when={plan()} keyed>
              {(value) => (
                <PlanPanel
                  plan={value}
                  swarm={info}
                  showActions={showPlanActions()}
                  showApprove={showApprove()}
                  onApprove={approveCurrent}
                  onStart={startCurrent}
                  onCancel={cancelCurrent}
                />
              )}
            </Show>
            <Show when={approval()} keyed>
              {(value) => (
                <ApprovalBanner approval={value} onApprove={approveCurrent} onDismiss={() => swarm.clearApproval()} />
              )}
            </Show>
            <Show when={swarm.data.swarms.length > 1}>
              <SwarmList swarms={swarm.data.swarms} selectedID={info.id} onSelect={setSelectedID} />
            </Show>
            <Show when={agents().length > 0}>
              <AgentList
                agents={agents()}
                selected={selectedAgent()}
                now={tick()}
                onSelect={selectAgent}
                onFocus={focusAgent}
              />
            </Show>
            <Show when={hasReview()}>
              {(_) => <ReviewerPanel agent={selectedAgent()!} onFeedback={sendFeedback} />}
            </Show>
            <Show when={agents().length > 0}>
              <ChangesSummary agents={agents()} />
            </Show>
          </>
        )}
      </Show>
      <Composer
        value={task()}
        busy={busy()}
        yolo={yoloSession()}
        dictationStatus={dictationStatus()}
        dictationEnabled={defaultDictationConfig.enabled}
        interimText={interimText()}
        onChange={setTask}
        onSubmit={submitTask}
        onToggleDictation={() => void toggleDictation()}
        ref={(input) => {
          composer = input
        }}
      />
      <Toast />
    </box>
  )
}

function EmptyState(props: { yolo: boolean }) {
  const { theme } = useTheme()
  return (
    <box flexGrow={1} flexDirection="column" justifyContent="center" alignItems="center" gap={1}>
      <text fg={theme.text}>No swarm running.</text>
      <text fg={theme.textMuted}>
        {props.yolo
          ? "Describe a task — the swarm will plan and execute autonomously on the yolo branch."
          : "Describe a task to start one. Append --yolo to skip human review."}
      </text>
    </box>
  )
}

function YoloBanner(props: { info: Swarm.Info }) {
  const { theme } = useTheme()
  const policy = props.info.plan?.risk.policy
  return (
    <box flexDirection="row" gap={2} paddingLeft={1} paddingRight={1} borderColor={theme.warning} border={["left", "right"]}>
      <text attributes={TextAttributes.BOLD} fg={theme.warning}>
        MODE: YOLO
      </text>
      <text fg={theme.warning}>BRANCH: {props.info.integrationBranch ?? "yolo"}</text>
      <text fg={theme.warning}>BASE: {props.info.baseBranch ?? "—"}</text>
      <text fg={theme.warning}>RISK POLICY: {policy ?? "unassessed"}</text>
    </box>
  )
}

function ActionButton(props: { color: RGBA; onPress: () => void; children: string }) {
  return (
    <box onMouseDown={(event) => event.preventDefault()} onMouseUp={props.onPress}>
      <text fg={props.color}>[{props.children}]</text>
    </box>
  )
}

function PlanPanel(props: {
  plan: Swarm.Plan
  swarm: Swarm.Info
  showActions: boolean
  showApprove: boolean
  onApprove: () => void
  onStart: () => void
  onCancel: () => void
}) {
  const { theme } = useTheme()
  const risk = props.plan.risk
  const riskColor =
    risk.score >= 8 ? theme.error : risk.score >= 6 ? theme.warning : risk.score >= 3 ? theme.info : theme.success
  return (
    <box
      flexDirection="column"
      gap={1}
      border={true}
      borderColor={theme.primary}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
    >
      <box flexDirection="row" alignItems="center" gap={1}>
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          PLAN
        </text>
        <text fg={theme.textMuted}>awaiting review</text>
      </box>
      <text fg={theme.text}>{props.plan.summary}</text>
      <box flexDirection="column" gap={1}>
        <For each={props.plan.tasks}>
          {(task, index) => (
            <box flexDirection="column" gap={0}>
              <box flexDirection="row" gap={1}>
                <text fg={theme.textMuted}>{index() + 1}.</text>
                <text fg={theme.text}>{task.title}</text>
                <Show when={task.agent}>
                  <text fg={theme.textMuted}>[{task.agent}]</text>
                </Show>
              </box>
              <Show when={task.description}>
                <text fg={theme.textMuted} paddingLeft={3}>
                  {Locale.truncate(task.description ?? "", 90)}
                </text>
              </Show>
              <box flexDirection="row" gap={2} paddingLeft={3}>
                <Show when={task.dependsOn.length > 0}>
                  <text fg={theme.textMuted}>after: {task.dependsOn.join(", ")}</text>
                </Show>
                <Show when={task.requiresReview}>
                  <text fg={theme.warning}>review</text>
                </Show>
                <Show when={(task.validation?.length ?? 0) > 0}>
                  <text fg={theme.textMuted}>validate: {task.validation!.join("; ")}</text>
                </Show>
              </box>
            </box>
          )}
        </For>
      </box>
      <box flexDirection="row" gap={2} alignItems="center">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          RISK
        </text>
        <text fg={riskColor}>{risk.score}/10</text>
        <text fg={theme.textMuted}>policy: {risk.policy}</text>
        <Show when={risk.escalated}>
          <text fg={theme.error}>escalated</text>
        </Show>
      </box>
      <text fg={theme.textMuted}>{Locale.truncate(risk.reason, 140)}</text>
      <Show when={props.showActions}>
        <box flexDirection="row" gap={1} paddingTop={1}>
          <Show when={props.showApprove}>
            <ActionButton color={theme.primary} onPress={props.onApprove}>
              Approve
            </ActionButton>
          </Show>
          <ActionButton color={theme.info} onPress={props.onStart}>
            Start
          </ActionButton>
          <ActionButton color={theme.error} onPress={props.onCancel}>
            Cancel
          </ActionButton>
        </box>
      </Show>
      <Show when={!props.showActions && props.swarm.status === "planning"}>
        <box flexDirection="row" gap={1} paddingTop={1}>
          <ActionButton color={theme.info} onPress={props.onStart}>
            Start
          </ActionButton>
          <ActionButton color={theme.error} onPress={props.onCancel}>
            Cancel
          </ActionButton>
        </box>
      </Show>
    </box>
  )
}

function ApprovalBanner(props: {
  approval: { swarmID: string; action: string; message: string }
  onApprove: () => void
  onDismiss: () => void
}) {
  const { theme } = useTheme()
  return (
    <box
      flexDirection="row"
      alignItems="center"
      gap={2}
      paddingLeft={1}
      paddingRight={1}
      borderColor={theme.warning}
      border={["left", "right"]}
    >
      <text attributes={TextAttributes.BOLD} fg={theme.warning}>
        APPROVAL REQUIRED
      </text>
      <text fg={theme.text}>{props.approval.message}</text>
      <ActionButton color={theme.primary} onPress={props.onApprove}>
        Approve
      </ActionButton>
      <ActionButton color={theme.textMuted} onPress={props.onDismiss}>
        Dismiss
      </ActionButton>
    </box>
  )
}

function SwarmList(props: { swarms: Swarm.Info[]; selectedID: string; onSelect: (id: string) => void }) {
  const { theme } = useTheme()
  return (
    <box flexDirection="row" gap={1}>
      <For each={props.swarms}>
        {(item) => {
          const selected = item.id === props.selectedID
          return (
            <box
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={selected ? theme.backgroundElement : undefined}
              onMouseDown={() => props.onSelect(item.id)}
            >
              <text fg={selected ? theme.text : theme.textMuted}>
                {Locale.truncate(item.title, 24)} [{item.mode}] {item.status} {item.agents.length} agents
              </text>
            </box>
          )
        }}
      </For>
    </box>
  )
}

function AgentList(props: {
  agents: readonly Swarm.Agent[]
  selected: Swarm.Agent | undefined
  now: number
  onSelect: (id: string) => void
  onFocus: () => void
}) {
  const { theme } = useTheme()
  const tuiConfig = useTuiConfig()
  const dimensions = useTerminalDimensions()
  const scrollAcceleration = getScrollAcceleration(tuiConfig)
  return (
    <box flexDirection="column" flexGrow={1} minHeight={0} maxHeight={dimensions().height - 16}>
      <text attributes={TextAttributes.BOLD} fg={theme.text}>
        AGENTS
      </text>
      <scrollbox
        flexGrow={1}
        minHeight={0}
        scrollbarOptions={{ visible: false }}
        scrollAcceleration={scrollAcceleration}
      >
        <For each={props.agents}>
          {(agent) => (
            <AgentRow
              agent={agent}
              selected={agent.id === props.selected?.id}
              now={props.now}
              onSelect={() => props.onSelect(agent.id)}
              onFocus={props.onFocus}
            />
          )}
        </For>
      </scrollbox>
    </box>
  )
}

function AgentRow(props: {
  agent: Swarm.Agent
  selected: boolean
  now: number
  onSelect: () => void
  onFocus: () => void
}) {
  const { theme } = useTheme()
  let lastClickAt = 0
  function handleClick() {
    props.onSelect()
    const now = Date.now()
    if (now - lastClickAt < 500) {
      props.onFocus()
      lastClickAt = 0
      return
    }
    lastClickAt = now
  }
  const color = agentStatusColor(props.agent.status, theme)
  const animated = props.agent.status === "working" || props.agent.status === "merging"
  return (
    <box flexDirection="row" gap={1} backgroundColor={props.selected ? theme.backgroundElement : undefined} onMouseDown={handleClick}>
      <Show when={animated} fallback={<text fg={color}>{AGENT_GLYPH[props.agent.status]}</text>}>
        <Spinner color={color} />
      </Show>
      <text attributes={props.selected ? TextAttributes.BOLD : undefined} fg={props.selected ? theme.text : theme.textMuted}>
        {props.agent.name}
      </text>
      <text fg={theme.textMuted}>{Locale.truncate(props.agent.task, 40)}</text>
      <text fg={color}>{props.agent.status}</text>
      <text fg={theme.textMuted}>{agentRuntime(props.agent, props.now)}</text>
      <Show when={props.agent.branch}>
        <text fg={theme.textMuted}>{props.agent.branch}</text>
      </Show>
      <Show when={props.agent.filesChanged !== undefined}>
        <text fg={theme.textMuted}>
          +{props.agent.additions ?? 0} -{props.agent.deletions ?? 0} {props.agent.filesChanged} files
        </text>
      </Show>
      <Show when={props.agent.dependsOn.length > 0}>
        <text fg={theme.textMuted}>deps: {props.agent.dependsOn.join(",")}</text>
      </Show>
    </box>
  )
}

function ReviewerPanel(props: { agent: Swarm.Agent; onFeedback: () => void }) {
  const { theme } = useTheme()
  return (
    <box
      flexDirection="column"
      gap={1}
      paddingLeft={1}
      paddingRight={1}
      borderColor={theme.warning}
      border={["left", "right"]}
    >
      <text attributes={TextAttributes.BOLD} fg={theme.warning}>
        REVIEW — {props.agent.name}
      </text>
      <For each={props.agent.review?.findings ?? []}>
        {(finding) => (
          <box flexDirection="row" gap={1}>
            <text
              fg={finding.severity === "error" ? theme.error : finding.severity === "warning" ? theme.warning : theme.info}
            >
              {finding.severity}
            </text>
            <text fg={theme.text}>{finding.message}</text>
          </box>
        )}
      </For>
      <ActionButton color={theme.primary} onPress={props.onFeedback}>
        Send feedback to agent
      </ActionButton>
    </box>
  )
}

function ChangesSummary(props: { agents: readonly Swarm.Agent[] }) {
  const { theme } = useTheme()
  const pending = props.agents.filter((agent) => agent.status === "waiting" || agent.status === "queued").length
  const conflicts = props.agents.filter((agent) => agent.merge?.status === "conflict").length
  return (
    <box flexDirection="row" alignItems="center" gap={2} paddingBottom={1}>
      <text attributes={TextAttributes.BOLD} fg={theme.text}>
        CHANGES
      </text>
      <For each={props.agents}>
        {(agent) => (
          <Show when={agent.filesChanged !== undefined}>
            <text fg={theme.textMuted}>
              {agent.name} +{agent.additions ?? 0} -{agent.deletions ?? 0} {agent.filesChanged} files
            </text>
          </Show>
        )}
      </For>
      <Show when={pending > 0}>
        <text fg={theme.textMuted}>PENDING: {pending}</text>
      </Show>
      <Show when={conflicts > 0}>
        <text fg={theme.error}>CONFLICTS: {conflicts}</text>
      </Show>
    </box>
  )
}

function Composer(props: {
  value: string
  busy: boolean
  yolo: boolean
  dictationStatus: DictationStatus
  dictationEnabled: boolean
  interimText?: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onToggleDictation: () => void
  ref?: (input: InputRenderable | undefined) => void
}) {
  const { theme } = useTheme()
  return (
    <box flexDirection="column" paddingBottom={1}>
      <box flexDirection="row" alignItems="center" gap={1}>
        <text fg={props.yolo ? theme.warning : theme.textMuted}>{props.yolo ? "yolo" : "task"}</text>
        <input
          flexGrow={1}
          value={props.value}
          placeholder={
            props.yolo
              ? "Describe a task — the swarm runs autonomously on the yolo branch"
              : "Describe a task for the swarm... (append --yolo to skip human review)"
          }
          placeholderColor={theme.textMuted}
          textColor={props.busy ? theme.textMuted : theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.primary}
          onInput={props.onChange}
          onSubmit={(value) => props.onSubmit(typeof value === "string" ? value : "")}
          ref={props.ref}
        />
        <Show when={props.dictationEnabled}>
          <box
            flexDirection="row"
            gap={1}
            alignItems="center"
            onMouseUp={props.onToggleDictation}
            opacity={props.dictationStatus === "listening" ? 1 : 0.7}
          >
            <text
              fg={
                props.dictationStatus === "listening"
                  ? theme.primary
                  : props.dictationStatus === "error"
                    ? theme.error
                    : theme.textMuted
              }
            >
              {props.dictationStatus === "listening" ? "[●]" : "[○]"}
            </text>
            <Show when={props.dictationStatus !== "idle" && props.dictationStatus !== "listening"}>
              <text fg={theme.textMuted}>
                {props.dictationStatus === "processing" ? "Processing..." : "Error"}
              </text>
            </Show>
          </box>
        </Show>
      </box>
      <Show when={props.interimText}>
        <box paddingLeft={2} paddingTop={1}>
          <text fg={theme.textMuted}>{props.interimText}</text>
        </box>
      </Show>
    </box>
  )
}
