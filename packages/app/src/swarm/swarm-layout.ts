import type { Swarm } from "@opencode-ai/schema/swarm"

/**
 * Assign each plan task to a dependency layer: tasks with no in-plan
 * dependencies land in column 0, and a task sits one column past the deepest
 * column its dependencies occupy. Dependencies that are not part of the plan
 * are ignored, and tasks caught in a dependency cycle fall back to column 0.
 */
export function swarmLayers(tasks: readonly Swarm.PlanTask[]): string[][] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const column = new Map<string, number>()
  const remaining = new Set(tasks.map((task) => task.id))

  for (const task of tasks) {
    if (task.dependsOn.every((dep) => !byId.has(dep))) {
      column.set(task.id, 0)
      remaining.delete(task.id)
    }
  }

  while (remaining.size > 0) {
    let progressed = false
    for (const id of remaining) {
      const task = byId.get(id)!
      const deps = task.dependsOn.filter((dep) => byId.has(dep))
      if (deps.every((dep) => column.has(dep))) {
        column.set(id, 1 + Math.max(...deps.map((dep) => column.get(dep)!)))
        remaining.delete(id)
        progressed = true
      }
    }
    if (!progressed) break
  }

  for (const id of remaining) column.set(id, 0)

  const layers: string[][] = []
  for (const task of tasks) {
    const layer = column.get(task.id) ?? 0
    ;(layers[layer] ??= []).push(task.id)
  }
  return layers
}
