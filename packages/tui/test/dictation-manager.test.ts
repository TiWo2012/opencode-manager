import { EventEmitter } from "node:events"
import { expect, mock, test } from "bun:test"

interface FakeResult {
  text: string
  isFinal: boolean
  isPartial: boolean
}

/**
 * Stubs the real decibri mic capture and transformers.js whisper stream with
 * fakes that reproduce the stop() ordering: the manager aborts its controller
 * before the stream emits its final transcription.
 */
function installFakes(options: {
  results: (emit: (result: FakeResult) => void, end: () => void) => void
}) {
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null
  const audioCapture = {
    start: async () => {},
    stop: () => {
      streamController?.close()
      streamController = null
    },
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller
      },
    }),
  }

  const emitter = new EventEmitter()
  const emit = (result: FakeResult) => emitter.emit("result", result)
  const end = () => emitter.emit("end")

  const whisperStream = {
    start: async () => {},
    feed: () => {},
    stop: async () => {
      options.results(emit, end)
    },
    results: {
      [Symbol.asyncIterator]: () => {
        const results: FakeResult[] = []
        let ended = false
        let notify: (() => void) | null = null

        const onResult = (result: FakeResult) => {
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
                return { done: true, value: undefined as unknown as FakeResult }
              }
              await new Promise<void>((resolve) => {
                notify = resolve
              })
            }
          },
          return() {
            emitter.off("result", onResult)
            emitter.off("end", onEnd)
            return Promise.resolve({ done: true, value: undefined as unknown as FakeResult })
          },
        }
      },
    } as AsyncIterable<FakeResult>,
  }

  mock.module("../src/dictation/audio-capture", () => ({ createAudioCapture: () => audioCapture }))
  mock.module("../src/dictation/whisper-stream", () => ({ createWhisperStream: () => whisperStream }))
}

async function waitForStatus(manager: { readonly status: string }, expected: string) {
  while (manager.status !== expected) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

async function createStoppedManager(results: (emit: (result: FakeResult) => void, end: () => void) => void) {
  installFakes({ results })
  const { createDictationManager, defaultDictationConfig } = await import("../src/dictation")
  const onText = mock<(text: string) => void>()
  const onInterimResult = mock<(text: string) => void>()

  const manager = createDictationManager({
    config: defaultDictationConfig,
    onText,
    onInterimResult,
  })

  const started = manager.start()
  await waitForStatus(manager, "listening")
  await manager.stop()
  await started

  return { onText, onInterimResult }
}

test("stop() delivers the final transcription emitted after the abort signal", async () => {
  try {
    const { onText, onInterimResult } = await createStoppedManager((emit, end) => {
      emit({ text: "hello world", isFinal: true, isPartial: false })
      end()
    })

    expect(onText).toHaveBeenCalledTimes(1)
    expect(onText).toHaveBeenCalledWith("Hello world.")
    expect(onInterimResult).not.toHaveBeenCalled()
  } finally {
    mock.restore()
  }
})

test("stale interim results after abort are skipped but the final result still lands", async () => {
  try {
    const { onText, onInterimResult } = await createStoppedManager((emit, end) => {
      // An in-flight interim transcription draining after the stop request.
      emit({ text: "hello", isFinal: false, isPartial: true })
      emit({ text: "hello world", isFinal: true, isPartial: false })
      end()
    })

    expect(onText).toHaveBeenCalledTimes(1)
    expect(onText).toHaveBeenCalledWith("Hello world.")
    expect(onInterimResult).not.toHaveBeenCalled()
  } finally {
    mock.restore()
  }
})
