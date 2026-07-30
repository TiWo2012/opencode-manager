import type { Effect } from "effect"
import type { PluginOptions } from "../options.js"
import type { ModelV2Info, ProviderV2Info } from "@opencode-ai/sdk/v2/types"
import type { AgentHooks } from "./agent.js"
import type { AISDKHooks } from "./aisdk.js"
import type { CatalogHooks } from "./catalog.js"
import type { CommandHooks } from "./command.js"
import type { IntegrationHooks } from "./integration.js"
import type { PluginDomain } from "./plugin.js"
import type { ReferenceHooks } from "./reference.js"
import type { SkillHooks } from "./skill.js"
import type { Reload } from "./registration.js"

export interface ModelDatabaseHooks {
  readonly registerProvider: (id: string, info: ProviderV2Info) => Effect.Effect<void>
  readonly registerModel: (providerID: string, modelID: string, info: ModelV2Info) => Effect.Effect<void>
  readonly removeProvider: (providerID: string) => Effect.Effect<void>
  readonly removeModel: (providerID: string, modelID: string) => Effect.Effect<void>
}

export interface PluginContext {
  readonly options: PluginOptions
  readonly agent: AgentHooks & Reload
  readonly aisdk: AISDKHooks
  readonly catalog: CatalogHooks & Reload
  readonly command: CommandHooks & Reload
  readonly integration: IntegrationHooks & Reload
  readonly modelDatabase: ModelDatabaseHooks
  readonly plugin: PluginDomain
  readonly reference: ReferenceHooks & Reload
  readonly skill: SkillHooks & Reload
}
