import { For } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { useLanguage } from "@/context/language"
import { buildSwarmLaunchPath } from "@/pages/swarm/swarm-utils"

export type LaunchMode = "local" | "worktree" | "swarm"

const LAUNCH_MODES = [
  {
    mode: "local",
    icon: "monitor",
    label: "swarm.launch.local",
    description: "swarm.launch.local.description",
  },
  {
    mode: "worktree",
    icon: "workspace-new",
    label: "swarm.launch.worktree",
    description: "swarm.launch.worktree.description",
  },
  {
    mode: "swarm",
    icon: "grid-plus",
    label: "swarm.launch.swarm",
    description: "swarm.launch.swarm.description",
  },
] as const

/**
 * Lets a user pick how to launch a new session: in the current directory
 * (Local), in a brand-new git worktree (New worktree), or as a Swarm.
 * Local and worktree delegate to the caller via `onLocal`/`onWorktree`; Swarm
 * navigates to the swarm create page carrying the current directory (and draft
 * prompt, when provided).
 */
export function LaunchModeSelector(props: {
  directory: () => string
  prompt?: () => string
  onLocal?: () => void
  onWorktree?: () => void
}) {
  const language = useLanguage()
  const navigate = useNavigate()

  const select = (mode: LaunchMode) => {
    if (mode === "local") {
      props.onLocal?.()
      return
    }
    if (mode === "worktree") {
      props.onWorktree?.()
      return
    }
    navigate(buildSwarmLaunchPath(props.directory(), props.prompt?.()))
  }

  return (
    <div class="grid grid-cols-3 gap-3">
      <For each={LAUNCH_MODES}>
        {(item) => (
          <button
            type="button"
            data-action={`launch-mode-${item.mode}`}
            onClick={() => select(item.mode)}
            class="flex flex-col items-start gap-1 rounded-[8px] border border-v2-border-border-muted bg-v2-background-bg-layer-01 p-3 text-left transition-[background-color,border-color] duration-150 ease-in-out hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none"
          >
            <IconV2 name={item.icon} class="text-v2-icon-icon-muted" />
            <span class="text-[13px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base">
              {language.t(item.label)}
            </span>
            <span class="text-[11px] font-[440] leading-4 tracking-[-0.04px] text-v2-text-text-muted">
              {language.t(item.description)}
            </span>
          </button>
        )}
      </For>
    </div>
  )
}
