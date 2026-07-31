import { EventEmitter } from "node:events"
import { homedir } from "node:os"
import { join } from "node:path"
import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers"

const SAMPLE_RATE = 16000
const INTERIM_INTERVAL_MS = 1000
const INTERIM_WINDOW_SECONDS = 10
const CHUNK_LENGTH_S = 30
const STRIDE_LENGTH_S = 5

export interface WhisperResult {
  text: string
  isFinal: boolean
  isPartial: boolean
}

export interface WhisperStream {
  start(): Promise<void>
  feed(chunk: Uint8Array): void
  stop(): Promise<void>
  readonly results: AsyncIterable<WhisperResult>
}

class WhisperStreamImpl implements WhisperStream {
  private transcriber: AutomaticSpeechRecognitionPipeline | null = null
  private samples: Float32Array = new Float32Array(0)
  private sampleCount = 0
  private transcribing = false
  private lastTranscribedSamples = 0
  private interval: ReturnType<typeof setInterval> | null = null
  private started = false
  private closed = false
  private resultsEmitter = new EventEmitter()

  constructor(private modelId: string) {}

  async start(): Promise<void> {
    if (this.started) return

    const { env, LogLevel, pipeline } = await import("@huggingface/transformers")
    env.cacheDir = join(homedir(), ".cache", "opencode", "transformers")
    env.logLevel = LogLevel.ERROR

    this.transcriber = (await pipeline("automatic-speech-recognition", this.modelId, {
      dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
    })) as AutomaticSpeechRecognitionPipeline

    this.started = true

    this.interval = setInterval(() => {
      void this.transcribeInterim()
    }, INTERIM_INTERVAL_MS)
  }

  feed(chunk: Uint8Array): void {
    if (!this.started || this.closed) return

    const int16 = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.byteLength / 2)
    const floats = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      floats[i] = int16[i] / 32768
    }

    // Grow the sample buffer geometrically to avoid reallocating on every chunk.
    const required = this.sampleCount + floats.length
    if (required > this.samples.length) {
      let capacity = this.samples.length === 0 ? 1 : this.samples.length
      while (capacity < required) capacity *= 2
      const grown = new Float32Array(capacity)
      grown.set(this.samples.subarray(0, this.sampleCount))
      this.samples = grown
    }

    this.samples.set(floats, this.sampleCount)
    this.sampleCount += floats.length
  }

  private async transcribeInterim(): Promise<void> {
    const transcriber = this.transcriber
    if (!transcriber || this.transcribing || this.closed) return

    const newSamples = this.sampleCount - this.lastTranscribedSamples
    if (newSamples < SAMPLE_RATE * 0.5) return

    const window = this.samples.subarray(this.windowStart(), this.sampleCount)
    if (window.length < SAMPLE_RATE) return

    this.transcribing = true
    try {
      const output = await transcriber(window, {
        chunk_length_s: CHUNK_LENGTH_S,
        stride_length_s: STRIDE_LENGTH_S,
      })
      this.lastTranscribedSamples = this.sampleCount
      const text = "text" in output ? output.text : ""
      if (text.trim()) {
        this.resultsEmitter.emit("result", { text: text.trim(), isFinal: false, isPartial: true })
      }
    } catch (error) {
      this.resultsEmitter.emit("error", error)
    } finally {
      this.transcribing = false
    }
  }

  private windowStart(): number {
    const windowSamples = INTERIM_WINDOW_SECONDS * SAMPLE_RATE
    return Math.max(0, this.sampleCount - windowSamples)
  }

  async stop(): Promise<void> {
    if (!this.started) return

    this.closed = true

    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }

    // Wait for any in-flight interim transcription before finalizing.
    while (this.transcribing) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    if (this.transcriber && this.sampleCount > 0) {
      try {
        const output = await this.transcriber(this.samples.subarray(0, this.sampleCount), {
          chunk_length_s: CHUNK_LENGTH_S,
          stride_length_s: STRIDE_LENGTH_S,
        })
        const text = "text" in output ? output.text : ""
        if (text.trim()) {
          this.resultsEmitter.emit("result", { text: text.trim(), isFinal: true, isPartial: false })
        }
      } catch (error) {
        this.resultsEmitter.emit("error", error)
      }
    }

    this.started = false
    this.resultsEmitter.emit("end")
  }

  get results(): AsyncIterable<WhisperResult> {
    return {
      [Symbol.asyncIterator]: () => {
        const emitter = this.resultsEmitter
        const results: WhisperResult[] = []
        let ended = false
        let notify: (() => void) | null = null

        const onResult = (result: WhisperResult) => {
          results.push(result)
          const wake = notify
          notify = null
          wake?.()
        }

        const onEnd = () => {
          ended = true
          const wake = notify
          notify = null
          wake?.()
        }

        emitter.on("result", onResult)
        emitter.on("end", onEnd)

        return {
          async next() {
            while (true) {
              if (results.length > 0) {
                return { done: false, value: results.shift()! }
              }
              if (ended) {
                emitter.off("result", onResult)
                emitter.off("end", onEnd)
                return { done: true, value: undefined as unknown as WhisperResult }
              }
              await new Promise<void>((resolve) => {
                notify = resolve
              })
            }
          },
          return() {
            emitter.off("result", onResult)
            emitter.off("end", onEnd)
            return Promise.resolve({ done: true, value: undefined as unknown as WhisperResult })
          },
        }
      },
    }
  }
}

export function createWhisperStream(options: {
  model: string
}): WhisperStream {
  return new WhisperStreamImpl(options.model)
}
