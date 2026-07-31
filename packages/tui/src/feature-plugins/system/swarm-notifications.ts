import type { TuiAttentionSoundName, TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { Swarm } from "@opencode-ai/schema/swarm"
import type { BuiltinTuiPlugin } from "../builtins"

const id = "internal:swarm-notifications"

// Swarm events are not part of the generated SDK event union, so they are
// subscribed through a narrow local adapter that widens the event type and
// casts each payload to its documented shape.
function onSwarmEvent<Type extends string>(
  api: TuiPluginApi,
  type: Type,
  handler: (event: { type: Type; properties: Record<string, unknown> }) => void,
) {
  return api.event.on(type as never, handler as never)
}

type SwarmNotifyLevel = "info" | "success" | "warning" | "error"

function notify(api: TuiPluginApi, message: string, sound: TuiAttentionSoundName) {
  void api.attention.notify({
    title: "Swarm",
    message,
    notification: { when: "blurred" },
    sound: { name: sound, when: "always" },
  })
}

function agentLabel(agent: Swarm.Agent) {
  return `${agent.name} (${agent.task})`
}

const tui: TuiPlugin = async (api) => {
  onSwarmEvent(api, "swarm.agent.failed", (event) => {
    const { agent } = event.properties as { agent: Swarm.Agent }
    notify(api, `Agent failed: ${agentLabel(agent)}`, "error")
  })

  onSwarmEvent(api, "swarm.agent.blocked", (event) => {
    const { agent, reason } = event.properties as { agent: Swarm.Agent; reason: string }
    notify(api, `Agent blocked: ${agentLabel(agent)} — ${reason}`, "question")
  })

  onSwarmEvent(api, "swarm.review.completed", (event) => {
    const { agent } = event.properties as { agent: Swarm.Agent }
    const findings = agent.review?.findings.length ?? 0
    if (findings > 0) notify(api, `Reviewer found ${findings} issue${findings === 1 ? "" : "s"} in ${agent.name}`, "question")
  })

  onSwarmEvent(api, "swarm.merge.completed", (event) => {
    const { agent } = event.properties as { agent: Swarm.Agent }
    if (agent.merge?.status === "conflict") notify(api, `Merge conflict in ${agent.name}`, "question")
  })

  onSwarmEvent(api, "swarm.requires.approval", (event) => {
    const { message } = event.properties as { swarmID: string; action: string; message: string }
    notify(api, `Human approval required: ${message}`, "question")
  })

  onSwarmEvent(api, "swarm.risk.updated", (event) => {
    const { risk } = event.properties as { swarmID: string; risk: Swarm.RiskAssessment }
    if (risk.escalated) notify(api, `Risk escalated to ${risk.score}/10`, "question")
  })

  onSwarmEvent(api, "swarm.completed", () => {
    notify(api, "Swarm done", "done")
  })

  onSwarmEvent(api, "swarm.failed", (event) => {
    const { error } = event.properties as { swarmID: string; error: string }
    notify(api, `Swarm failed: ${error}`, "error")
  })

  onSwarmEvent(api, "swarm.notify", (event) => {
    const { title, message, level } = event.properties as {
      swarmID: string
      title: string
      message: string
      level: SwarmNotifyLevel
    }
    void api.attention.notify({
      title,
      message,
      notification: { when: "blurred" },
      sound: { name: level === "warning" || level === "error" ? "question" : "default", when: "always" },
    })
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
