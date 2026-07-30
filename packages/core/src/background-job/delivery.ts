import { Effect, Context, Layer } from "effect"
import type { Info } from "../background-job"

/**
 * Handler invoked when a background job reaches a terminal state.
 */
export type CompletionHandler = (info: Info) => Effect.Effect<void>

export interface Interface {
  readonly onComplete: CompletionHandler
}

export class Service extends Context.Service<Service, Interface>()("@opencode/BackgroundJob/Delivery") {}

export const layerWith = (handler: CompletionHandler) =>
  Layer.succeed(Service, Service.of({ onComplete: handler }))

export * as BackgroundJobDelivery from "./delivery"
