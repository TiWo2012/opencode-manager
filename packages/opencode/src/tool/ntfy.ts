import { Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import * as Tool from "./tool"

export const Parameters = Schema.Struct({
  url: Schema.String.annotate({ description: "The ntfy server URL (e.g., https://ntfy.sh)" }),
  topic: Schema.String.annotate({ description: "The ntfy topic to post to" }),
  message: Schema.String.annotate({ description: "The notification message" }),
  title: Schema.String.pipe(Schema.optional).annotate({ description: "Optional notification title" }),
})

export const NtfyTool = Tool.define(
  "ntfy",
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const httpOk = HttpClient.filterStatusOk(http)

    return {
      description: "Send a push notification via ntfy.sh",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const baseUrl = params.url.endsWith("/") ? params.url.slice(0, -1) : params.url
          const notifyUrl = `${baseUrl}/${params.topic}`

          const request = HttpClientRequest.post(notifyUrl).pipe(
            HttpClientRequest.setHeaders({
              "Content-Type": "text/plain",
            }),
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
