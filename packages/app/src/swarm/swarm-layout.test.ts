import { describe, expect, test } from "bun:test"
import type { Swarm } from "@opencode-ai/schema/swarm"
import { swarmLayers } from "./swarm-layout"

const task = (id: string, dependsOn: string[] = []): Swarm.PlanTask => ({ id, title: id, dependsOn })

describe("swarmLayers", () => {
  test("puts tasks without dependencies in column 0", () => {
    expect(swarmLayers([task("a"), task("b"), task("c")])).toEqual([["a", "b", "c"]])
  })

  test("walks a linear chain left to right", () => {
    expect(swarmLayers([task("a"), task("b", ["a"]), task("c", ["b"])])).toEqual([["a"], ["b"], ["c"]])
  })

  test("puts a task after its deepest dependency", () => {
    expect(swarmLayers([task("root"), task("mid", ["root"]), task("leaf", ["root", "mid"])])).toEqual([
      ["root"],
      ["mid"],
      ["leaf"],
    ])
  })

  test("groups independent branches in the same column", () => {
    expect(swarmLayers([task("root"), task("left", ["root"]), task("right", ["root"])])).toEqual([
      ["root"],
      ["left", "right"],
    ])
  })

  test("merges a fork back into a single column", () => {
    const tasks = [
      task("root"),
      task("left", ["root"]),
      task("right", ["root"]),
      task("merge", ["left", "right"]),
    ]
    expect(swarmLayers(tasks)).toEqual([["root"], ["left", "right"], ["merge"]])
  })

  test("ignores dependencies that are not part of the plan", () => {
    expect(swarmLayers([task("a", ["ghost"]), task("b", ["ghost", "a"])])).toEqual([["a"], ["b"]])
  })

  test("falls back to column 0 for a dependency cycle", () => {
    expect(swarmLayers([task("a", ["b"]), task("b", ["a"])])).toEqual([["a", "b"]])
  })

  test("falls back to column 0 for a self dependency", () => {
    expect(swarmLayers([task("a", ["a"])])).toEqual([["a"]])
  })

  test("handles a cycle feeding a later task defensively", () => {
    const layers = swarmLayers([task("a", ["b"]), task("b", ["a"]), task("done", ["a", "b"])])
    expect(layers.flat()).toContain("done")
  })

  test("returns no layers for an empty plan", () => {
    expect(swarmLayers([])).toEqual([])
  })
})
