import { describe, expect, test } from "bun:test"
import { Swarm } from "../src/swarm"
import { SwarmGraph } from "../src/swarm-graph"

function agent(id: string, status: Swarm.AgentStatus, dependsOn: string[] = []): Swarm.Agent {
  return { id, name: id, task: `task ${id}`, status, dependsOn }
}

describe("swarm graph helpers", () => {
  test("topoOrder returns dependencies before dependents", () => {
    const order = SwarmGraph.topoOrder([
      { id: "a", title: "A", dependsOn: ["b"] },
      { id: "b", title: "B", dependsOn: ["c"] },
      { id: "c", title: "C", dependsOn: [] },
    ])
    expect(order.indexOf("c")).toBeLessThan(order.indexOf("b"))
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("a"))
    expect(new Set(order)).toEqual(new Set(["a", "b", "c"]))
  })

  test("topoOrder ignores cycles", () => {
    const order = SwarmGraph.topoOrder([
      { id: "a", title: "A", dependsOn: ["b"] },
      { id: "b", title: "B", dependsOn: ["a"] },
    ])
    expect(new Set(order)).toEqual(new Set(["a", "b"]))
  })

  test("ready returns queued or waiting agents with all deps successful", () => {
    const agents = [
      agent("a", "queued", ["b"]),
      agent("b", "completed"),
      agent("c", "waiting", ["a", "b"]),
      agent("d", "queued", ["missing"]),
      agent("e", "working", ["b"]),
    ]
    expect(SwarmGraph.ready(agents).sort()).toEqual(["a"])
  })

  test("blocked returns queued or waiting agents with a failed dep", () => {
    const agents = [
      agent("a", "queued", ["b"]),
      agent("b", "failed"),
      agent("c", "waiting", ["b", "d"]),
      agent("d", "completed"),
      agent("e", "queued", ["missing"]),
    ]
    expect(SwarmGraph.blocked(agents).sort()).toEqual(["a", "c"])
  })

  test("isDone is true only when every agent is terminal", () => {
    const done = [agent("a", "completed"), agent("b", "merged"), agent("c", "failed"), agent("d", "cancelled")]
    expect(SwarmGraph.isDone(done)).toBe(true)
    expect(SwarmGraph.isDone([...done, agent("e", "working")])).toBe(false)
    expect(SwarmGraph.isDone([])).toBe(true)
  })

  test("allSucceeded requires at least one agent and every success", () => {
    expect(SwarmGraph.allSucceeded([agent("a", "completed"), agent("b", "merged")])).toBe(true)
    expect(SwarmGraph.allSucceeded([agent("a", "completed"), agent("b", "failed")])).toBe(false)
    expect(SwarmGraph.allSucceeded([])).toBe(false)
  })
})
