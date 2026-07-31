export interface DictationConfig {
  enabled: boolean
  model: "tiny" | "base" | "small" | "medium"
  audioDevice: string
  cleanup: {
    removeFillers: boolean
    fillers: readonly string[]
    capitalize: boolean
    punctuation: boolean
    disfluencyCleanup: boolean
  }
}

export const defaultDictationConfig: DictationConfig = {
  enabled: true,
  model: "base",
  audioDevice: "default",
  cleanup: {
    removeFillers: true,
    fillers: ["um", "uh", "like", "you know", "well", "so", "ah", "erm"],
    capitalize: true,
    punctuation: true,
    disfluencyCleanup: true,
  },
}
