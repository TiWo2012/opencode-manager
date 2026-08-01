export * as SwarmEvent from "./swarm-event"

import { Schema } from "effect"
import { Event } from "./event"
import { optional } from "./schema"
import { Agent, ID, Info, Plan, PolicyDecision, RiskAssessment } from "./swarm"

const SwarmID = ID

/** A swarm was created. */
export const Created = Event.define({
  type: "swarm.created",
  schema: {
    swarm: Info,
  },
})

/** Full swarm snapshot published on any state change. */
export const Updated = Event.define({
  type: "swarm.updated",
  schema: {
    swarm: Info,
  },
})

/** The planner produced a plan (includes the risk assessment). */
export const PlanCreated = Event.define({
  type: "swarm.plan.created",
  schema: {
    swarmID: SwarmID,
    plan: Plan,
  },
})

/** The plan was approved (explicitly by a human, or automatically by policy). */
export const PlanApproved = Event.define({
  type: "swarm.plan.approved",
  schema: {
    swarmID: SwarmID,
    automatic: optional(Schema.Boolean),
  },
})

/** The swarm began executing its task graph. */
export const Started = Event.define({
  type: "swarm.started",
  schema: {
    swarmID: SwarmID,
  },
})

/** The swarm reached a terminal success state. */
export const Completed = Event.define({
  type: "swarm.completed",
  schema: {
    swarmID: SwarmID,
    result: optional(Schema.String),
  },
})

/** The swarm failed. */
export const Failed = Event.define({
  type: "swarm.failed",
  schema: {
    swarmID: SwarmID,
    error: Schema.String,
  },
})

/** The swarm was cancelled. */
export const Cancelled = Event.define({
  type: "swarm.cancelled",
  schema: {
    swarmID: SwarmID,
  },
})

/** A swarm agent changed status (working, waiting, blocked, ...). */
export const AgentStatus = Event.define({
  type: "swarm.agent.status",
  schema: {
    swarmID: SwarmID,
    agent: Agent,
  },
})

/** A swarm agent completed successfully. */
export const AgentCompleted = Event.define({
  type: "swarm.agent.completed",
  schema: {
    swarmID: SwarmID,
    agent: Agent,
  },
})

/** A swarm agent failed. */
export const AgentFailed = Event.define({
  type: "swarm.agent.failed",
  schema: {
    swarmID: SwarmID,
    agent: Agent,
  },
})

/** A swarm agent is blocked (dependency failed, or explicit block). */
export const AgentBlocked = Event.define({
  type: "swarm.agent.blocked",
  schema: {
    swarmID: SwarmID,
    agent: Agent,
    reason: Schema.String,
  },
})

/** The risk policy requires a dedicated reviewer before continuing. */
export const ReviewRequired = Event.define({
  type: "swarm.review.required",
  schema: {
    swarmID: SwarmID,
    agent: Agent,
    policy: PolicyDecision,
  },
})

/** A review pass finished. */
export const ReviewCompleted = Event.define({
  type: "swarm.review.completed",
  schema: {
    swarmID: SwarmID,
    agent: Agent,
  },
})

/** An agent branch was merged into the integration branch. */
export const MergeCompleted = Event.define({
  type: "swarm.merge.completed",
  schema: {
    swarmID: SwarmID,
    agent: Agent,
    target: Schema.String,
  },
})

/** The risk assessment was re-scored during execution. */
export const RiskUpdated = Event.define({
  type: "swarm.risk.updated",
  schema: {
    swarmID: SwarmID,
    risk: RiskAssessment,
  },
})

/** Human approval is required before an operation proceeds. */
export const RequiresApproval = Event.define({
  type: "swarm.requires.approval",
  schema: {
    swarmID: SwarmID,
    action: Schema.String,
    message: Schema.String,
  },
})

/** Generic swarm notification (drives toasts + ntfy). */
export const Notify = Event.define({
  type: "swarm.notify",
  schema: {
    swarmID: SwarmID,
    title: Schema.String,
    message: Schema.String,
    level: Schema.Literals(["info", "success", "warning", "error"]),
  },
})

export const Definitions = Event.inventory(
  Created,
  Updated,
  PlanCreated,
  PlanApproved,
  Started,
  Completed,
  Failed,
  Cancelled,
  AgentStatus,
  AgentCompleted,
  AgentFailed,
  AgentBlocked,
  ReviewRequired,
  ReviewCompleted,
  MergeCompleted,
  RiskUpdated,
  RequiresApproval,
  Notify,
)
