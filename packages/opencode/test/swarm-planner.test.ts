import { describe, expect, it } from "bun:test"
import { SwarmPlanner } from "@/swarm/planner"

describe("SwarmPlanner.parsePlan", () => {
  it("parses a clean JSON plan", () => {
    const plan = SwarmPlanner.parsePlan(
      JSON.stringify({
        summary: "Add tests.",
        tasks: [
          { id: "a", title: "Add tests", agent: "general", dependsOn: [], validation: ["bun test"] },
        ],
        risk: { score: 2, reason: "Isolated and reversible." },
      }),
      1000,
    )
    expect(plan).toBeDefined()
    expect(plan?.tasks[0]?.id).toBe("a")
    expect(plan?.risk.score).toBe(2)
    expect(plan?.risk.policy).toBe("automatic")
  })

  it("parses JSON embedded in reasoning text with braces", () => {
    const plan = SwarmPlanner.parsePlan(
      `Let me think about this task. The function is { called: foo } and returns { x: 1 }.\n` +
        JSON.stringify({
          summary: "Add tests.",
          tasks: [{ id: "a", title: "Add tests", dependsOn: [] }],
          risk: { score: 1, reason: "Safe." },
        }),
      1000,
    )
    expect(plan).toBeDefined()
    expect(plan?.summary).toBe("Add tests.")
    expect(plan?.risk.score).toBe(1)
  })

  it("parses JSON inside markdown fences", () => {
    const plan = SwarmPlanner.parsePlan(
      "Here is the plan:\n```json\n" +
        JSON.stringify({
          summary: "Refactor.",
          tasks: [{ id: "b", title: "Refactor", dependsOn: [] }],
          risk: { score: 3, reason: "Touches build tooling." },
        }) +
        "\n```",
      1000,
    )
    expect(plan).toBeDefined()
    expect(plan?.risk.policy).toBe("self-review")
  })

  it("clamps out-of-range scores", () => {
    const high = SwarmPlanner.parsePlan(
      JSON.stringify({ summary: "x", tasks: [{ id: "t", title: "t" }], risk: { score: 42, reason: "r" } }),
      0,
    )
    expect(high?.risk.score).toBe(10)
    const low = SwarmPlanner.parsePlan(
      JSON.stringify({ summary: "x", tasks: [{ id: "t", title: "t" }], risk: { score: -3, reason: "r" } }),
      0,
    )
    expect(low?.risk.score).toBe(1)
  })

  it("returns undefined for unparseable output", () => {
    expect(SwarmPlanner.parsePlan("I cannot do this task.", 0)).toBeUndefined()
    expect(SwarmPlanner.parsePlan("", 0)).toBeUndefined()
  })
})

describe("SwarmPlanner.fallbackPlan", () => {
  it("uses a low-risk self-review default instead of a catastrophic score", () => {
    const plan = SwarmPlanner.fallbackPlan("Improve test coverage", 1000)
    expect(plan.risk.score).toBe(3)
    expect(plan.risk.policy).toBe("self-review")
    expect(plan.tasks[0]?.id).toBe("task-1")
    expect(plan.risk.reason).toContain("conservative")
  })
})
