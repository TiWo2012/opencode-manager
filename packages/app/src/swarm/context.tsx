import type { Swarm } from "@opencode-ai/schema/swarm"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { createEffect, on, onCleanup, type Accessor } from "solid-js"
import { createStore } from "solid-js/store"
import { useServerSDK } from "@/context/server-sdk"
import { createSwarmClient } from "./client"
import { showToast } from "@/utils/toast"
import type {
  SwarmAgentAction,
  SwarmApproval,
  SwarmApprovalEvent,
  SwarmNotifyEvent,
  SwarmSnapshotEvent,
} from "./types"

type SwarmState = {
  swarms: Swarm.Info[]
  loaded: boolean
  pendingApproval: SwarmApproval | null
}

export const { use: useSwarm, provider: SwarmProvider } = createSimpleContext({
  name: "Swarm",
  init: (props: { directory: string | Accessor<string> }) => {
    const client = createSwarmClient(props.directory)
    const [store, setStore] = createStore<SwarmState>({
      swarms: [],
      loaded: false,
      pendingApproval: null,
    })

    const reconcile = (swarm: Swarm.Info) => {
      setStore("swarms", (swarms) => {
        const index = swarms.findIndex((item) => item.id === swarm.id)
        if (index === -1) return [swarm, ...swarms]
        return swarms.map((item) => (item.id === swarm.id ? swarm : item))
      })
    }

    async function refresh() {
      setStore("loaded", true)
      setStore("swarms", await client.list())
    }

    async function create(input: { title: string; mode: Swarm.Mode; task?: string }) {
      const swarm = await client.create(input)
      reconcile(swarm)
      return swarm
    }

    async function plan(input: { swarmID: string; prompt: string }) {
      const swarm = await client.plan(input)
      reconcile(swarm)
      return swarm
    }

    async function approve(swarmID: string) {
      const swarm = await client.approve(swarmID)
      reconcile(swarm)
      return swarm
    }

    async function start(swarmID: string) {
      const swarm = await client.start(swarmID)
      reconcile(swarm)
      return swarm
    }

    async function cancel(swarmID: string) {
      const swarm = await client.cancel(swarmID)
      reconcile(swarm)
      return swarm
    }

    async function agent(input: { swarmID: string; agentID: string; action: SwarmAgentAction; message?: string }) {
      const swarm = await client.agent(input)
      reconcile(swarm)
      return swarm
    }

    const clearApproval = () => setStore("pendingApproval", null)

    // Swarm events are not part of the generated SDK event union, so the event
    // type is widened and each payload is cast to its documented shape.
    const handleEvent = (event: { type: string; properties?: unknown }) => {
      if (event.type === "swarm.created" || event.type === "swarm.updated") {
        reconcile((event as unknown as SwarmSnapshotEvent).properties.swarm)
      } else if (event.type === "swarm.requires.approval") {
        setStore("pendingApproval", (event as unknown as SwarmApprovalEvent).properties)
      } else if (event.type === "swarm.notify") {
        const { title, message, level } = (event as unknown as SwarmNotifyEvent).properties
        showToast({
          title,
          description: message,
          variant: level === "success" ? "success" : level === "error" ? "error" : "default",
        })
      }
    }

    const currentDirectory = () => (typeof props.directory === "function" ? props.directory() : props.directory)

    // Resubscribe and refresh when the directory (or server) changes. The base
    // SSE stream reconnects on its own; this only re-registers the listener.
    let unsubscribe: (() => void) | undefined
    const subscription = () => [currentDirectory(), useServerSDK()().url] as const
    createEffect(
      on(subscription, ([directory]) => {
        unsubscribe?.()
        unsubscribe = useServerSDK()().event.on(directory, handleEvent)
        void refresh()
      }),
    )
    onCleanup(() => unsubscribe?.())

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
