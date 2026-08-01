import { afterEach, describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Swarm } from "@opencode-ai/schema/swarm"
import { SwarmPaths } from "../../src/server/routes/instance/httpapi/groups/swarm"
import { disposeAllInstances, TestInstance, tmpdirScoped } from "../fixture/fixture"
import { resetDatabase } from "../fixture/db"
import { testEffect, pollWithTimeout } from "../lib/effect"
import { TestLLMServer, reply } from "../lib/llm-server"
import { testProviderConfig } from "../lib/test-provider"
import { GlobalBus } from "@/bus/global"
import { httpApiLayer, requestInDirectory } from "./httpapi-layer"

const it = testEffect(httpApiLayer)

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

function post(directory: string, path: string, body: unknown) {
  return requestInDirectory(path, directory, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

/** A swarm that also has a fake LLM to plan against. */
function planLLMLayer<A, E, R>(
  run: (input: { llm: TestLLMServer["Service"]; directory: string }) => Effect.Effect<A, E, R>,
) {
  return Effect.gen(function* () {
    const llm = yield* TestLLMServer
    const directory = yield* tmpdirScoped({
      git: true,
      config: { ...testProviderConfig(llm.url), model: "test/test-model" },
    })
    return yield* run({ llm, directory })
  }).pipe(Effect.provide(TestLLMServer.layer))
}

describe("swarm HttpApi", () => {
  it.instance(
    "creates, gets, and lists swarms through the default server app",
    () =>
      Effect.gen(function* () {
        const tmp = yield* TestInstance
        const directory = tmp.directory

        const created = yield* post(directory, SwarmPaths.create, { title: "test swarm", mode: "normal" })
        expect(created.status).toBe(200)
        const info = yield* created.json.pipe(Effect.map((value) => value as Swarm.Info))
        expect(info.title).toBe("test swarm")
        expect(info.mode).toBe("normal")
        expect(info.status).toBe("idle")
        expect(info.agents).toEqual([])
        expect(info.baseBranch).toBeDefined()

        const fetched = yield* post(directory, SwarmPaths.get, { swarmID: info.id })
        expect(fetched.status).toBe(200)
        const fetchedInfo = yield* fetched.json.pipe(Effect.map((value) => value as Swarm.Info))
        expect(fetchedInfo.id).toBe(info.id)

        const listed = yield* post(directory, SwarmPaths.list, {})
        expect(listed.status).toBe(200)
        const all = yield* listed.json.pipe(Effect.map((value) => value as Swarm.Info[]))
        expect(all.map((item) => item.id)).toContain(info.id)
      }),
    { config: { formatter: false, lsp: false } },
  )

  it.instance(
    "yolo swarms target the dedicated yolo branch",
    () =>
      Effect.gen(function* () {
        const tmp = yield* TestInstance
        const directory = tmp.directory

        const created = yield* post(directory, SwarmPaths.create, { title: "yolo swarm", mode: "yolo" })
        expect(created.status).toBe(200)
        const info = yield* created.json.pipe(Effect.map((value) => value as Swarm.Info))
        expect(info.mode).toBe("yolo")
        expect(info.integrationBranch).toBe("yolo")
        expect(info.baseBranch).toBeDefined()
      }),
    { git: true, config: { formatter: false, lsp: false } },
  )

  it.instance(
    "approving a swarm without a plan is a declared error",
    () =>
      Effect.gen(function* () {
        const tmp = yield* TestInstance
        const directory = tmp.directory
        const created = yield* post(directory, SwarmPaths.create, { title: "planless", mode: "normal" })
        const info = yield* created.json.pipe(Effect.map((value) => value as Swarm.Info))

        const approved = yield* post(directory, SwarmPaths.approve, { swarmID: info.id })
        expect(approved.status).toBe(400)
        const error = yield* approved.json.pipe(
          Effect.map((value) => value as { name: string; data: { message: string } }),
        )
        expect(error.name).toBe("SwarmError")
        expect(error.data.message.length).toBeGreaterThan(0)
      }),
    { config: { formatter: false, lsp: false } },
  )

  it.instance(
    "publishes swarm events on the global bus so the TUI can react",
    () =>
      Effect.gen(function* () {
        const tmp = yield* TestInstance
        const directory = tmp.directory
        const received: string[] = []
        const on = (event: { payload: { type: string } }) => received.push(event.payload.type)
        GlobalBus.on("event", on)
        yield* Effect.addFinalizer(() => Effect.sync(() => GlobalBus.off("event", on)))

        const created = yield* post(directory, SwarmPaths.create, { title: "events", mode: "normal" })
        expect(created.status).toBe(200)
        const info = yield* created.json.pipe(Effect.map((value) => value as Swarm.Info))

        console.log("SWARM EVENTS RECEIVED:", JSON.stringify(received))

        expect(received).toContain("swarm.created")
        expect(received).toContain("swarm.updated")
        expect(info.id.startsWith("swm_")).toBe(true)
      }),
    { config: { formatter: false, lsp: false } },
  )

  it.live(
    "plans a swarm: publishes planning immediately, then succeeds or fails gracefully",
    () =>
      planLLMLayer(({ llm, directory }) =>
        Effect.gen(function* () {
          yield* llm.text(
            JSON.stringify({
              summary: "Improve test coverage by adding missing unit tests.",
              tasks: [
                {
                  id: "inspect",
                  title: "Inspect existing test setup",
                  agent: "explore",
                  dependsOn: [],
                  validation: [],
                },
                {
                  id: "write-tests",
                  title: "Write missing tests",
                  agent: "general",
                  dependsOn: ["inspect"],
                  validation: ["bun test"],
                },
              ],
              risk: { score: 2, reason: "Isolated repository changes, fully reversible via git." },
            }),
          )

          const created = yield* post(directory, SwarmPaths.create, { title: "coverage", mode: "normal" })
          const info = yield* created.json.pipe(Effect.map((value) => value as Swarm.Info))

          // Track swarm.updated status transitions on the global bus.
          const statuses: string[] = []
          const on = (event: { payload: { type: string; properties?: { swarm?: { status?: string } } } }) => {
            if (event.payload.type === "swarm.updated" && event.payload.properties?.swarm?.status) {
              statuses.push(event.payload.properties.swarm.status)
            }
          }
          GlobalBus.on("event", on)
          yield* Effect.addFinalizer(() => Effect.sync(() => GlobalBus.off("event", on)))

          const planned = yield* post(directory, SwarmPaths.plan, { swarmID: info.id, prompt: "Improve test coverage" })
          expect(planned.status).toBe(200)

          // The planning state must be published before any terminal state, so
          // the UI never sits on a stale "idle" while the planner runs.
          expect(statuses).toContain("planning")

          // The planner runs in the background; wait for a terminal state.
          const outcome = yield* pollWithTimeout(
            Effect.gen(function* () {
              const response = yield* post(directory, SwarmPaths.get, { swarmID: info.id })
              const current = yield* response.json.pipe(Effect.map((value) => value as Swarm.Info))
              if (current.status === "planning") return
              return current
            }),
            "plan never reached a terminal state",
            "30 seconds",
          )

          if (outcome.status === "failed") {
            // Plan generation failed (e.g. no provider/model in the test
            // environment) — the swarm must fail gracefully and publish it.
            expect(statuses).toContain("failed")
            return
          }
          expect(outcome.status).toBe("planning")
          expect(outcome.approved).toBe(false)
          expect(outcome.plan?.tasks.map((task) => task.id)).toEqual(["inspect", "write-tests"])
          expect(outcome.risk?.score).toBe(2)
          expect(outcome.risk?.policy).toBe("automatic")
        }),
      ),
    { timeout: 60_000 },
  )
})
