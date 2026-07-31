import { Schema } from "effect"
import { defaultDictationConfig } from "../dictation/config"

export const DictationCleanupSchema = Schema.Struct({
  removeFillers: Schema.Boolean,
  fillers: Schema.Array(Schema.String),
  capitalize: Schema.Boolean,
  punctuation: Schema.Boolean,
  disfluencyCleanup: Schema.Boolean,
})

export const DictationConfigSchema = Schema.Struct({
  enabled: Schema.Boolean,
  model: Schema.Literals(["tiny", "base", "small", "medium"]),
  audioDevice: Schema.String,
  cleanup: DictationCleanupSchema,
})

export type ResolvedDictationConfig = typeof defaultDictationConfig

export function resolveDictationConfig(input: Record<string, unknown>): ResolvedDictationConfig {
  const enabled = (input.enabled ?? true) as boolean
  const model = (input.model ?? "base") as "tiny" | "base" | "small" | "medium"
  const audioDevice = (input.audioDevice ?? "default") as string
  const cleanupInput = (input.cleanup ?? {}) as Record<string, unknown>
  const cleanup = {
    removeFillers: (cleanupInput.removeFillers ?? true) as boolean,
    fillers: (cleanupInput.fillers ?? defaultDictationConfig.cleanup.fillers) as readonly string[],
    capitalize: (cleanupInput.capitalize ?? true) as boolean,
    punctuation: (cleanupInput.punctuation ?? true) as boolean,
    disfluencyCleanup: (cleanupInput.disfluencyCleanup ?? true) as boolean,
  }

  return {
    enabled,
    model,
    audioDevice,
    cleanup,
  }
}
