import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const ProviderTable = sqliteTable("model_database_provider", {
  id: text().primaryKey(),
  data: text({ mode: "json" }).notNull(),
  created_at: integer().notNull(),
  updated_at: integer().notNull(),
})

export const ModelTable = sqliteTable("model_database_model", {
  id: text().notNull(),
  provider_id: text().notNull(),
  data: text({ mode: "json" }).notNull(),
  created_at: integer().notNull(),
  updated_at: integer().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.provider_id, table.id] }),
}))
