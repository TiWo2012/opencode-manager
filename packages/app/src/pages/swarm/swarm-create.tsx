import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { TextareaV2 } from "@opencode-ai/ui/v2/textarea-v2"
import { useNavigate, useSearchParams } from "@solidjs/router"
import type { Swarm } from "@opencode-ai/schema/swarm"
import { createMemo, createSignal, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { errorMessage } from "@/pages/layout/helpers"
import { SwarmProvider, useSwarm } from "@/swarm/context"
import { showToast } from "@/utils/toast"
import { useSwarmDirectory } from "./swarm-directory"

export default function SwarmCreate() {
  const [search] = useSearchParams<{ directory?: string; prompt?: string }>()
  const fallback = useSwarmDirectory()
  const directory = createMemo(() => search.directory ?? fallback())

  return (
    <SwarmProvider directory={directory}>
      <Show when={directory()}>
        <SwarmCreateContent />
      </Show>
    </SwarmProvider>
  )
}

function SwarmCreateContent() {
  const swarm = useSwarm()
  const language = useLanguage()
  const navigate = useNavigate()
  const [search] = useSearchParams<{ directory?: string; prompt?: string }>()
  const [title, setTitle] = createSignal(search.prompt ?? "")
  const [mode, setMode] = createSignal<Swarm.Mode>("normal")
  const [busy, setBusy] = createSignal(false)

  async function submit() {
    const value = title().trim()
    if (!value || busy()) return
    setBusy(true)
    try {
      const created = await swarm.create({ title: value, mode: mode() })
      const planned = await swarm.plan({ swarmID: created.id, prompt: value })
      navigate(`/swarm/${planned.id}`)
    } catch (error) {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: errorMessage(error, language.t("common.requestFailed")),
      })
      setBusy(false)
    }
  }

  return (
    <div class="m-2 min-h-0 flex-1 self-stretch overflow-hidden rounded-[10px] bg-v2-background-bg-base shadow-[var(--v2-elevation-raised)]">
      <div class="mx-auto flex min-h-full w-full max-w-[720px] flex-col gap-5 px-3 py-6 lg:px-6">
        <h1 class="text-[15px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base">
          {language.t("swarm.create.title")}
        </h1>
        <TextareaV2
          data-component="swarm-create-input"
          rows={4}
          class="w-full"
          placeholder={language.t("swarm.create.placeholder")}
          value={title()}
          disabled={busy()}
          onInput={(event) => setTitle(event.currentTarget.value)}
        />
        <div class="grid grid-cols-2 gap-3">
          <ModeCard
            label={language.t("swarm.mode.normal")}
            description={language.t("swarm.mode.normal.description")}
            selected={mode() === "normal"}
            disabled={busy()}
            onSelect={() => setMode("normal")}
          />
          <ModeCard
            label={language.t("swarm.mode.yolo")}
            description={language.t("swarm.mode.yolo.description")}
            selected={mode() === "yolo"}
            disabled={busy()}
            onSelect={() => setMode("yolo")}
          />
        </div>
        <div class="flex items-center gap-2">
          <ButtonV2
            data-action="swarm-create-submit"
            variant="neutral"
            onClick={() => void submit()}
            disabled={busy() || !title().trim()}
          >
            {busy() ? language.t("common.loading") : language.t("swarm.plan.start")}
          </ButtonV2>
          <Show when={busy()}>
            <span class="text-[11px] font-[440] leading-4 tracking-[-0.04px] text-v2-text-text-muted">
              {language.t("swarm.status.planning")}
            </span>
          </Show>
        </div>
      </div>
    </div>
  )
}

function ModeCard(props: {
  label: string
  description: string
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={props.onSelect}
      disabled={props.disabled}
      class="flex flex-col gap-1 rounded-[8px] border p-3 text-left transition-[background-color,border-color] duration-150 ease-in-out focus-visible:outline-none"
      classList={{
        "border-v2-border-border-base bg-v2-background-bg-layer-02": props.selected,
        "border-v2-border-border-muted bg-v2-background-bg-layer-01 hover:bg-v2-overlay-simple-overlay-hover":
          !props.selected,
        "pointer-events-none opacity-60": props.disabled,
      }}
    >
      <p class="text-[13px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base">{props.label}</p>
      <p class="text-[11px] font-[440] leading-4 tracking-[-0.04px] text-v2-text-text-muted">{props.description}</p>
    </button>
  )
}
