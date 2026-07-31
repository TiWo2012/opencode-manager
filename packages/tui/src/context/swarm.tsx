import { createStore } from "solid-js/store"
import { onCleanup, onMount } from "solid-js"
import { createSimpleContext } from "./helper"
import { useEvent } from "./event"
import { useSDK } from "./sdk"
import type { Swarm } from "@opencode-ai/schema/swarm"

export type SwarmAgentAction = "cancel" | "merge" | "review" | "retry" | "approve-merge"

export type SwarmApproval = {
  swarmID: string
  action: string
  message: string
}

export const { use: useSwarm, provider: SwarmProvider } = createSimpleContext({
  name: "Swarm",
  init: () => {
    const sdk = useSDK()
    const event = useEvent()
    const [store, setStore] = createStore<{
      swarms: Swarm.Info[]
      loaded: boolean
      pendingApproval: SwarmApproval | null
    }>({
      swarms: [],
      loaded: false,
      pendingApproval: null,
    })

    function reconcile(swarm: Swarm.Info) {
      setStore("swarms", (swarms) => {
        const index = swarms.findIndex((item) => item.id === swarm.id)
        if (index === -1) return [swarm, ...swarms]
        return swarms.map((item) => (item.id === swarm.id ? swarm : item))
      })
    }

    async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
      const response = await sdk.fetch(new URL(path, sdk.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(sdk.headers ?? {}) },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const error = (await response.json().catch(() => undefined)) as { data?: { message?: string } } | undefined
        throw new Error(error?.data?.message ?? `Swarm request failed (${response.status})`)
      }
      return (await response.json()) as T
    }

    async function refresh() {
      setStore("loaded", true)
      // Swarm support is additive; degrade silently when the server does not
      // expose the swarm API (e.g. embedded or test environments).
      const swarms = await post<Swarm.Info[]>("/swarm/list", {}).catch(() => undefined)
      if (swarms) setStore("swarms", swarms)
    }

    async function create(input: { title: string; mode: "normal" | "yolo"; task?: string }) {
      const swarm = await post<Swarm.Info>("/swarm", input)
      reconcile(swarm)
      return swarm
    }

    async function plan(input: { swarmID: string; prompt: string }) {
      const swarm = await post<Swarm.Info>("/swarm/plan", input)
      reconcile(swarm)
      return swarm
    }

    async function approve(swarmID: string) {
      const swarm = await post<Swarm.Info>("/swarm/approve", { swarmID })
      reconcile(swarm)
      return swarm
    }

    async function start(swarmID: string) {
      const swarm = await post<Swarm.Info>("/swarm/start", { swarmID })
      reconcile(swarm)
      return swarm
    }

    async function cancel(swarmID: string) {
      const swarm = await post<Swarm.Info>("/swarm/cancel", { swarmID })
      reconcile(swarm)
      return swarm
    }

    async function agent(input: { swarmID: string; agentID: string; action: SwarmAgentAction; message?: string }) {
      const swarm = await post<Swarm.Info>("/swarm/agent", input)
      reconcile(swarm)
      return swarm
    }

    function clearApproval() {
      setStore("pendingApproval", null)
    }

    onMount(() => {
      void refresh()
      // Swarm events are not part of the generated SDK event union, so the
      // event type is widened and each payload is cast to its documented shape.
      const offCreated = event.on("swarm.created" as never, (evt) => {
        reconcile((evt as { properties: { swarm: Swarm.Info } }).properties.swarm)
      })
      const offUpdated = event.on("swarm.updated" as never, (evt) => {
        reconcile((evt as { properties: { swarm: Swarm.Info } }).properties.swarm)
      })
      const offApproval = event.on("swarm.requires.approval" as never, (evt) => {
        setStore("pendingApproval", (evt as { properties: SwarmApproval }).properties)
      })
      onCleanup(() => {
        offCreated()
        offUpdated()
        offApproval()
      })
    })

    return {
      data: store,
      get(id: string) {
        return store.swarms.find((item) => item.id === id)
      },
      refresh,
      create,
      plan,
      approve,
      start,
      cancel,
      agent,
      clearApproval,
    }
  },
})
