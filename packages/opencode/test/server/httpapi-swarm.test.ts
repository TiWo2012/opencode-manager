import { afterEach, describe, expect } from "bun:test"
import { Effect } from "effect"
import { Swarm } from "@opencode-ai/schema/swarm"
import { SwarmPaths } from "../../src/server/routes/instance/httpapi/groups/swarm"
import { disposeAllInstances, TestInstance } from "../fixture/fixture"
import { resetDatabase } from "../fixture/db"
import { testEffect } from "../lib/effect"
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
        expect(info.baseBranch.length).toBeGreaterThan(0)

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
})
