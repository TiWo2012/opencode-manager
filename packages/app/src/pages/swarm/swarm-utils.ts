import type { Swarm } from "@opencode-ai/schema/swarm"
import type { SwarmAgentAction } from "@/swarm/types"

const ACTIVE_STATUSES: ReadonlySet<Swarm.Status> = new Set(["idle", "planning", "running", "paused"])

/** A swarm is cancellable while it is not in a terminal state. */
export function swarmIsActive(status: Swarm.Status): boolean {
  return ACTIVE_STATUSES.has(status)
}

/**
 * The plan Approve action is offered while a swarm is still planning and not yet
 * approved. Normal mode always needs human approval; YOLO only when the risk
 * policy requires it.
 */
export function canApprove(info: Swarm.Info): boolean {
  if (info.status !== "planning" || info.approved === true) return false
  if (info.mode === "normal") return true
  return info.plan?.risk.policy === "human-approval"
}

/** The plan Start action is offered once the plan has been approved. */
export function canStart(info: Swarm.Info): boolean {
  return info.status === "planning" && info.approved === true
}

const TERMINAL_AGENT_STATUSES: ReadonlySet<Swarm.AgentStatus> = new Set([
  "completed",
  "merged",
  "failed",
  "cancelled",
])

/** Actions the UI offers for an agent based on its orchestration state. */
export function agentActions(agent: Swarm.Agent): SwarmAgentAction[] {
  const actions: SwarmAgentAction[] = []
  if (!TERMINAL_AGENT_STATUSES.has(agent.status)) actions.push("cancel")
  if (agent.status === "awaiting-review" || agent.review?.status === "required") {
    actions.push("merge", "review")
  }
  if (agent.merge?.status === "conflict") actions.push("approve-merge")
  if (agent.status === "failed" || agent.status === "blocked") actions.push("retry")
  return actions
}

/** Tailwind badge classes for a swarm status, mirroring the agent status colors. */
export function swarmStatusClass(status: Swarm.Status): string {
  if (status === "completed") return "bg-v2-state-bg-success text-v2-state-fg-success"
  if (status === "failed" || status === "cancelled") return "bg-v2-state-bg-danger text-v2-state-fg-danger"
  if (status === "planning" || status === "running") return "bg-v2-state-bg-info text-v2-state-fg-info"
  if (status === "paused") return "bg-v2-state-bg-warning text-v2-state-fg-warning"
  return "bg-v2-background-bg-layer-01 text-v2-text-text-muted"
}

/** Builds the `/swarm/new` path carrying the directory (and optional draft prompt). */
export function buildSwarmLaunchPath(directory: string, prompt?: string): string {
  const params = new URLSearchParams({ directory })
  if (prompt?.trim()) params.set("prompt", prompt)
  return `/swarm/new?${params.toString()}`
}

/** Formats an elapsed duration in milliseconds as a short human string. */
export function formatDuration(ms: number): string {
  if (ms >= 3_600_000) return `${Math.round(ms / 3_600_000)}h`
  if (ms >= 60_000) return `${Math.round(ms / 60_000)}m`
  return `${Math.max(1, Math.round(ms / 1000))}s`
}

/** Formats a timestamp as a short relative time string. */
export function formatRelativeTime(ms: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ms)
  if (diff < 60_000) return "just now"
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
