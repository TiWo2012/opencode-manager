import type { Swarm } from "@opencode-ai/schema/swarm"

/** Actions a swarm agent accepts from the UI (absent from the generated SDK union). */
export type SwarmAgentAction = "cancel" | "merge" | "review" | "retry" | "approve-merge"

/** Human approval required before a swarm operation proceeds. */
export type SwarmApproval = {
  swarmID: string
  action: string
  message: string
}

/** Payload of `swarm.created` / `swarm.updated` events. */
export type SwarmSnapshotEvent = { properties: { swarm: Swarm.Info } }

/** Payload of the `swarm.requires.approval` event. */
export type SwarmApprovalEvent = { properties: SwarmApproval }

/** Payload of the `swarm.notify` event (drives toasts). */
export type SwarmNotifyEvent = {
  properties: {
    swarmID: string
    title: string
    message: string
    level: "info" | "success" | "warning" | "error"
  }
}
