export * as SwarmGraph from "./swarm-graph"

import { Swarm } from "./swarm"

/**
 * Dependency graph primitives for swarm scheduling.
 *
 * Agents are scheduled from a plan's task dependency graph. A task may only
 * run once every task it depends on has reached a successful terminal state
 * (completed or merged). A task whose dependencies failed is blocked.
 */

export const SUCCESS_STATUSES: ReadonlySet<Swarm.AgentStatus> = new Set(["completed", "merged"])
export const TERMINAL_STATUSES: ReadonlySet<Swarm.AgentStatus> = new Set([
  "completed",
  "merged",
  "failed",
  "cancelled",
])

export const isSuccess = (status: Swarm.AgentStatus): boolean => SUCCESS_STATUSES.has(status)
export const isTerminal = (status: Swarm.AgentStatus): boolean => TERMINAL_STATUSES.has(status)

/** Tasks whose dependencies are all satisfied and which are ready to run. */
export function ready(agents: readonly Swarm.Agent[]): string[] {
  return agents
    .filter((agent) => agent.status === "queued" || agent.status === "waiting")
    .filter((agent) => agent.dependsOn.every((dep) => successFor(agents, dep)))
    .map((agent) => agent.id)
}

/** Tasks blocked by a failed dependency. */
export function blocked(agents: readonly Swarm.Agent[]): string[] {
  return agents
    .filter((agent) => agent.status === "queued" || agent.status === "waiting")
    .filter((agent) => agent.dependsOn.some((dep) => failedFor(agents, dep)))
    .map((agent) => agent.id)
}

/** True when every agent has reached a terminal state. */
export function isDone(agents: readonly Swarm.Agent[]): boolean {
  return agents.every((agent) => isTerminal(agent.status))
}

/** True when every agent succeeded. */
export function allSucceeded(agents: readonly Swarm.Agent[]): boolean {
  return agents.length > 0 && agents.every((agent) => isSuccess(agent.status))
}

/** Topological order of plan tasks (dependencies first). */
export function topoOrder(tasks: readonly Swarm.PlanTask[]): string[] {
  const order: string[] = []
  const visited = new Set<string>()
  const visit = (id: string, stack: Set<string>) => {
    if (visited.has(id) || stack.has(id)) return
    const task = tasks.find((item) => item.id === id)
    if (!task) return
    stack.add(id)
    for (const dep of task.dependsOn) visit(dep, stack)
    stack.delete(id)
    visited.add(id)
    order.push(id)
  }
  for (const task of tasks) visit(task.id, new Set())
  return order
}

function successFor(agents: readonly Swarm.Agent[], id: string): boolean {
  const agent = agents.find((item) => item.id === id)
  return agent ? isSuccess(agent.status) : false
}

function failedFor(agents: readonly Swarm.Agent[], id: string): boolean {
  const agent = agents.find((item) => item.id === id)
  return agent ? agent.status === "failed" : false
}
