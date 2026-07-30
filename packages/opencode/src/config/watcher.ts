export * as ConfigWatcher from "./watcher"

import { Config } from "./config"
import { ConfigReconfigurable } from "./reconfigurable"
import { Context, Effect, PubSub, Stream } from "effect"
import fs from "fs"
import path from "path"
import { Global } from "@opencode-ai/core/global"
import { isDeepStrictEqual } from "node:util"

export type ChangeEvent = {
  readonly type: "changed"
  readonly path: string
  readonly key: string
  readonly oldValue?: unknown
  readonly newValue?: unknown
}

export type ReloadedEvent = {
  readonly type: "reloaded"
  readonly config: Config.Info
}

export type ConfigEvent = ChangeEvent | ReloadedEvent

export interface Interface {
  readonly subscribe: () => Stream.Stream<ConfigEvent>
  readonly start: () => Effect.Effect<void>
  readonly stop: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ConfigWatcher") {}

function watchConfigFile(
  filepath: string,
  onChanged: () => void,
): Effect.Effect<() => void> {
  return Effect.sync(() => {
    const watcher = fs.watch(filepath, (eventType) => {
      if (eventType === "change") onChanged()
    })
    return () => {
      watcher.close()
    }
  })
}

function computeChangedKeys(oldConfig: Config.Info, newConfig: Config.Info): string[] {
  const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)])
  const changed: string[] = []
  for (const key of allKeys) {
    if (!isDeepStrictEqual((oldConfig as Record<string, unknown>)[key], (newConfig as Record<string, unknown>)[key])) {
      changed.push(key)
    }
  }
  return changed
}

function computeChanges(
  oldConfig: Config.Info,
  newConfig: Config.Info,
): ChangeEvent[] {
  const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)])
  const changes: ChangeEvent[] = []
  for (const key of allKeys) {
    const oldVal = (oldConfig as Record<string, unknown>)[key]
    const newVal = (newConfig as Record<string, unknown>)[key]
    if (!isDeepStrictEqual(oldVal, newVal)) {
      changes.push({
        type: "changed",
        path: "",
        key,
        oldValue: oldVal,
        newValue: newVal,
      })
    }
  }
  return changes
}

export const layer = Context.Service.layer(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const registry = yield* ConfigReconfigurable.Registry

    const events = yield* PubSub.unbounded<ConfigEvent>()
    let subscriptions: (() => void)[] = []
    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    let snapshot: Config.Info | undefined
    let started = false

    const getSnapshot = Effect.fnUntraced(function* () {
      if (!snapshot) snapshot = yield* config.get()
      return snapshot
    })

    const handleChange = Effect.fnUntraced(function* () {
      const oldConfig = yield* getSnapshot()

      const newConfig = yield* config.reload().pipe(
        Effect.catch((err) => {
          Effect.logError("config reload failed", { error: String(err) })
          return Effect.succeed(oldConfig)
        }),
      )
      snapshot = newConfig

      const changes = computeChanges(oldConfig, newConfig)
      if (changes.length === 0) return

      const changedKeys = changes.map((c) => c.key)
      for (const change of changes) {
        yield* PubSub.publish(events, change)
      }
      yield* PubSub.publish(events, { type: "reloaded", config: newConfig })

      yield* registry.reconfigure(changedKeys, newConfig)
    })

    const scheduleHandle = Effect.fnUntraced(function* () {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        Effect.runFork(handleChange.pipe(Effect.catch((err) => Effect.logError("config change handler failed", { error: String(err) }))))
      }, 300)
    })

    const start = Effect.fnUntraced(function* () {
      if (started) return
      started = true

      snapshot = yield* config.get()
      const dirs = yield* config.directories()

      const watchedPaths = new Set<string>()
      watchedPaths.add(path.join(Global.Path.config, "opencode.jsonc"))

      for (const dir of dirs) {
        const projectConfig = path.join(dir, "opencode.jsonc")
        if (projectConfig !== path.join(Global.Path.config, "opencode.jsonc") && fs.existsSync(projectConfig)) {
          watchedPaths.add(projectConfig)
        }
        const projectConfigJson = path.join(dir, "opencode.json")
        if (fs.existsSync(projectConfigJson)) {
          watchedPaths.add(projectConfigJson)
        }
      }

      subscriptions = []
      for (const filepath of watchedPaths) {
        if (!fs.existsSync(filepath)) continue
        const unwatch = yield* watchConfigFile(filepath, () => {
          Effect.runFork(scheduleHandle)
        })
        subscriptions.push(unwatch)
      }

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          for (const unwatch of subscriptions) unwatch()
          if (debounceTimer) clearTimeout(debounceTimer)
        }),
      )
    })

    const stop = Effect.fnUntraced(function* () {
      for (const unwatch of subscriptions) unwatch()
      subscriptions = []
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = undefined
      started = false
    })

    const subscribe = Effect.fnUntraced(function* () {
      return Stream.fromPubSub(events)
    })

    return Service.of({ subscribe, start, stop })
  }),
)
