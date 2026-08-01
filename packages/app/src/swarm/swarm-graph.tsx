import type { Swarm } from "@opencode-ai/schema/swarm"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { createMemo, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { swarmLayers } from "./swarm-layout"

const statusBadgeClass = (status: Swarm.AgentStatus): string => {
  if (status === "completed" || status === "merged") return "bg-v2-state-bg-success text-v2-state-fg-success"
  if (status === "failed" || status === "blocked") return "bg-v2-state-bg-danger text-v2-state-fg-danger"
  if (status === "working" || status === "merging") return "bg-v2-state-bg-info text-v2-state-fg-info"
  if (status === "awaiting-review") return "bg-v2-state-bg-warning text-v2-state-fg-warning"
  return "bg-v2-background-bg-layer-01 text-v2-text-text-muted"
}

function SwarmTaskCard(props: {
  task: Swarm.PlanTask
  agents: readonly Swarm.Agent[]
  tasksById: ReadonlyMap<string, Swarm.PlanTask>
}) {
  const agent = () => props.agents.find((item) => item.id === props.task.id)
  const dependsOnTitles = () =>
    props.task.dependsOn.flatMap((dep) => {
      const task = props.tasksById.get(dep)
      return task ? [task.title] : []
    })

  return (
    <div class="flex w-64 shrink-0 flex-col gap-1.5 rounded-[8px] border border-v2-border-border-muted bg-v2-background-bg-layer-01 p-3">
      <div class="flex items-start gap-2">
        <p
          class="min-w-0 flex-1 truncate text-[13px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base"
          title={props.task.title}
        >
          {props.task.title}
        </p>
        <Show when={props.task.requiresReview}>
          <IconV2 name="review" class="size-4 shrink-0 text-v2-state-fg-warning" />
        </Show>
      </div>
      <Show when={dependsOnTitles().length > 0}>
        <p class="text-[11px] leading-4 tracking-[-0.04px] text-v2-text-text-muted">
          <span>← depends on: </span>
          {dependsOnTitles().join(", ")}
        </p>
      </Show>
      <div class="flex flex-row flex-wrap items-center gap-1 pt-0.5">
        <Show when={props.task.agent}>
          <span class="rounded-sm bg-v2-background-bg-layer-02 px-1.5 py-0.5 text-[11px] font-[440] leading-4 text-v2-text-text-muted">
            {props.task.agent}
          </span>
        </Show>
        <Show when={agent()}>
          {(joined) => (
            <span
              class={`rounded-sm px-1.5 py-0.5 text-[11px] font-[530] leading-4 ${statusBadgeClass(joined().status)}`}
            >
              {joined().status}
            </span>
          )}
        </Show>
      </div>
    </div>
  )
}

export function SwarmGraph(props: { info: Swarm.Info }) {
  const language = useLanguage()
  const plan = () => props.info.plan
  const tasksById = createMemo(() => new Map(plan()?.tasks.map((task) => [task.id, task]) ?? []))
  const layers = createMemo(() => {
    const current = plan()
    return current ? swarmLayers(current.tasks) : []
  })

  return (
    <Show
      when={plan()}
      fallback={
        <div class="flex flex-col items-center gap-1 px-4 py-10">
          <p class="text-[13px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base">
            {language.t("swarm.empty")}
          </p>
          <p class="text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-muted">
            {language.t("swarm.empty.hint")}
          </p>
        </div>
      }
    >
      <div class="flex flex-col gap-3">
        <div class="overflow-x-auto">
          <div class="flex min-w-max flex-row items-start gap-3">
            <For each={layers()}>
              {(column) => (
                <div class="flex flex-col gap-2">
                  <For each={column}>
                    {(id) => <SwarmTaskCard task={tasksById().get(id)!} agents={props.info.agents} tasksById={tasksById()} />}
                  </For>
                </div>
              )}
            </For>
          </div>
        </div>
        <p class="text-[11px] font-[440] leading-4 tracking-[-0.04px] text-v2-text-text-muted">
          {language.t("swarm.diagram.legend")}
        </p>
      </div>
    </Show>
  )
}
