import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { httpClient } from "@opencode-ai/core/effect/app-node-platform"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Config } from "@/config/config"
import { SwarmEvent } from "@opencode-ai/schema/swarm-event"
import { Swarm } from "@opencode-ai/schema/swarm"
import { Context, Effect, Layer, Schema } from "effect"
import * as Stream from "effect/Stream"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"

/**
 * Swarm notification bridge.
 *
 * Subscribes to `swarm.*` events and fans them out to:
 *  - `SwarmEvent.Notify` (drives TUI toasts)
 *  - a real ntfy push when ntfy is configured and enabled
 */

export class Service extends Context.Service<Service, {}>()("@opencode/SwarmNotify") {}

export type Toast = {
  swarmID: Swarm.ID
  title: string
  message: string
  level: "info" | "success" | "warning" | "error"
}

const decodeSwarmID = Schema.decodeUnknownExit(Swarm.ID)

function swarmID(value: unknown): Swarm.ID | undefined {
  if (typeof value !== "string") return
  const exit = decodeSwarmID(value)
  return exit._tag === "Success" ? exit.value : undefined
}

function toToast(event: { type: string; data: Record<string, unknown> }): Toast | undefined {
  const data = event.data
  const id = swarmID(data.swarmID ?? (data.swarm as { id?: unknown } | undefined)?.id)
  if (!id) return
  switch (event.type) {
    case SwarmEvent.Created.type: {
      const info = data.swarm as { title?: unknown } | undefined
      return {
        swarmID: id,
        title: "Swarm created",
        message: typeof info?.title === "string" ? info.title : "A new swarm was created",
        level: "info",
      }
    }
    case SwarmEvent.PlanCreated.type:
      return { swarmID: id, title: "Swarm plan ready", message: "A plan has been generated and scored", level: "info" }
    case SwarmEvent.PlanApproved.type:
      return {
        swarmID: id,
        title: "Swarm plan approved",
        message: "The plan is approved and ready to start",
        level: "success",
      }
    case SwarmEvent.Started.type:
      return { swarmID: id, title: "Swarm started", message: "Agents are being scheduled", level: "info" }
    case SwarmEvent.Completed.type:
      return {
        swarmID: id,
        title: "Swarm completed",
        message: "All agents finished successfully",
        level: "success",
      }
    case SwarmEvent.Failed.type:
      return {
        swarmID: id,
        title: "Swarm failed",
        message: typeof data.error === "string" ? data.error : "The swarm failed",
        level: "error",
      }
    case SwarmEvent.Cancelled.type:
      return { swarmID: id, title: "Swarm cancelled", message: "The swarm was cancelled", level: "warning" }
    case SwarmEvent.AgentStatus.type: {
      const agent = data.agent as { name?: unknown; status?: unknown } | undefined
      return {
        swarmID: id,
        title: "Agent status",
        message: `${typeof agent?.name === "string" ? agent.name : "Agent"} → ${String(agent?.status ?? "")}`,
        level: "info",
      }
    }
    case SwarmEvent.AgentCompleted.type: {
      const agent = data.agent as { name?: unknown } | undefined
      return {
        swarmID: id,
        title: "Agent completed",
        message: `${typeof agent?.name === "string" ? agent.name : "Agent"} finished successfully`,
        level: "success",
      }
    }
    case SwarmEvent.AgentFailed.type: {
      const agent = data.agent as { name?: unknown } | undefined
      return {
        swarmID: id,
        title: "Agent failed",
        message: `${typeof agent?.name === "string" ? agent.name : "Agent"} failed`,
        level: "error",
      }
    }
    case SwarmEvent.AgentBlocked.type: {
      const agent = data.agent as { name?: unknown } | undefined
      return {
        swarmID: id,
        title: "Agent blocked",
        message: `${typeof agent?.name === "string" ? agent.name : "Agent"} is blocked: ${
          typeof data.reason === "string" ? data.reason : ""
        }`,
        level: "warning",
      }
    }
    case SwarmEvent.ReviewRequired.type: {
      const agent = data.agent as { name?: unknown } | undefined
      return {
        swarmID: id,
        title: "Review required",
        message: `${typeof agent?.name === "string" ? agent.name : "Agent"} needs a dedicated review`,
        level: "warning",
      }
    }
    case SwarmEvent.MergeCompleted.type: {
      const agent = data.agent as { name?: unknown } | undefined
      return {
        swarmID: id,
        title: "Merge completed",
        message: `${typeof agent?.name === "string" ? agent.name : "Agent"} merged into ${String(data.target ?? "")}`,
        level: "success",
      }
    }
    case SwarmEvent.RequiresApproval.type:
      return {
        swarmID: id,
        title: "Approval required",
        message: typeof data.message === "string" ? data.message : "An action needs human approval",
        level: "warning",
      }
    case SwarmEvent.Notify.type:
      return {
        swarmID: id,
        title: typeof data.title === "string" ? data.title : "Swarm",
        message: typeof data.message === "string" ? data.message : "",
        level: (["info", "success", "warning", "error"] as const).includes(data.level as never)
          ? (data.level as "info" | "success" | "warning" | "error")
          : "info",
      }
    default:
      return
  }
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const events = yield* EventV2Bridge.Service
    const config = yield* Config.Service
    const http = yield* HttpClient.HttpClient

    const sendNtfy = Effect.fn("SwarmNotify.sendNtfy")(function* (toast: Toast) {
      const httpOk = HttpClient.filterStatusOk(http)
      const cfg = yield* config.get()
      if (cfg.ntfy?.enabled === false) return
      const servers = cfg.ntfy?.servers
      if (!servers || Object.keys(servers).length === 0) return
      const entry = servers[Object.keys(servers)[0]!]
      if (!entry) return
      const baseUrl = entry.url.endsWith("/") ? entry.url.slice(0, -1) : entry.url
      const topic = entry.topic ?? "opencode"
      const headers: Record<string, string> = { "Content-Type": "text/plain" }
      if (entry.auth) headers["Authorization"] = entry.auth
      const request = HttpClientRequest.post(`${baseUrl}/${topic}`).pipe(
        HttpClientRequest.setHeaders(headers),
        HttpClientRequest.bodyText(`[${toast.level.toUpperCase()}] ${toast.title}\n${toast.message}`, "text/plain"),
      )
      yield* httpOk.execute(request).pipe(Effect.ignore)
    })

    const handle = Effect.fn("SwarmNotify.handle")(function* (event: {
      type: string
      data: Record<string, unknown>
    }) {
      if (!event.type.startsWith("swarm.")) return
      const toast = toToast(event)
      if (!toast) return
      // Notify events are already toasts; only forward the push, never re-publish.
      if (event.type !== SwarmEvent.Notify.type) {
        yield* events
          .publish(SwarmEvent.Notify, {
            swarmID: toast.swarmID,
            title: toast.title,
            message: toast.message,
            level: toast.level,
          })
          .pipe(Effect.ignore)
      }
      yield* sendNtfy(toast).pipe(Effect.ignore)
    })

    yield* Stream.runForEach(events.all(), (event) =>
      handle({ type: event.type, data: event.data as Record<string, unknown> }),
    ).pipe(Effect.forkScoped)

    return Service.of({})
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer: layer,
  deps: [EventV2Bridge.node, Config.node, httpClient],
})

export * as SwarmNotify from "./notify"
