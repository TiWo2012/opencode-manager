import { describe, expect, it } from "bun:test"
import { SwarmPolicy } from "@opencode-ai/core/swarm/policy"

describe("SwarmPolicy.decide", () => {
  it("maps 1-2 to automatic", () => {
    expect(SwarmPolicy.decide(1)).toBe("automatic")
    expect(SwarmPolicy.decide(2)).toBe("automatic")
  })

  it("maps 3-5 to self-review", () => {
    expect(SwarmPolicy.decide(3)).toBe("self-review")
    expect(SwarmPolicy.decide(5)).toBe("self-review")
  })

  it("maps 6-7 to reviewer", () => {
    expect(SwarmPolicy.decide(6)).toBe("reviewer")
    expect(SwarmPolicy.decide(7)).toBe("reviewer")
  })

  it("maps 8-9 to conservative", () => {
    expect(SwarmPolicy.decide(8)).toBe("conservative")
    expect(SwarmPolicy.decide(9)).toBe("conservative")
  })

  it("maps 10 to human-approval", () => {
    expect(SwarmPolicy.decide(10)).toBe("human-approval")
  })
})

describe("SwarmPolicy gates", () => {
  it("requires human approval only at score 10", () => {
    for (const score of [1, 3, 6, 8, 9] as const) {
      expect(SwarmPolicy.requiresHumanApproval(SwarmPolicy.decide(score))).toBe(false)
    }
    expect(SwarmPolicy.requiresHumanApproval(SwarmPolicy.decide(10))).toBe(true)
  })

  it("requires a reviewer at score >= 6", () => {
    for (const score of [1, 3, 5] as const) {
      expect(SwarmPolicy.requiresReviewer(SwarmPolicy.decide(score))).toBe(false)
    }
    for (const score of [6, 8, 10] as const) {
      expect(SwarmPolicy.requiresReviewer(SwarmPolicy.decide(score))).toBe(true)
    }
  })

  it("requires self-review at score >= 3", () => {
    expect(SwarmPolicy.requiresSelfReview(SwarmPolicy.decide(1))).toBe(false)
    expect(SwarmPolicy.requiresSelfReview(SwarmPolicy.decide(3))).toBe(true)
  })
})

describe("SwarmPolicy.reassess", () => {
  it("escalates when the proposed score is higher", () => {
    const result = SwarmPolicy.reassess(3, 8)
    expect(result.score).toBe(8)
    expect(result.escalated).toBe(true)
    expect(result.allowed).toBe(true)
    expect(result.decision).toBe("conservative")
  })

  it("escalation to 10 flips to human-approval", () => {
    const result = SwarmPolicy.reassess(2, 10)
    expect(result.decision).toBe("human-approval")
    expect(SwarmPolicy.requiresHumanApproval(result.decision)).toBe(true)
  })

  it("allows lowering only with a justification", () => {
    const justified = SwarmPolicy.reassess(8, 4, "The migration is now gated behind a feature flag and fully reversible.")
    expect(justified.allowed).toBe(true)
    expect(justified.escalated).toBe(false)
    expect(justified.decision).toBe("self-review")

    const unjustified = SwarmPolicy.reassess(8, 2)
    expect(unjustified.allowed).toBe(false)
  })

  it("keeps the score when unchanged", () => {
    const result = SwarmPolicy.reassess(4, 4)
    expect(result.score).toBe(4)
    expect(result.allowed).toBe(true)
    expect(result.escalated).toBe(false)
  })
})

describe("SwarmPolicy.describe", () => {
  it("produces a policy statement for every decision", () => {
    for (const decision of ["automatic", "self-review", "reviewer", "conservative", "human-approval"] as const) {
      expect(SwarmPolicy.describe(decision).length).toBeGreaterThan(0)
    }
    expect(SwarmPolicy.describe("human-approval")).toContain("HUMAN APPROVAL")
  })
})
