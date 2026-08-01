import type { Swarm } from "@opencode-ai/schema/swarm"
import { usePlatform } from "@/context/platform"
import { type ServerSDK, useServerSDK } from "@/context/server-sdk"
import { authTokenFromCredentials } from "@/utils/server"
import type { Accessor } from "solid-js"
import type { SwarmAgentAction } from "./types"

export type SwarmCreateInput = { title: string; mode: Swarm.Mode; task?: string }
export type SwarmPlanInput = { swarmID: string; prompt: string }
export type SwarmAgentInput = { swarmID: string; agentID: string; action: SwarmAgentAction; message?: string }

export type SwarmClient = {
  list(): Promise<Swarm.Info[]>
  get(swarmID: string): Promise<Swarm.Info>
  create(input: SwarmCreateInput): Promise<Swarm.Info>
  plan(input: SwarmPlanInput): Promise<Swarm.Info>
  approve(swarmID: string): Promise<Swarm.Info>
  start(swarmID: string): Promise<Swarm.Info>
  cancel(swarmID: string): Promise<Swarm.Info>
  agent(input: SwarmAgentInput): Promise<Swarm.Info>
}

/**
 * Raw HTTP client for the swarm endpoints, which are not part of the generated
 * SDK. `directory` (string or accessor) is resolved per call so routing stays
 * correct when the active project changes. `serverSDK` / `fetch` may be injected
 * for tests; by default they resolve from the app's server context.
 */
export function createSwarmClient(
  directory: string | Accessor<string>,
  input?: { serverSDK?: () => ServerSDK; fetch?: typeof globalThis.fetch },
): SwarmClient {
  const serverSDK = input?.serverSDK ?? (() => useServerSDK()())
  const fetch_ = input?.fetch ?? usePlatform().fetch ?? globalThis.fetch
  const currentDirectory = () => (typeof directory === "function" ? directory() : directory)

  async function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const sdk = serverSDK()
    const server = sdk.server.http
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-opencode-directory": currentDirectory(),
    }
    if (server.password) {
      headers.Authorization = `Basic ${authTokenFromCredentials({ username: server.username, password: server.password })}`
    }
    const response = await fetch_(new URL(path, sdk.url).toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const error = (await response.json().catch(() => undefined)) as { data?: { message?: string } } | undefined
      throw new Error(error?.data?.message ?? `Swarm request failed (${response.status})`)
    }
    return (await response.json()) as T
  }

  return {
    // Swarm support is additive; degrade silently when the server does not
    // expose the swarm API (e.g. embedded or test environments).
    async list() {
      return request<Swarm.Info[]>("/swarm/list", {}).catch(() => [])
    },
    get(swarmID) {
      return request<Swarm.Info>("/swarm/get", { swarmID })
    },
    create(input: SwarmCreateInput) {
      return request<Swarm.Info>("/swarm", input)
    },
    plan(input: SwarmPlanInput) {
      return request<Swarm.Info>("/swarm/plan", input)
    },
    approve(swarmID) {
      return request<Swarm.Info>("/swarm/approve", { swarmID })
    },
    start(swarmID) {
      return request<Swarm.Info>("/swarm/start", { swarmID })
    },
    cancel(swarmID) {
      return request<Swarm.Info>("/swarm/cancel", { swarmID })
    },
    agent(input: SwarmAgentInput) {
      return request<Swarm.Info>("/swarm/agent", input)
    },
  }
}
