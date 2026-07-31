export * as ModelDatabase from "./model-database"

import { and, eq } from "drizzle-orm"
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors"
import { Context, Effect, Layer } from "effect"
import { Database } from "./database/database"
import { makeLocationNode } from "./effect/app-node"
import { EventV2 } from "./event"
import { ModelV2 } from "./model"
import { ModelTable, ProviderTable } from "./model-database/sql"
import { ProviderV2 } from "./provider"

const Updated = EventV2.define({ type: "model-database.updated", schema: {} })
export const Event = { Updated }

export interface Interface {
  readonly registerProvider: (id: string, info: ProviderV2.MutableInfo) => Effect.Effect<void, EffectDrizzleQueryError>
  readonly registerModel: (providerID: string, modelID: string, info: ModelV2.MutableInfo) => Effect.Effect<void, EffectDrizzleQueryError>
  readonly listProviders: () => Effect.Effect<Array<{ id: string; info: ProviderV2.MutableInfo }>, EffectDrizzleQueryError>
  readonly listModels: (providerID: string) => Effect.Effect<Array<{ id: string; info: ModelV2.MutableInfo }>, EffectDrizzleQueryError>
  readonly removeProvider: (providerID: string) => Effect.Effect<void, EffectDrizzleQueryError>
  readonly removeModel: (providerID: string, modelID: string) => Effect.Effect<void, EffectDrizzleQueryError>
  readonly getModel: (providerID: string, modelID: string) => Effect.Effect<ModelV2.MutableInfo | undefined, EffectDrizzleQueryError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ModelDatabase") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const events = yield* EventV2.Service

    const service: Interface = {
      registerProvider: Effect.fn("ModelDatabase.registerProvider")(function* (id, info) {
        const now = Date.now()
        yield* db
          .insert(ProviderTable)
          .values({ id, data: info, created_at: now, updated_at: now })
          .onConflictDoUpdate({ target: ProviderTable.id, set: { data: info, updated_at: now } })
          .run()
        yield* events.publish(Updated, {})
      }),

      registerModel: Effect.fn("ModelDatabase.registerModel")(function* (providerID, modelID, info) {
        const now = Date.now()
        yield* db
          .insert(ModelTable)
          .values({ id: modelID, provider_id: providerID, data: info, created_at: now, updated_at: now })
          .onConflictDoUpdate({ target: [ModelTable.provider_id, ModelTable.id], set: { data: info, updated_at: now } })
          .run()
        yield* events.publish(Updated, {})
      }),

      listProviders: Effect.fn("ModelDatabase.listProviders")(function* () {
        const rows = yield* db.select().from(ProviderTable).all()
        return rows.map((row) => ({ id: row.id, info: row.data as ProviderV2.MutableInfo }))
      }),

      listModels: Effect.fn("ModelDatabase.listModels")(function* (providerID) {
        const rows = yield* db.select().from(ModelTable).where(eq(ModelTable.provider_id, providerID)).all()
        return rows.map((row) => ({ id: row.id, info: row.data as ModelV2.MutableInfo }))
      }),

      removeProvider: Effect.fn("ModelDatabase.removeProvider")(function* (providerID) {
        yield* db.delete(ModelTable).where(eq(ModelTable.provider_id, providerID)).run()
        yield* db.delete(ProviderTable).where(eq(ProviderTable.id, providerID)).run()
        yield* events.publish(Updated, {})
      }),

      removeModel: Effect.fn("ModelDatabase.removeModel")(function* (providerID, modelID) {
        yield* db
          .delete(ModelTable)
          .where(and(eq(ModelTable.provider_id, providerID), eq(ModelTable.id, modelID)))
          .run()
        yield* events.publish(Updated, {})
      }),

      getModel: Effect.fn("ModelDatabase.getModel")(function* (providerID, modelID) {
        const row = yield* db
          .select()
          .from(ModelTable)
          .where(and(eq(ModelTable.provider_id, providerID), eq(ModelTable.id, modelID)))
          .get()
        return row?.data as ModelV2.MutableInfo | undefined
      }),
    }

    return Service.of(service)
  }),
)

export const locationLayer = layer

export const node = makeLocationNode({ service: Service, layer, deps: [Database.node, EventV2.node] })
