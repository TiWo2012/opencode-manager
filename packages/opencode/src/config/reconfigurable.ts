export * as ConfigReconfigurable from "./reconfigurable"

import { Context, Effect } from "effect"
import type { Config } from "./config"

export interface Reconfigurable {
  readonly id: string
  readonly reconfigure: (config: Config.Info) => Effect.Effect<void>
  readonly configKeys: readonly string[]
}

export class Registry extends Context.Service<Registry, Interface>()("@opencode/ConfigReconfigurableRegistry") {}

export interface Interface {
  readonly register: (reconfigurable: Reconfigurable) => Effect.Effect<void>
  readonly unregister: (id: string) => Effect.Effect<void>
  readonly entries: () => Effect.Effect<readonly Reconfigurable[]>
  readonly reconfigure: (changedKeys: readonly string[], config: Config.Info) => Effect.Effect<void>
}

export const layer = Context.Service.layer(
  Registry,
  Effect.gen(function* () {
    const items = new Map<string, Reconfigurable>()

    const register = Effect.fnUntraced(function* (reconfigurable: Reconfigurable) {
      items.set(reconfigurable.id, reconfigurable)
    })

    const unregister = Effect.fnUntraced(function* (id: string) {
      items.delete(id)
    })

    const entries = Effect.sync(() => Array.from(items.values()))

    const reconfigure = Effect.fnUntraced(function* (changedKeys: readonly string[], config: Config.Info) {
      yield* Effect.forEach(
        Array.from(items.values()),
        (reconfigurable) =>
          reconfigurable.configKeys.some((key) => changedKeys.includes(key))
            ? reconfigurable.reconfigure(config).pipe(
                Effect.catch((err) =>
                  Effect.logWarning("reconfiguration failed", {
                    service: reconfigurable.id,
                    error: String(err),
                  }),
                ),
                Effect.asVoid,
              )
            : Effect.void,
        { discard: true },
      )
    })

    return Registry.of({ register, unregister, entries, reconfigure })
  }),
)
