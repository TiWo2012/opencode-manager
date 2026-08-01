import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { Spinner } from "@opencode-ai/ui/spinner"
import { useNavigate } from "@solidjs/router"
import type { Swarm } from "@opencode-ai/schema/swarm"
import { For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { SwarmProvider, useSwarm } from "@/swarm/context"
import { useSwarmDirectory } from "./swarm-directory"
import { formatRelativeTime, swarmStatusClass } from "./swarm-utils"

export default function SwarmList() {
  const directory = useSwarmDirectory()
  return (
    <SwarmProvider directory={directory}>
      <Show when={directory()}>
        <SwarmListContent />
      </Show>
    </SwarmProvider>
  )
}

function SwarmListContent() {
  const swarm = useSwarm()
  const language = useLanguage()
  const navigate = useNavigate()

  return (
    <div class="m-2 min-h-0 flex-1 self-stretch overflow-hidden rounded-[10px] bg-v2-background-bg-base shadow-[var(--v2-elevation-raised)]">
      <ScrollView class="h-full">
        <div class="mx-auto flex min-h-full w-full max-w-[1080px] flex-col gap-4 px-3 py-4 lg:px-6">
          <header class="flex items-center justify-between gap-4">
            <h1 class="text-[15px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base">
              {language.t("swarm.title")}
            </h1>
            <ButtonV2 data-action="swarm-new" variant="neutral" icon="plus" onClick={() => navigate("/swarm/new")}>
              {language.t("swarm.new")}
            </ButtonV2>
          </header>
          <Show
            when={swarm.data.loaded}
            fallback={
              <div class="flex items-center justify-center py-16 text-v2-text-text-muted">
                <Spinner class="size-4" />
              </div>
            }
          >
            <Show
              when={swarm.data.swarms.length > 0}
              fallback={
                <div class="flex flex-col items-center gap-1 px-4 py-16 text-center">
                  <p class="text-[13px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base">
                    {language.t("swarm.empty")}
                  </p>
                  <p class="text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-muted">
                    {language.t("swarm.empty.hint")}
                  </p>
                </div>
              }
            >
              <div class="flex flex-col gap-2 pb-4">
                <For each={swarm.data.swarms}>{(item) => <SwarmCard swarm={item} />}</For>
              </div>
            </Show>
          </Show>
        </div>
      </ScrollView>
    </div>
  )
}

function SwarmCard(props: { swarm: Swarm.Info }) {
  const language = useLanguage()
  const navigate = useNavigate()
  const updated = () => formatRelativeTime(props.swarm.updatedAt)

  return (
    <button
      type="button"
      data-component="swarm-row"
      onClick={() => navigate(`/swarm/${props.swarm.id}`)}
      class="flex min-w-0 items-center gap-3 rounded-[8px] border border-v2-border-border-muted bg-v2-background-bg-layer-01 p-3 text-left transition-[background-color] duration-150 ease-in-out hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none"
    >
      <div class="min-w-0 flex-1">
        <p class="truncate text-[13px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base">
          {props.swarm.title}
        </p>
        <p class="mt-0.5 flex items-center gap-2 text-[11px] font-[440] leading-4 tracking-[-0.04px] text-v2-text-text-muted">
          <span>{updated()}</span>
          <span aria-hidden="true">·</span>
          <span>
            {props.swarm.agents.length} {props.swarm.agents.length === 1 ? "agent" : "agents"}
          </span>
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <SwarmModeBadge mode={props.swarm.mode} />
        <span
          class={`rounded-sm px-1.5 py-0.5 text-[11px] font-[530] leading-4 ${swarmStatusClass(props.swarm.status)}`}
        >
          {language.t(`swarm.status.${props.swarm.status}`)}
        </span>
        <IconV2 name="chevron-down" class="rotate-90 text-v2-icon-icon-muted" />
      </div>
    </button>
  )
}

export function SwarmModeBadge(props: { mode: Swarm.Mode }) {
  const language = useLanguage()
  const label = () => (props.mode === "yolo" ? language.t("swarm.mode.yolo") : language.t("swarm.mode.normal"))
  const active = () => props.mode === "yolo"

  return (
    <span
      class={`rounded-sm px-1.5 py-0.5 text-[11px] font-[530] leading-4 ${
        active()
          ? "bg-v2-state-bg-warning text-v2-state-fg-warning"
          : "bg-v2-background-bg-layer-02 text-v2-text-text-muted"
      }`}
    >
      {label()}
    </span>
  )
}
