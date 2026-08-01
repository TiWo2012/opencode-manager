import { describe, expect, test } from "bun:test"
import type { Swarm } from "@opencode-ai/schema/swarm"
import {
  agentActions,
  canApprove,
  canStart,
  formatDuration,
  formatRelativeTime,
  swarmIsActive,
  swarmStatusClass,
} from "./swarm-utils"

const info = (overrides: Partial<Swarm.Info> = {}): Swarm.Info => ({
  id: "swm_1" as Swarm.ID,
  projectID: "project",
  title: "Coverage",
  mode: "normal",
  status: "idle",
  agents: [],
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
})

const agent = (overrides: Partial<Swarm.Agent>): Swarm.Agent => ({
  id: "ag_1",
  name: "agent",
  task: "task",
  status: "working",
  dependsOn: [],
  ...overrides,
})

describe("swarmIsActive", () => {
  test("treats terminal states as inactive", () => {
    expect(swarmIsActive("completed")).toBe(false)
    expect(swarmIsActive("failed")).toBe(false)
    expect(swarmIsActive("cancelled")).toBe(false)
  })

  test("treats lifecycle states as active", () => {
    expect(swarmIsActive("idle")).toBe(true)
    expect(swarmIsActive("planning")).toBe(true)
    expect(swarmIsActive("running")).toBe(true)
    expect(swarmIsActive("paused")).toBe(true)
  })
})

describe("canApprove", () => {
  test("always offers approve for planning normal swarms", () => {
    expect(canApprove(info({ mode: "normal", status: "planning" }))).toBe(true)
  })

  test("withholds approve once the plan is approved", () => {
    expect(canApprove(info({ mode: "normal", status: "planning", approved: true }))).toBe(false)
  })

  test("only offers approve for yolo when the risk policy requires it", () => {
    const base = { mode: "yolo" as const, status: "planning" as const }
    expect(canApprove(info({ ...base, plan: { summary: "", tasks: [], risk: { score: 10, reason: "", policy: "human-approval", assessedAt: 1 } } }))).toBe(true)
    expect(canApprove(info({ ...base, plan: { summary: "", tasks: [], risk: { score: 3, reason: "", policy: "self-review", assessedAt: 1 } } }))).toBe(false)
  })

  test("withholds approve outside the planning state", () => {
    expect(canApprove(info({ status: "running", approved: false }))).toBe(false)
  })
})

describe("canStart", () => {
  test("offers start only for an approved planning swarm", () => {
    expect(canStart(info({ status: "planning", approved: true }))).toBe(true)
    expect(canStart(info({ status: "planning", approved: false }))).toBe(false)
    expect(canStart(info({ status: "running", approved: true }))).toBe(false)
  })
})

describe("agentActions", () => {
  test("offers cancel for active agents", () => {
    expect(agentActions(agent({ status: "working" }))).toContain("cancel")
  })

  test("offers no actions for terminal agents", () => {
    for (const status of ["completed", "merged", "cancelled"] as const) {
      expect(agentActions(agent({ status }))).toEqual([])
    }
  })

  test("offers merge and review while awaiting review", () => {
    const actions = agentActions(agent({ status: "awaiting-review" }))
    expect(actions).toContain("merge")
    expect(actions).toContain("review")
  })

  test("offers approve-merge when a merge is in conflict", () => {
    const actions = agentActions(agent({ status: "awaiting-review", merge: { status: "conflict", target: "yolo" } }))
    expect(actions).toContain("approve-merge")
  })

  test("offers retry for failed or blocked agents", () => {
    expect(agentActions(agent({ status: "failed" }))).toContain("retry")
    expect(agentActions(agent({ status: "blocked" }))).toContain("retry")
  })
})

describe("swarmStatusClass", () => {
  test("maps each status to a state color", () => {
    expect(swarmStatusClass("completed")).toContain("success")
    expect(swarmStatusClass("failed")).toContain("danger")
    expect(swarmStatusClass("cancelled")).toContain("danger")
    expect(swarmStatusClass("planning")).toContain("info")
    expect(swarmStatusClass("running")).toContain("info")
    expect(swarmStatusClass("paused")).toContain("warning")
    expect(swarmStatusClass("idle")).toContain("muted")
  })
})

describe("formatDuration", () => {
  test("formats seconds, minutes, and hours", () => {
    expect(formatDuration(5_000)).toBe("5s")
    expect(formatDuration(90_000)).toBe("2m")
    expect(formatDuration(7_200_000)).toBe("2h")
  })
})

describe("formatRelativeTime", () => {
  test("formats relative timestamps from the provided now", () => {
    expect(formatRelativeTime(5_000, 10_000)).toBe("just now")
    expect(formatRelativeTime(60_000, 300_000)).toBe("4m ago")
    expect(formatRelativeTime(3_600_000, 7_200_000)).toBe("1h ago")
    expect(formatRelativeTime(172_800_000, 259_200_000)).toBe("1d ago")
  })
})
