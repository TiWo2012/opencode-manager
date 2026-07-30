export * as ConfigSession from "./session"

import { Schema } from "effect"

export const Info = Schema.Struct({
  auto_restore: Schema.optional(Schema.Literals(["always", "never", "prompt", "directory"])).annotate({
    description: "Controls auto-restore behavior on startup: always, never, prompt (show picker), or directory (filter by cwd)",
  }),
  restore_last: Schema.optional(Schema.Boolean).annotate({
    description: "Restore the last visited session per project instead of the most recent overall",
  }),
})
export type Info = Schema.Schema.Type<typeof Info>
