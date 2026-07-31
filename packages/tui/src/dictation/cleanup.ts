export interface CleanupConfig {
  removeFillers: boolean
  fillers: string[]
  capitalize: boolean
  punctuation: boolean
  disfluencyCleanup: boolean
}

function removeFillers(text: string, fillers: string[]): string {
  let result = text
  for (const filler of fillers) {
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp("\\b" + escaped + "\\b", "gi")
    result = result.replace(regex, " ")
  }
  return result
}

function removeDisfluencies(text: string): string {
  let result = text

  // Remove self-corrections: words followed by "I mean" or "I guess" etc.
  result = result.replace(/\b(I\s+mean|I\s+guess|let\s+me\s+see)\b\s*[^,.\n]*?([,.])?/gi, "$2")

  // Remove repeated words: "the the", "I I" -> "the", "I"
  result = result.replace(/\b(\w+)\s+\1\b/gi, "$1")

  // Remove filler-like patterns: "um... uh..."
  result = result.replace(/\b(um|uh|ah|erm)\b\s*\.*/gi, "")

  // Clean up multiple spaces
  result = result.replace(/\s{2,}/g, " ")

  return result
}

function capitalizeSentences(text: string): string {
  return text.replace(/(^[a-z]|[.!?]\s+[a-z])/g, (match) => match.toUpperCase())
}

function inferPunctuation(text: string): string {
  let result = text.trim()

  if (result.length === 0) return result

  // Add period if no terminal punctuation
  const terminalPunct = /[.!?]$/
  if (!terminalPunct.test(result)) {
    result = result + "."
  }

  // Capitalize after terminal punctuation
  result = capitalizeSentences(result)

  return result
}

export function cleanupTranscription(text: string, config: CleanupConfig): string {
  let result = text

  if (config.removeFillers && config.fillers.length > 0) {
    result = removeFillers(result, config.fillers)
  }

  if (config.disfluencyCleanup) {
    result = removeDisfluencies(result)
  }

  if (config.punctuation) {
    result = inferPunctuation(result)
  }

  if (config.capitalize) {
    result = capitalizeSentences(result)
  }

  // Final cleanup: trim and collapse spaces
  result = result.replace(/\s+/g, " ").trim()

  return result
}
