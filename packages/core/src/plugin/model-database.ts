import { Effect, Stream } from "effect"
import { EventV2 } from "../event"
import { ModelDatabase } from "../model-database"
import { define } from "./internal"

export const ModelDatabasePlugin = define({
  id: "model-database",
  effect: Effect.fn(function* (ctx) {
    const modelDb = yield* ModelDatabase.Service
    const events = yield* EventV2.Service

    yield* ctx.catalog.transform(
      Effect.fn(function* (catalog) {
        const providers = yield* modelDb.listProviders()
        for (const { id, info } of providers) {
          catalog.provider.update(id, (provider) => {
            Object.assign(provider, info)
          })
          const models = yield* modelDb.listModels(id)
          for (const { id: modelID, info: modelInfo } of models) {
            catalog.model.update(id, modelID, (model) => {
              Object.assign(model, modelInfo)
            })
          }
        }
      }),
    )

    yield* events.subscribe(ModelDatabase.Event.Updated).pipe(
      Stream.runForEach(() => ctx.catalog.reload()),
      Effect.forkScoped({ startImmediately: true }),
    )
  }),
})
