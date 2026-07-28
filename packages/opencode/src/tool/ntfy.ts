import { Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import * as Tool from "./tool"
import { Config } from "@/config/config"

export const Parameters = Schema.Struct({
  message: Schema.String.annotate({ description: "The notification message" }),
  title: Schema.String.pipe(Schema.optional).annotate({ description: "Optional notification title" }),
  topic: Schema.String.pipe(Schema.optional).annotate({
    description: "Override the configured ntfy topic",
  }),
  server: Schema.String.pipe(Schema.optional).annotate({
    description: "Named server from config to use (defaults to the first configured server)",
  }),
})

export const NtfyTool = Tool.define(
  "ntfy",
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const httpOk = HttpClient.filterStatusOk(http)
    const config = yield* Config.Service

    return {
      description: "Send a push notification via ntfy.sh",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const cfg = yield* config.get()
          const servers = cfg.ntfy?.servers
          if (!servers || Object.keys(servers).length === 0) {
            return yield* Effect.die(
              new Error('ntfy is not configured. Add a server under the "ntfy" section in opencode.jsonc.'),
            )
          }

          const entry = params.server
            ? servers[params.server]
            : servers[Object.keys(servers)[0]!]

          if (!entry) {
            return yield* Effect.die(
              new Error(
                params.server
                  ? `ntfy server "${params.server}" not found. Available servers: ${Object.keys(servers).join(", ")}`
                  : "ntfy has no configured servers",
              ),
            )
          }

          const baseUrl = entry.url.endsWith("/") ? entry.url.slice(0, -1) : entry.url
          const topic = params.topic ?? entry.topic ?? "opencode"
          const notifyUrl = `${baseUrl}/${topic}`

          const headers: Record<string, string> = {
            "Content-Type": "text/plain",
          }

          if (entry.auth) {
            headers["Authorization"] = entry.auth
          }

          const request = HttpClientRequest.post(notifyUrl).pipe(
            HttpClientRequest.setHeaders(headers),
            HttpClientRequest.bodyText(params.message, "text/plain"),
          )

          yield* httpOk.execute(request)
          yield* Effect.void

          return {
            title: params.title ?? "Notification sent",
            output: `Notification sent to ${notifyUrl}`,
            metadata: {},
          }
        }).pipe(Effect.orDie),
    }
  }),
)
