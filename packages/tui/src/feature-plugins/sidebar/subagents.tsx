import type { Session } from "@opencode-ai/sdk/v2"
import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, For, Show, createSignal } from "solid-js"

const id = "internal:sidebar-subagents"

function View(props: { api: TuiPluginApi; session_id: string }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current

  const allSessions = createMemo(() => props.api.state.session.list())
  const parentSession = createMemo(() => props.api.state.session.get(props.session_id))

  const children = createMemo(() => {
    const p = parentSession()
    if (!p) return []
    return allSessions()
      .filter((s) => s.parentID === props.session_id)
      .toSorted((a, b) => a.time.created - b.time.created)
  })

  const dot = (session: Session) => {
    const status = props.api.state.session.status(session.id)
    if (!status) return theme().textMuted
    if (status.type === "busy") return theme().warning
    if (status.type === "idle") return theme().success
    if (status.type === "retry") return theme().error
    return theme().textMuted
  }

  const statusLabel = (session: Session) => {
    const status = props.api.state.session.status(session.id)
    if (!status) return ""
    if (status.type === "busy") return "busy"
    if (status.type === "idle") return "idle"
    if (status.type === "retry") return "retry"
    return ""
  }

  const displayTitle = (session: Session) => {
    return session.title.replace(/\s*\(@\w+ subagent\)$/, "")
  }

  const agentLabel = (session: Session) => {
    const m = session.title.match(/\(@(\w+) subagent\)/)
    return m ? m[1] : session.agent ?? ""
  }

  const hasWorktree = (session: Session) => {
    const p = parentSession()
    if (!p) return false
    return session.directory !== p.directory
  }

  const worktreeName = (session: Session) => {
    const parts = session.directory.split("/")
    return parts.at(-1) ?? ""
  }

  const handleClick = (sessionID: string) => {
    props.api.route.navigate("session", { sessionID })
  }

  return (
    <Show when={children().length > 0}>
      <box>
        <box flexDirection="row" gap={1} onMouseDown={() => children().length > 2 && setOpen((x) => !x)}>
          <Show when={children().length > 2}>
            <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme().text}>
            <b>Subagents</b>
            <Show when={!open()}>
              <span style={{ fg: theme().textMuted }}>
                {" "}
                ({children().length}{" "}
                {children().length === 1 ? "active" : "active"})
              </span>
            </Show>
          </text>
        </box>
        <Show when={children().length <= 2 || open()}>
          <For each={children()}>
            {(session) => (
              <box
                flexDirection="row"
                gap={1}
                onMouseUp={() => handleClick(session.id)}
              >
                <text flexShrink={0} fg={dot(session)}>
                  •
                </text>
                <text fg={theme().text} wrapMode="none">
                  {displayTitle(session)}
                  <span style={{ fg: theme().textMuted }}>
                    {" · "}
                    {agentLabel(session)}
                    <Show when={statusLabel(session)}>
                      {" · "}
                      {statusLabel(session)}
                    </Show>
                    <Show when={hasWorktree(session)}>
                      {" · "}
                      {worktreeName(session)}
                    </Show>
                  </span>
                </text>
              </box>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 250,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
