import type { DictationConfig } from "./config"
import type { AudioCapture } from "./audio-capture"
import { createAudioCapture } from "./audio-capture"
import type { WhisperStream, WhisperResult } from "./whisper-stream"
import { createWhisperStream } from "./whisper-stream"
import { cleanupTranscription } from "./cleanup"
import { getWhisperModelId } from "./model"

export type DictationStatus = "idle" | "listening" | "processing" | "error"

export interface DictationManagerOptions {
  config: DictationConfig
  onText?: (text: string) => void
  onStatusChange?: (status: DictationStatus) => void
  onInterimResult?: (text: string) => void
}

export interface DictationManager {
  readonly status: DictationStatus
  start(): Promise<void>
  stop(): Promise<void>
  readonly isSupported: boolean
  readonly errorMessage: string | null
}

function setStatus(manager: DictationManagerImpl, status: DictationStatus) {
  manager._status = status
  manager._onStatusChange?.(status)
}

interface DictationManagerImpl extends DictationManager {
  _status: DictationStatus
  _onStatusChange?: (status: DictationStatus) => void
  _audioCapture: AudioCapture | null
  _whisperStream: WhisperStream | null
  _abortController: AbortController | null
  _isSupported: boolean
  _errorMessage: string | null
}

function createManager(options: DictationManagerOptions): DictationManagerImpl {
  return {
    _status: "idle",
    _onStatusChange: options.onStatusChange,
    _audioCapture: null,
    _whisperStream: null,
    _abortController: null,
    _isSupported: false,
    _errorMessage: null,
    get status() {
      return this._status
    },
    get isSupported() {
      return this._isSupported
    },
    get errorMessage() {
      return this._errorMessage
    },
    async start() {
      const config = options.config
      const audioDevice = config.audioDevice || "default"

      const modelId = getWhisperModelId(config.model)

      let audioCapture: AudioCapture
      try {
        audioCapture = createAudioCapture(audioDevice)
        await audioCapture.start()
      } catch (error) {
        const message = (error as Error).message
        if (message.includes("microphone") || message.includes("device") || message.includes("no audio")) {
          this._errorMessage = "No microphone found. Please connect a microphone and try again."
        } else {
          this._errorMessage = `Dictation error: ${message}`
        }
        setStatus(this, "error")
        throw new Error(this._errorMessage)
      }

      const whisperStream = createWhisperStream({
        model: modelId,
      })

      await whisperStream.start()

      const abortController = new AbortController()
      this._abortController = abortController
      this._audioCapture = audioCapture
      this._whisperStream = whisperStream
      this._isSupported = true
      this._errorMessage = null

      setStatus(this, "listening")

      const audioStream = audioCapture.stream
      if (!audioStream) {
        const error = "No audio stream available from capture device."
        this._errorMessage = error
        setStatus(this, "error")
        throw new Error(error)
      }

      // Feed audio chunks to whisper stream
      const feedLoop = (async () => {
        const reader = audioStream.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done || abortController.signal.aborted) break
            whisperStream.feed(value)
          }
        } finally {
          reader.releaseLock()
        }
      })()

      // Process whisper results concurrently
      const processLoop = (async () => {
        const interimCleanup = (text: string) =>
          cleanupTranscription(text, {
            removeFillers: true,
            fillers: [],
            capitalize: false,
            punctuation: false,
            disfluencyCleanup: false,
          })

        const finalCleanup = (text: string) =>
          cleanupTranscription(text, {
            removeFillers: true,
            fillers: config.cleanup.fillers as string[],
            capitalize: config.cleanup.capitalize,
            punctuation: config.cleanup.punctuation,
            disfluencyCleanup: config.cleanup.disfluencyCleanup,
          })

        try {
          for await (const result of whisperStream.results) {
            const text = result.text?.trim()
            if (!text) continue

            if (result.isFinal) {
              const cleaned = finalCleanup(text)
              if (cleaned) {
                options.onText?.(cleaned)
              }
              // The final result is only emitted inside whisperStream.stop(),
              // after the abort signal, so keep looping until it arrives.
              if (abortController.signal.aborted) break
              continue
            }

            // Interim results emitted after a stop request are stale
            // transcriptions still draining; skip them.
            if (abortController.signal.aborted) continue

            const cleaned = interimCleanup(text)
            if (cleaned) {
              options.onInterimResult?.(cleaned)
            }
          }
        } catch {
          // Result processing error — non-fatal
        }
      })()

      // Wait for feed loop to complete (it ends when audio stream ends or abort)
      await feedLoop
    },
    async stop() {
      const audioCapture = this._audioCapture
      const whisperStream = this._whisperStream
      const abortController = this._abortController

      this._audioCapture = null
      this._whisperStream = null
      this._abortController = null

      if (abortController) {
        abortController.abort()
      }

      if (whisperStream) {
        await whisperStream.stop()
      }

      if (audioCapture) {
        audioCapture.stop()
      }

      this._isSupported = false
      this._errorMessage = null
      setStatus(this, "idle")
    },
  }
}

export function createDictationManager(options: DictationManagerOptions): DictationManager {
  return createManager(options)
}
