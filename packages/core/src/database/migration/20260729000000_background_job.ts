import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260729000000_background_job",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS \`background_job\` (
          \`id\` text PRIMARY KEY,
          \`type\` text NOT NULL,
          \`title\` text,
          \`status\` text NOT NULL,
          \`metadata\` text,
          \`output\` text,
          \`error\` text,
          \`session_id\` text,
          \`started_at\` integer NOT NULL,
          \`completed_at\` integer
        );
      `)
      yield* tx.run(`CREATE INDEX IF NOT EXISTS \`background_job_session_idx\` ON \`background_job\` (\`session_id\`);`)
    })
  },
} satisfies DatabaseMigration.Migration
