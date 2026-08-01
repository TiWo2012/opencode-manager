export * as SwarmPolicy from "./policy"

import { Swarm } from "@opencode-ai/schema/swarm"

export type Decision = Swarm.PolicyDecision

/**
 * Map a fatality score (1-10) to a policy decision.
 *
 * The score measures the potential impact of autonomous execution going
 * catastrophically wrong — NOT complexity or difficulty. A huge refactor
 * isolated in a repository can be low-risk; a tiny destructive migration
 * can be high-risk.
 *
 * 1-2   -> automatic
 * 3-5   -> automatic + self-review
 * 6-7   -> automatic + dedicated reviewer
 * 8-9   -> conservative execution + stronger validation
 * 10    -> human approval required
 */
export const decide = (score: Swarm.RiskScore): Decision => {
  if (score <= 2) return "automatic"
  if (score <= 5) return "self-review"
  if (score <= 7) return "reviewer"
  if (score <= 9) return "conservative"
  return "human-approval"
}

export const requiresHumanApproval = (decision: Decision): boolean => decision === "human-approval"

export const requiresReviewer = (decision: Decision): boolean =>
  decision === "reviewer" || decision === "conservative" || decision === "human-approval"

export const requiresSelfReview = (decision: Decision): boolean => decision !== "automatic"

export const canAutoContinue = (decision: Decision): boolean => decision !== "human-approval"

/** Human-readable policy statement, used in the plan/risk output. */
export const describe = (decision: Decision): string => {
  switch (decision) {
    case "automatic":
      return "Continue automatically. No additional review is required by risk policy."
    case "self-review":
      return "Continue automatically. The swarm performs a self-review before final integration."
    case "reviewer":
      return "Continue automatically. A dedicated reviewer agent inspects the work before proceeding."
    case "conservative":
      return "Conservative execution. Stronger validation and review required; avoid irreversible operations."
    case "human-approval":
      return "HUMAN APPROVAL REQUIRED. Do not bypass this requirement in YOLO mode."
  }
}

export interface Reassessment {
  score: Swarm.RiskScore
  decision: Decision
  escalated: boolean
  /** false when a proposed decrease lacks justification. */
  allowed: boolean
  reason: string
}

/**
 * Dynamically re-score risk as execution unfolds.
 *
 * A score may always increase (escalation). A decrease is only allowed with
 * an explicit justification — the swarm must never lower a score merely to
 * avoid human approval, which is enforced by callers refusing justifications
 * that amount to bypassing the policy.
 */
export const reassess = (
  current: Swarm.RiskScore,
  proposed: Swarm.RiskScore,
  justification?: string,
): Reassessment => {
  if (proposed > current) {
    return {
      score: proposed,
      decision: decide(proposed),
      escalated: true,
      allowed: true,
      reason: "Risk escalated during execution: " + (justification ?? "situation changed"),
    }
  }
  if (proposed < current) {
    const hasJustification = justification !== undefined && justification.trim().length > 0
    return {
      score: proposed,
      decision: decide(proposed),
      escalated: false,
      allowed: hasJustification,
      reason: justification ?? "Risk lowered without justification",
    }
  }
  return {
    score: current,
    decision: decide(current),
    escalated: false,
    allowed: true,
    reason: justification ?? "Risk unchanged",
  }
}
