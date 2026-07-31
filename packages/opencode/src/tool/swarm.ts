import { Swarm } from "@opencode-ai/schema/swarm"
import { SwarmService } from "@/swarm/service"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { Effect, Option, Schema } from "effect"
import * as Tool from "./tool"

export const Parameters = Schema.Struct({
  mode: Schema.optional(Schema.Literals(["normal", "yolo"])).annotate({
    description: "Swarm mode. 'yolo' executes autonomously on a dedicated yolo branch.",
  }),
  task: Schema.optional(Schema.String).annotate({
    description: "The task for the swarm to plan and execute. Setting this creates and plans a swarm.",
  }),
  action: Schema.optional(
    Schema.Literals(["status", "start", "cancel", "merge", "review", "feedback", "approve"]),
  ).annotate({
    description: "Control action to run against an existing swarm.",
  }),
  swarmID: Schema.optional(Schema.String).annotate({
    description: "The swarm ID returned when the swarm was created.",
  }),
  agentID: Schema.optional(Schema.String).annotate({
    description: "Agent ID within the swarm (used with merge/review/feedback actions).",
  }),
  message: Schema.optional(Schema.String).annotate({
    description: "Feedback message to send to an agent's session (used with the feedback action).",
  }),
})

function renderPlan(info: Swarm.Info) {
  const plan = info.plan
  if (!plan) return `Swarm ${info.id} (${info.mode}) has no plan yet`
  const lines = [
    `Swarm ${info.id} (${info.mode})`,
    `Plan: ${plan.summary}`,
    `Risk: ${plan.risk.score}/10 (${plan.risk.policy}) — ${plan.risk.reason}`,
    `Approved: ${info.approved === true ? "yes" : "no"}`,
    ...plan.tasks.map(
      (task) =>
        `- ${task.id}: ${task.title} [${task.agent ?? "general"}]${task.dependsOn.length > 0 ? ` (after ${task.dependsOn.join(", ")})` : ""}`,
    ),
  ]
  return lines.join("\n")
}

function renderStatus(info: Swarm.Info) {
  const lines = [
    `Swarm ${info.id} (${info.mode}) — ${info.status}`,
    info.title,
    `Approved: ${info.approved === true ? "yes" : "no"}`,
    ...info.agents.map((agent) => {
      const extras = [
        agent.error ? ` error: ${agent.error}` : "",
        agent.review?.status === "issues" ? ` review: ${agent.review.findings.length} finding(s)` : "",
        agent.merge?.status ? ` merge: ${agent.merge.status}` : "",
      ].join("")
      return `- ${agent.id} [${agent.role ?? "general"}]: ${agent.status}${extras}`
    }),
  ]
  return lines.join("\n")
}

export const SwarmTool = Tool.define(
  "swarm",
  Effect.gen(function* () {
    const flags = yield* RuntimeFlags.Service
    return {
      description: [
        "Create, plan, and control multi-agent swarms. Use mode 'yolo' for autonomous execution on a dedicated yolo branch.",
        "To create a swarm pass a task; the swarm tool plans it and reports tasks, dependencies, risk score, and the policy decision.",
        "Start approved swarms with action 'start', inspect progress with 'status', and review or merge agents before final integration.",
      ].join("\n"),
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const managerOption = yield* Effect.serviceOption(SwarmService.Service)
          if (Option.isNone(managerOption)) {
            return yield* Effect.die(new Error("Swarm service is not available"))
          }
          const manager = managerOption.value

          if (params.task) {
            // `opencode --yolo` (OPENCODE_YOLO) makes yolo the default mode.
            const mode = params.mode ?? (flags.swarmYolo ? "yolo" : "normal")
            const info = yield* manager.create({ title: params.task, mode, task: params.task })
            const planned = yield* manager.plan({ swarmID: info.id, prompt: params.task })
            return { title: "Swarm planned", metadata: {}, output: renderPlan(planned) }
          }
          if (!params.swarmID) {
            return yield* Effect.die(new Error("Provide a task to create a swarm or a swarmID to control one"))
          }

          const id = Schema.decodeUnknownSync(Swarm.ID)(params.swarmID)
          const action = params.action ?? "status"
          if (action === "status") {
            const info = yield* manager.get(id)
            return { title: "Swarm status", metadata: {}, output: renderStatus(info) }
          }
          if (action === "start") {
            return { title: "Swarm started", metadata: {}, output: renderStatus(yield* manager.start(id)) }
          }
          if (action === "cancel") {
            return { title: "Swarm cancelled", metadata: {}, output: renderStatus(yield* manager.cancel(id)) }
          }
          if (action === "approve") {
            return { title: "Swarm approved", metadata: {}, output: renderStatus(yield* manager.approve(id)) }
          }
          if (action === "merge" || action === "review" || action === "feedback") {
            if (!params.agentID) {
              return yield* Effect.die(new Error(`agentID is required for action '${action}'`))
            }
            const input: Swarm.AgentInput = {
              swarmID: id,
              agentID: params.agentID,
              action: action === "feedback" || action === "review" ? "review" : "merge",
              ...(params.message ? { message: params.message } : {}),
            }
            return { title: "Swarm agent updated", metadata: {}, output: renderStatus(yield* manager.agent(input)) }
          }
          return { title: "Swarm", metadata: {}, output: `Unknown action: ${action}` }
        }).pipe(Effect.orDie),
    }
  }),
)
