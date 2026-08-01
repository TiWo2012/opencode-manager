export * as Swarm from "./swarm"

import { Schema } from "effect"
import { ascending } from "./identifier"
import { NonNegativeInt, optional, statics } from "./schema"
import { SessionID } from "./session-id"

/**
 * Swarm contracts — the wire model for multi-agent orchestration.
 *
 * A swarm is a named group of agents working toward one task. Agents run in
 * isolated git worktrees and are scheduled from a dependency graph. In `yolo`
 * mode the swarm integrates work into a dedicated sandbox branch.
 */

export const ID = Schema.String.check(Schema.isStartsWith("swm")).pipe(
  Schema.brand("Swarm.ID"),
  statics((schema) => ({
    create: () => schema.make("swm_" + ascending()),
  })),
)
export type ID = typeof ID.Type

/** Normal mode keeps human approval; yolo mode integrates into a sandbox branch. */
export const Mode = Schema.Literals(["normal", "yolo"])
export type Mode = typeof Mode.Type

/** Overall swarm lifecycle status. */
export const Status = Schema.Literals([
  "idle",
  "planning",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
])
export type Status = typeof Status.Type

/** Per-agent orchestration state. */
export const AgentStatus = Schema.Literals([
  "planning",
  "queued",
  "waiting",
  "working",
  "blocked",
  "awaiting-review",
  "merging",
  "merged",
  "completed",
  "failed",
  "cancelled",
])
export type AgentStatus = typeof AgentStatus.Type

/** Fatality score 1-10: potential impact if autonomous execution goes wrong. */
export const RiskScore = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 10 }))
export type RiskScore = typeof RiskScore.Type

/**
 * Policy decision derived from the fatality score.
 *
 * 1-2   -> automatic
 * 3-5   -> automatic + self-review
 * 6-7   -> automatic + dedicated reviewer
 * 8-9   -> conservative execution + stronger validation
 * 10    -> human approval required
 */
export const PolicyDecision = Schema.Literals([
  "automatic",
  "self-review",
  "reviewer",
  "conservative",
  "human-approval",
])
export type PolicyDecision = typeof PolicyDecision.Type

export const RiskAssessment = Schema.Struct({
  score: RiskScore,
  reason: Schema.String,
  policy: PolicyDecision,
  escalated: Schema.optional(Schema.Boolean),
  assessedAt: NonNegativeInt,
})
export interface RiskAssessment extends Schema.Schema.Type<typeof RiskAssessment> {}

/** A single unit of work within a plan. */
export const PlanTask = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: optional(Schema.String),
  /** agent type to run the task with (e.g. "general", "explore"). */
  agent: optional(Schema.String),
  /** task ids that must complete successfully first. */
  dependsOn: Schema.Array(Schema.String),
  requiresReview: optional(Schema.Boolean),
  /** validation/verification steps for this task. */
  validation: optional(Schema.Array(Schema.String)),
})
export interface PlanTask extends Schema.Schema.Type<typeof PlanTask> {}

export const Plan = Schema.Struct({
  summary: Schema.String,
  tasks: Schema.Array(PlanTask),
  risk: RiskAssessment,
})
export interface Plan extends Schema.Schema.Type<typeof Plan> {}

export const ReviewFinding = Schema.Struct({
  severity: Schema.Literals(["info", "warning", "error"]),
  message: Schema.String,
})
export interface ReviewFinding extends Schema.Schema.Type<typeof ReviewFinding> {}

export const Review = Schema.Struct({
  status: Schema.Literals(["required", "in-progress", "passed", "issues"]),
  findings: Schema.Array(ReviewFinding),
})
export interface Review extends Schema.Schema.Type<typeof Review> {}

export const MergeStatus = Schema.Literals(["pending", "merging", "merged", "conflict", "failed"])
export type MergeStatus = typeof MergeStatus.Type

export const MergeState = Schema.Struct({
  status: MergeStatus,
  target: Schema.String,
  message: optional(Schema.String),
})
export interface MergeState extends Schema.Schema.Type<typeof MergeState> {}

/** A swarm agent: one unit of work running in its own worktree. */
export const Agent = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  role: optional(Schema.String),
  task: Schema.String,
  status: AgentStatus,
  dependsOn: Schema.Array(Schema.String),
  branch: optional(Schema.String),
  worktree: optional(Schema.String),
  sessionID: optional(SessionID),
  startedAt: optional(NonNegativeInt),
  completedAt: optional(NonNegativeInt),
  filesChanged: optional(NonNegativeInt),
  additions: optional(NonNegativeInt),
  deletions: optional(NonNegativeInt),
  error: optional(Schema.String),
  review: optional(Review),
  merge: optional(MergeState),
})
export interface Agent extends Schema.Schema.Type<typeof Agent> {}

export const Info = Schema.Struct({
  id: ID,
  projectID: Schema.String,
  title: Schema.String,
  mode: Mode,
  status: Status,
  task: optional(Schema.String),
  plan: optional(Plan),
  agents: Schema.Array(Agent),
  /** branch the swarm integrates into (always "yolo" in yolo mode). */
  integrationBranch: optional(Schema.String),
  baseBranch: optional(Schema.String),
  risk: optional(RiskAssessment),
  approved: optional(Schema.Boolean),
  result: optional(Schema.String),
  createdAt: NonNegativeInt,
  updatedAt: NonNegativeInt,
})
export interface Info extends Schema.Schema.Type<typeof Info> {}

// ---- inputs ----

export const CreateInput = Schema.Struct({
  title: Schema.String,
  mode: Mode,
  task: optional(Schema.String),
}).annotate({ identifier: "SwarmCreateInput" })
export type CreateInput = Schema.Schema.Type<typeof CreateInput>

export const PlanInput = Schema.Struct({
  swarmID: ID,
  prompt: Schema.String,
}).annotate({ identifier: "SwarmPlanInput" })
export type PlanInput = Schema.Schema.Type<typeof PlanInput>

export const IDInput = Schema.Struct({
  swarmID: ID,
}).annotate({ identifier: "SwarmIDInput" })
export type IDInput = Schema.Schema.Type<typeof IDInput>

export const AgentAction = Schema.Literals(["cancel", "merge", "review", "retry", "approve-merge"])
export type AgentAction = typeof AgentAction.Type

export const AgentInput = Schema.Struct({
  swarmID: ID,
  agentID: Schema.String,
  action: AgentAction,
  message: optional(Schema.String),
}).annotate({ identifier: "SwarmAgentInput" })
export type AgentInput = Schema.Schema.Type<typeof AgentInput>
