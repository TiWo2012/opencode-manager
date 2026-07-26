export * as ConfigNtfy from "./ntfy"

import { Schema } from "effect"

export class Server extends Schema.Class<Server>("ConfigV2.Ntfy.Server")({
  url: Schema.String.annotate({
    description: "The ntfy server URL (e.g., https://ntfy.sh)",
  }),
  topic: Schema.String.pipe(Schema.optional).annotate({
    description: "The ntfy topic to post notifications to",
  }),
  auth: Schema.String.pipe(Schema.optional).annotate({
    description: "Authentication token for the ntfy server",
  }),
}) {}

export class Info extends Schema.Class<Info>("ConfigV2.Ntfy")({
  enabled: Schema.Boolean.pipe(Schema.optional).annotate({
    description: "Enable ntfy push notifications",
  }),
  servers: Schema.Record(Schema.String, Server).pipe(Schema.optional).annotate({
    description: "Named ntfy server configurations",
  }),
}) {}
