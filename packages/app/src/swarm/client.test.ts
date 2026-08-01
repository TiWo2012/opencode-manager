import { describe, expect, test } from "bun:test"
import { createSwarmClient } from "./client"
import type { ServerSDK } from "@/context/server-sdk"

const serverSDK = (() => ({
  url: "http://localhost:4096",
  server: { http: { url: "http://localhost:4096", username: "opencode", password: "secret" } },
})) as unknown as () => ServerSDK

function setup(respond?: (request: Request) => Response | Promise<Response>) {
  const requests: Request[] = []
  const fetch = Object.assign(
    async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init)
      requests.push(request)
      if (respond) return respond(request)
      return Response.json({})
    },
    { preconnect: globalThis.fetch.preconnect },
  )
  return { client: createSwarmClient("/repo", { serverSDK, fetch }), requests }
}

describe("createSwarmClient", () => {
  test("list posts to /swarm/list with auth and directory headers", async () => {
    const { client, requests } = setup(() => Response.json([]))

    const result = await client.list()

    expect(result).toEqual([])
    expect(requests).toHaveLength(1)
    const request = requests[0]!
    expect(request.method).toBe("POST")
    expect(new URL(request.url).pathname).toBe("/swarm/list")
    expect(request.headers.get("content-type")).toBe("application/json")
    expect(request.headers.get("authorization")).toBe(`Basic ${btoa("opencode:secret")}`)
    expect(request.headers.get("x-opencode-directory")).toBe("/repo")
    expect(await request.json()).toEqual({})
  })

  test("create posts the input to /swarm and resolves the swarm", async () => {
    const swarm = {
      id: "swm_1",
      projectID: "project",
      title: "Coverage",
      mode: "normal",
      status: "idle",
      agents: [],
      createdAt: 1,
      updatedAt: 1,
    }
    const { client, requests } = setup(() => Response.json(swarm))

    const result = await client.create({ title: "Coverage", mode: "normal", task: "add tests" })

    expect(result).toMatchObject({ id: "swm_1", status: "idle" })
    expect(new URL(requests[0]!.url).pathname).toBe("/swarm")
    expect(await requests[0]!.json()).toEqual({ title: "Coverage", mode: "normal", task: "add tests" })
  })

  test("plan, approve, start, cancel, and agent route to their endpoints", async () => {
    const swarm = {
      id: "swm_1",
      projectID: "project",
      title: "Coverage",
      mode: "normal",
      status: "idle",
      agents: [],
      createdAt: 1,
      updatedAt: 1,
    }
    const { client, requests } = setup(() => Response.json(swarm))

    await client.plan({ swarmID: "swm_1", prompt: "improve" })
    await client.approve("swm_1")
    await client.start("swm_1")
    await client.cancel("swm_1")
    await client.agent({ swarmID: "swm_1", agentID: "ag_1", action: "retry", message: "again" })

    const paths = requests.map((request) => new URL(request.url).pathname)
    expect(paths).toEqual([
      "/swarm/plan",
      "/swarm/approve",
      "/swarm/start",
      "/swarm/cancel",
      "/swarm/agent",
    ])
    expect(await requests[4]!.json()).toEqual({ swarmID: "swm_1", agentID: "ag_1", action: "retry", message: "again" })
  })

  test("list degrades to [] when the swarm endpoint 404s", async () => {
    const { client } = setup(() => new Response(undefined, { status: 404 }))

    expect(await client.list()).toEqual([])
  })

  test("list degrades to [] when the request throws", async () => {
    const { client } = setup(() => {
      throw new Error("network down")
    })

    expect(await client.list()).toEqual([])
  })

  test("maps { data: { message } } error bodies to thrown errors", async () => {
    const { client } = setup(() =>
      Response.json({ name: "SwarmError", data: { message: "Swarm already approved" } }, { status: 400 }),
    )

    await expect(client.approve("swm_1")).rejects.toThrow("Swarm already approved")
  })

  test("falls back to a status message when the error body has no message", async () => {
    const { client } = setup(() => new Response("nope", { status: 500 }))

    await expect(client.start("swm_1")).rejects.toThrow("Swarm request failed (500)")
  })

  test("resolves the directory from an accessor per call", async () => {
    const requests: Request[] = []
    let directory = "/repo"
    const fetch = Object.assign(
      async (input: string | URL | Request, init?: RequestInit) => {
        const request = new Request(input, init)
        requests.push(request)
        return Response.json([])
      },
      { preconnect: globalThis.fetch.preconnect },
    )
    const client = createSwarmClient(() => directory, { serverSDK, fetch })

    await client.list()
    directory = "/other"
    await client.list()

    expect(requests.map((request) => request.headers.get("x-opencode-directory"))).toEqual(["/repo", "/other"])
  })
})
