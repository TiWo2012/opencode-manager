import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { DialogBody, DialogFooter, DialogHeader, DialogTitleGroup, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { Spinner } from "@opencode-ai/ui/spinner"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useNavigate, useParams } from "@solidjs/router"
import type { Swarm } from "@opencode-ai/schema/swarm"
import { createMemo, createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { errorMessage } from "@/pages/layout/helpers"
import { SwarmGraph } from "@/swarm/swarm-graph"
import { SwarmProvider, useSwarm } from "@/swarm/context"
import type { SwarmAgentAction, SwarmApproval } from "@/swarm/types"
import { showToast } from "@/utils/toast"
import { useSwarmDirectory } from "./swarm-directory"
import { SwarmModeBadge } from "./swarm-list"
import {
  agentActions,
  canApprove,
  canStart,
  formatDuration,
  swarmIsActive,
  swarmStatusClass,
} from "./swarm-utils"

export default function SwarmDetail() {
  const params = useParams<{ id: string }>()
  const directory = useSwarmDirectory()
  return (
    <SwarmProvider directory={directory}>
      <Show when={directory()}>
        <SwarmDetailContent id={params.id} />
      </Show>
    </SwarmProvider>
  )
}

function SwarmDetailContent(props: { id: string }) {
  const swarm = useSwarm()
  const language = useLanguage()
  const navigate = useNavigate()
  const dialog = useDialog()
  const info = createMemo(() => swarm.get(props.id))
  const [busy, setBusy] = createSignal<string>()

  async function run(action: () => Promise<unknown>, key: string) {
    if (busy()) return
    setBusy(key)
    try {
      await action()
    } catch (error) {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: errorMessage(error, language.t("common.requestFailed")),
      })
    } finally {
      setBusy()
    }
  }

  function agentAction(agent: Swarm.Agent, action: SwarmAgentAction, message?: string) {
    return run(() => swarm.agent({ swarmID: props.id, agentID: agent.id, action, message }), `${agent.id}:${action}`)
  }

  function openRetry(agent: Swarm.Agent) {
    dialog.show(() => (
      <SwarmRetryDialog
        agentName={agent.name}
        onSubmit={(message) => {
          dialog.close()
          void agentAction(agent, "retry", message)
        }}
      />
    ))
  }

  return (
    <div class="m-2 min-h-0 flex-1 self-stretch overflow-hidden rounded-[10px] bg-v2-background-bg-base shadow-[var(--v2-elevation-raised)]">
      <ScrollView class="h-full">
        <div class="mx-auto flex min-h-full w-full max-w-[1080px] flex-col gap-4 px-3 py-4 lg:px-6">
          <Show
            when={info()}
            fallback={
              <Show
                when={swarm.data.loaded}
                fallback={
                  <div class="flex items-center justify-center py-16 text-v2-text-text-muted">
                    <Spinner class="size-4" />
                  </div>
                }
              >
                <div class="flex flex-col items-center gap-1 px-4 py-16 text-center">
                  <p class="text-[13px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base">
                    {language.t("swarm.empty")}
                  </p>
                  <ButtonV2 variant="ghost-muted" size="small" onClick={() => navigate("/swarm")}>
                    {language.t("common.goBack")}
                  </ButtonV2>
                </div>
              </Show>
            }
          >
            {(current) => (
              <>
                <SwarmApprovalBanner
                  id={props.id}
                  pending={swarm.data.pendingApproval}
                  onClear={() => swarm.clearApproval()}
                />
                <SwarmHeader
                  info={current()}
                  busy={!!busy()}
                  onCancel={() => void run(() => swarm.cancel(current().id), "swarm")}
                />
                <SwarmPlanSection
                  info={current()}
                  busy={!!busy()}
                  onApprove={() => void run(() => swarm.approve(current().id), "swarm")}
                  onStart={() => void run(() => swarm.start(current().id), "swarm")}
                />
                <SwarmAgentSection
                  info={current()}
                  busy={!!busy()}
                  onAgentAction={(agent, action) => void agentAction(agent, action)}
                  onRetry={openRetry}
                />
              </>
            )}
          </Show>
        </div>
      </ScrollView>
    </div>
  )
}

function SwarmApprovalBanner(props: {
  id: string
  pending: SwarmApproval | null
  onClear: () => void
}) {
  const language = useLanguage()
  const matches = () => (props.pending?.swarmID === props.id ? props.pending : undefined)

  return (
    <Show when={matches()}>
      {(pending) => (
        <div class="flex items-center gap-2 rounded-[8px] border border-v2-state-bg-warning bg-v2-state-bg-warning px-3 py-2 text-v2-state-fg-warning">
          <IconV2 name="status" class="size-4 shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="text-[13px] font-[530] leading-5 tracking-[-0.04px]">{language.t("swarm.approval.required")}</p>
            <p class="truncate text-[11px] font-[440] leading-4 tracking-[-0.04px]">{pending().message}</p>
          </div>
          <ButtonV2 variant="ghost-muted" size="small" onClick={props.onClear}>
            <IconV2 name="close" />
          </ButtonV2>
        </div>
      )}
    </Show>
  )
}

function SwarmHeader(props: { info: Swarm.Info; busy: boolean; onCancel: () => void }) {
  const language = useLanguage()
  const status = () => props.info.status
  const pulsing = () => status() === "planning" || status() === "running"

  return (
    <header class="flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-[15px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base">
          {props.info.title}
        </h1>
        <div class="mt-1 flex items-center gap-2">
          <SwarmModeBadge mode={props.info.mode} />
          <span
            class={`flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[11px] font-[530] leading-4 ${swarmStatusClass(status())}`}
          >
            {language.t(`swarm.status.${status()}`)}
            <Show when={pulsing()}>
              <Spinner class="size-3" />
            </Show>
          </span>
          <Show when={props.info.baseBranch}>
            <span class="rounded-sm bg-v2-background-bg-layer-02 px-1.5 py-0.5 text-[11px] font-[440] leading-4 text-v2-text-text-muted">
              {props.info.baseBranch}
            </span>
          </Show>
          <Show when={props.info.integrationBranch}>
            <span class="rounded-sm bg-v2-background-bg-layer-02 px-1.5 py-0.5 text-[11px] font-[440] leading-4 text-v2-text-text-muted">
              {props.info.integrationBranch}
            </span>
          </Show>
        </div>
      </div>
      <Show when={swarmIsActive(status())}>
        <ButtonV2 variant="danger" size="small" disabled={props.busy} onClick={props.onCancel}>
          {language.t("swarm.cancel")}
        </ButtonV2>
      </Show>
    </header>
  )
}

function SwarmPlanSection(props: {
  info: Swarm.Info
  busy: boolean
  onApprove: () => void
  onStart: () => void
}) {
  const language = useLanguage()
  const plan = () => props.info.plan

  return (
    <section class="flex flex-col gap-3 rounded-[8px] border border-v2-border-border-muted bg-v2-background-bg-layer-01 p-3">
      <Show when={plan()}>
        {(p) => (
          <>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-[13px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base">
                {language.t("swarm.plan.summary")}
              </h2>
              <div class="flex items-center gap-2">
                <Show when={canApprove(props.info)}>
                  <ButtonV2
                    data-action="swarm-approve"
                    variant="neutral"
                    size="small"
                    disabled={props.busy}
                    onClick={props.onApprove}
                  >
                    {language.t("swarm.plan.approve")}
                  </ButtonV2>
                </Show>
                <Show when={canStart(props.info)}>
                  <ButtonV2
                    data-action="swarm-start"
                    variant="neutral"
                    size="small"
                    disabled={props.busy}
                    onClick={props.onStart}
                  >
                    {language.t("swarm.plan.start")}
                  </ButtonV2>
                </Show>
              </div>
            </div>
            <p class="text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-muted">{p().summary}</p>
            <SwarmRisk risk={p().risk} />
          </>
        )}
      </Show>
      <SwarmGraph info={props.info} />
    </section>
  )
}

function SwarmRisk(props: { risk: Swarm.RiskAssessment }) {
  const language = useLanguage()

  return (
    <div class="flex flex-col gap-1">
      <p class="text-[11px] font-[530] leading-4 tracking-[-0.04px] text-v2-text-text-muted">
        {language.t("swarm.plan.risk")}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-sm bg-v2-background-bg-layer-02 px-1.5 py-0.5 text-[11px] font-[530] leading-4 text-v2-text-text-base">
          {props.risk.score}/10
        </span>
        <span class="rounded-sm bg-v2-background-bg-layer-02 px-1.5 py-0.5 text-[11px] font-[440] leading-4 text-v2-text-text-muted">
          {props.risk.policy}
        </span>
        <Show when={props.risk.escalated}>
          <IconV2 name="status" class="size-3.5 text-v2-state-fg-warning" />
        </Show>
      </div>
      <p class="text-[11px] font-[440] leading-4 tracking-[-0.04px] text-v2-text-text-muted">{props.risk.reason}</p>
    </div>
  )
}

function SwarmAgentSection(props: {
  info: Swarm.Info
  busy: boolean
  onAgentAction: (agent: Swarm.Agent, action: SwarmAgentAction) => void
  onRetry: (agent: Swarm.Agent) => void
}) {
  return (
    <Show when={props.info.agents.length > 0}>
      <section class="flex flex-col gap-2">
        <For each={props.info.agents}>
          {(agent) => (
            <SwarmAgentRow
              agent={agent}
              busy={props.busy}
              onAction={(action) => props.onAgentAction(agent, action)}
              onRetry={() => props.onRetry(agent)}
            />
          )}
        </For>
      </section>
    </Show>
  )
}

function SwarmAgentRow(props: {
  agent: Swarm.Agent
  busy: boolean
  onAction: (action: SwarmAgentAction) => void
  onRetry: () => void
}) {
  const language = useLanguage()
  const runtime = () => {
    if (props.agent.startedAt === undefined || props.agent.completedAt === undefined) return
    return formatDuration(props.agent.completedAt - props.agent.startedAt)
  }
  const conflict = () => props.agent.merge?.status === "conflict"

  return (
    <div class="rounded-[8px] border border-v2-border-border-muted bg-v2-background-bg-layer-01 p-3">
      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="min-w-0 flex-1 truncate text-[13px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base">
              {props.agent.name}
            </p>
            <span class="shrink-0 text-[11px] font-[440] leading-4 tracking-[-0.04px] text-v2-text-text-muted">
              {props.agent.status}
            </span>
            <Show when={runtime()}>
              <span class="shrink-0 text-[11px] font-[440] leading-4 tracking-[-0.04px] text-v2-text-text-muted">
                {runtime()}
              </span>
            </Show>
          </div>
          <p class="mt-0.5 truncate text-[11px] font-[440] leading-4 tracking-[-0.04px] text-v2-text-text-muted">
            {props.agent.task}
          </p>
          <Show when={props.agent.error}>
            <p class="mt-0.5 text-[11px] font-[440] leading-4 tracking-[-0.04px] text-v2-state-fg-danger">
              {props.agent.error}
            </p>
          </Show>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-[440] leading-4 tracking-[-0.04px] text-v2-text-text-muted">
            <Show when={props.agent.branch}>
              <span class="flex items-center gap-1">
                <IconV2 name="branch" class="size-3" />
                {props.agent.branch}
              </span>
            </Show>
            <Show when={props.agent.filesChanged !== undefined}>
              <span>{props.agent.filesChanged} files</span>
            </Show>
            <Show when={props.agent.additions !== undefined}>
              <span class="text-v2-state-fg-success">+{props.agent.additions}</span>
            </Show>
            <Show when={props.agent.deletions !== undefined}>
              <span class="text-v2-state-fg-danger">-{props.agent.deletions}</span>
            </Show>
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <For each={agentActions(props.agent)}>
            {(action) => (
              <ButtonV2
                data-action={`swarm-agent-${action}`}
                variant="ghost-muted"
                size="small"
                disabled={props.busy}
                onClick={() => (action === "retry" ? props.onRetry() : props.onAction(action))}
              >
                {language.t(`swarm.agent.action.${action}`)}
              </ButtonV2>
            )}
          </For>
        </div>
      </div>
      <Show when={props.agent.review?.findings?.length}>
        <div class="mt-2 flex flex-col gap-1 border-t border-v2-border-border-muted pt-2">
          <For each={props.agent.review?.findings}>
            {(finding) => (
              <p
                class={`text-[11px] font-[440] leading-4 tracking-[-0.04px] ${
                  finding.severity === "error"
                    ? "text-v2-state-fg-danger"
                    : finding.severity === "warning"
                      ? "text-v2-state-fg-warning"
                      : "text-v2-text-text-muted"
                }`}
              >
                <span class="font-[530]">{finding.severity}</span> {finding.message}
              </p>
            )}
          </For>
        </div>
      </Show>
      <Show when={conflict()}>
        <div class="mt-2 flex items-center gap-1.5 rounded-[6px] border border-v2-state-bg-danger bg-v2-state-bg-danger px-2 py-1.5 text-v2-state-fg-danger">
          <IconV2 name="branch" class="size-3.5 shrink-0" />
          <p class="text-[11px] font-[440] leading-4 tracking-[-0.04px]">
            {props.agent.merge?.message ?? "merge conflict"}
          </p>
        </div>
      </Show>
    </div>
  )
}

function SwarmRetryDialog(props: { agentName: string; onSubmit: (message: string) => void }) {
  const language = useLanguage()
  const dialog = useDialog()
  const [message, setMessage] = createSignal("")

  return (
    <DialogV2 fit>
      <DialogHeader hideClose>
        <DialogTitleGroup
          title={language.t("swarm.agent.feedback")}
          description={props.agentName}
        />
      </DialogHeader>
      <DialogBody class="w-80">
        <textarea
          data-component="swarm-retry-input"
          rows={3}
          class="w-full resize-none rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-layer-01 px-3.5 py-3 text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-base outline-none transition-[border-color,background-color] duration-150 ease-in-out placeholder:text-v2-text-text-faint hover:bg-v2-background-bg-layer-02 focus:border-v2-border-border-focus"
          placeholder={language.t("swarm.agent.feedback.placeholder")}
          value={message()}
          onInput={(event) => setMessage(event.currentTarget.value)}
        />
      </DialogBody>
      <DialogFooter>
        <ButtonV2 variant="ghost" onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </ButtonV2>
        <ButtonV2
          data-action="swarm-retry-submit"
          variant="neutral"
          disabled={!message().trim()}
          onClick={() => props.onSubmit(message().trim())}
        >
          {language.t("swarm.agent.action.retry")}
        </ButtonV2>
      </DialogFooter>
    </DialogV2>
  )
}
