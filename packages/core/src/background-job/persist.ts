import { eq } from "drizzle-orm"
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { Effect } from "effect"
import type { Database } from "../database/database"
import type { Info, Status } from "../background-job"

type DatabaseService = Database.Interface["db"]

export type PersistedJob = {
  id: string
  type: string
  title: string | null
  status: string
  metadata: string | null
  output: string | null
  error: string | null
  session_id: string | null
  started_at: number
  completed_at: number | null
}

export const BackgroundJobTable = sqliteTable("background_job", {
  id: text().primaryKey(),
  type: text().notNull(),
  title: text(),
  status: text().notNull(),
  metadata: text(),
  output: text(),
  error: text(),
  session_id: text(),
  started_at: integer().notNull(),
  completed_at: integer(),
})

export const insertJob = (db: DatabaseService, info: Info): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* db
      .insert(BackgroundJobTable)
      .values({
        id: info.id,
        type: info.type,
        title: info.title ?? null,
        status: info.status,
        metadata: info.metadata ? JSON.stringify(info.metadata) : null,
        output: info.output ?? null,
        error: info.error ?? null,
        session_id: info.sessionID ?? null,
        started_at: info.started_at,
        completed_at: info.completed_at ?? null,
      })
      .run()
      .pipe(Effect.orDie)
  })

export const updateJob = (
  db: DatabaseService,
  id: string,
  updates: { status: Status; output?: string; error?: string; completed_at: number },
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* db
      .update(BackgroundJobTable)
      .set({
        status: updates.status,
        ...(updates.output !== undefined ? { output: updates.output } : {}),
        ...(updates.error !== undefined ? { error: updates.error } : {}),
        completed_at: updates.completed_at,
      })
      .where(eq(BackgroundJobTable.id, id))
      .run()
      .pipe(Effect.orDie)
  })

export const listJobs = (
  db: DatabaseService,
  sessionID?: string,
): Effect.Effect<PersistedJob[]> =>
  Effect.gen(function* () {
    const query = db.select().from(BackgroundJobTable)
    if (sessionID) {
      return yield* query.where(eq(BackgroundJobTable.session_id, sessionID)).all().pipe(Effect.orDie)
    }
    return yield* query.all().pipe(Effect.orDie)
  }).pipe(Effect.map((rows) => rows.map(fromRow)))

export const getJob = (db: DatabaseService, id: string): Effect.Effect<PersistedJob | undefined> =>
  Effect.gen(function* () {
    const row = yield* db
      .select()
      .from(BackgroundJobTable)
      .where(eq(BackgroundJobTable.id, id))
      .get()
      .pipe(Effect.orDie)
    if (!row) return
    return fromRow(row)
  })

function fromRow(row: typeof BackgroundJobTable.$inferSelect): PersistedJob {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    metadata: row.metadata,
    output: row.output,
    error: row.error,
    session_id: row.session_id,
    started_at: row.started_at,
    completed_at: row.completed_at,
  }
}
