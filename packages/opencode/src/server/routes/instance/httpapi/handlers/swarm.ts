import { Swarm } from "@opencode-ai/schema/swarm"
import { SwarmManager } from "@/swarm/manager"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { SwarmApiError } from "../groups/swarm"

function mapSwarmError<A, R>(self: Effect.Effect<A, SwarmManager.Error, R>) {
  return self.pipe(
    Effect.mapError((error) => new SwarmApiError({ name: "SwarmError", data: { message: error.message } })),
  )
}

export const swarmHandlers = HttpApiBuilder.group(InstanceHttpApi, "swarm", (handlers) =>
  Effect.gen(function* () {
    const manager = yield* SwarmManager.Service

    const create = Effect.fn("SwarmHttpApi.create")(function* (ctx: { payload: Swarm.CreateInput }) {
      return yield* mapSwarmError(manager.create(ctx.payload))
    })

    const list = Effect.fn("SwarmHttpApi.list")(function* () {
      return yield* manager.list()
    })

    const get = Effect.fn("SwarmHttpApi.get")(function* (ctx: { payload: Swarm.IDInput }) {
      return yield* mapSwarmError(manager.get(ctx.payload.swarmID))
    })

    const plan = Effect.fn("SwarmHttpApi.plan")(function* (ctx: { payload: Swarm.PlanInput }) {
      return yield* mapSwarmError(manager.plan(ctx.payload))
    })

    const approve = Effect.fn("SwarmHttpApi.approve")(function* (ctx: { payload: Swarm.IDInput }) {
      return yield* mapSwarmError(manager.approve(ctx.payload.swarmID))
    })

    const start = Effect.fn("SwarmHttpApi.start")(function* (ctx: { payload: Swarm.IDInput }) {
      return yield* mapSwarmError(manager.start(ctx.payload.swarmID))
    })

    const cancel = Effect.fn("SwarmHttpApi.cancel")(function* (ctx: { payload: Swarm.IDInput }) {
      return yield* mapSwarmError(manager.cancel(ctx.payload.swarmID))
    })

    const agent = Effect.fn("SwarmHttpApi.agent")(function* (ctx: { payload: Swarm.AgentInput }) {
      return yield* mapSwarmError(manager.agent(ctx.payload))
    })

    return handlers
      .handle("create", create)
      .handle("list", list)
      .handle("get", get)
      .handle("plan", plan)
      .handle("approve", approve)
      .handle("start", start)
      .handle("cancel", cancel)
      .handle("agent", agent)
  }),
)
