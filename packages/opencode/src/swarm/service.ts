import { Swarm } from "@opencode-ai/schema/swarm"
import { Context, Effect, Schema } from "effect"

/**
 * Swarm service contract.
 *
 * Kept in a leaf module so tool and HTTP layers can reference the service tag
 * without pulling in the full swarm manager (which depends on the session and
 * prompt stacks that in turn load the tool registry).
 */

export class SwarmNotFound extends Schema.TaggedErrorClass<SwarmNotFound>()("SwarmNotFound", {
  swarmID: Swarm.ID,
  message: Schema.String,
}) {}

export class SwarmConflict extends Schema.TaggedErrorClass<SwarmConflict>()("SwarmConflict", {
  swarmID: Swarm.ID,
  message: Schema.String,
}) {}

export type Error = SwarmNotFound | SwarmConflict

export interface Interface {
  readonly create: (input: Swarm.CreateInput) => Effect.Effect<Swarm.Info, Error>
  readonly list: () => Effect.Effect<Swarm.Info[]>
  readonly get: (swarmID: Swarm.ID) => Effect.Effect<Swarm.Info, Error>
  readonly plan: (input: Swarm.PlanInput) => Effect.Effect<Swarm.Info, Error>
  readonly approve: (swarmID: Swarm.ID) => Effect.Effect<Swarm.Info, Error>
  readonly start: (swarmID: Swarm.ID) => Effect.Effect<Swarm.Info, Error>
  readonly cancel: (swarmID: Swarm.ID) => Effect.Effect<Swarm.Info, Error>
  readonly agent: (input: Swarm.AgentInput) => Effect.Effect<Swarm.Info, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Swarm") {}

export * as SwarmService from "./service"
