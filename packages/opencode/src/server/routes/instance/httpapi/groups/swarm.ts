import { Swarm } from "@opencode-ai/schema/swarm"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"
import { described } from "./metadata"

export const SwarmPaths = {
  create: "/swarm",
  list: "/swarm/list",
  get: "/swarm/get",
  plan: "/swarm/plan",
  approve: "/swarm/approve",
  start: "/swarm/start",
  cancel: "/swarm/cancel",
  agent: "/swarm/agent",
} as const

export class SwarmApiError extends Schema.ErrorClass<SwarmApiError>("SwarmError")(
  {
    name: Schema.Literal("SwarmError"),
    data: Schema.Struct({ message: Schema.String }),
  },
  { httpApiStatus: 400 },
) {}

export const SwarmApi = HttpApi.make("swarm")
  .add(
    HttpApiGroup.make("swarm")
      .add(
        HttpApiEndpoint.post("create", SwarmPaths.create, {
          query: WorkspaceRoutingQuery,
          payload: Swarm.CreateInput,
          success: described(Swarm.Info, "Swarm created"),
          error: SwarmApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "swarm.create",
            summary: "Create a swarm",
            description: "Create a multi-agent swarm in normal or yolo mode.",
          }),
        ),
        HttpApiEndpoint.post("list", SwarmPaths.list, {
          query: WorkspaceRoutingQuery,
          payload: Schema.Struct({}),
          success: described(Schema.Array(Swarm.Info), "Swarm list"),
          error: SwarmApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "swarm.list",
            summary: "List swarms",
            description: "List all swarms for the current project.",
          }),
        ),
        HttpApiEndpoint.post("get", SwarmPaths.get, {
          query: WorkspaceRoutingQuery,
          payload: Swarm.IDInput,
          success: described(Swarm.Info, "Swarm snapshot"),
          error: SwarmApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "swarm.get",
            summary: "Get a swarm",
            description: "Get the current snapshot of a swarm.",
          }),
        ),
        HttpApiEndpoint.post("plan", SwarmPaths.plan, {
          query: WorkspaceRoutingQuery,
          payload: Swarm.PlanInput,
          success: described(Swarm.Info, "Swarm planned"),
          error: SwarmApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "swarm.plan",
            summary: "Plan a swarm",
            description: "Generate a task plan and risk assessment for a swarm.",
          }),
        ),
        HttpApiEndpoint.post("approve", SwarmPaths.approve, {
          query: WorkspaceRoutingQuery,
          payload: Swarm.IDInput,
          success: described(Swarm.Info, "Swarm approved"),
          error: SwarmApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "swarm.approve",
            summary: "Approve a swarm plan",
            description: "Approve a swarm plan so it can start.",
          }),
        ),
        HttpApiEndpoint.post("start", SwarmPaths.start, {
          query: WorkspaceRoutingQuery,
          payload: Swarm.IDInput,
          success: described(Swarm.Info, "Swarm started"),
          error: SwarmApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "swarm.start",
            summary: "Start a swarm",
            description: "Start executing a swarm's task graph.",
          }),
        ),
        HttpApiEndpoint.post("cancel", SwarmPaths.cancel, {
          query: WorkspaceRoutingQuery,
          payload: Swarm.IDInput,
          success: described(Swarm.Info, "Swarm cancelled"),
          error: SwarmApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "swarm.cancel",
            summary: "Cancel a swarm",
            description: "Cancel a running swarm and its agents.",
          }),
        ),
        HttpApiEndpoint.post("agent", SwarmPaths.agent, {
          query: WorkspaceRoutingQuery,
          payload: Swarm.AgentInput,
          success: described(Swarm.Info, "Swarm updated"),
          error: SwarmApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "swarm.agent",
            summary: "Control a swarm agent",
            description: "Cancel, merge, review, retry, or send feedback to a swarm agent.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "swarm",
          description: "Swarm orchestration routes.",
        }),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "opencode swarm HttpApi",
      version: "0.0.1",
      description: "HttpApi surface for multi-agent swarm orchestration.",
    }),
  )
