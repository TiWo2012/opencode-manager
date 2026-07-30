import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260729000000_model_database",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS model_database_provider (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `)
      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS model_database_model (
          id TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (provider_id, id),
          FOREIGN KEY (provider_id) REFERENCES model_database_provider(id) ON DELETE CASCADE
        )
      `)
      yield* tx.run(`
        CREATE INDEX idx_model_database_model_provider_id ON model_database_model(provider_id)
      `)
    })
  },
} satisfies DatabaseMigration.Migration
