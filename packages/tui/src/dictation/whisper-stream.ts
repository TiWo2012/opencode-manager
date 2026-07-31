import { spawn } from "node:child_process"
import { EventEmitter } from "node:events"

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
  readonly stdout: ReadableStream<Uint8Array> | null
}

class WhisperStreamImpl implements WhisperStream {
  private process: ReturnType<typeof spawn> | null = null
  private started = false
  private closed = false
  private resultsEmitter = new EventEmitter()
  private buffer: Uint8Array = new Uint8Array(0)
  private stdoutStream: ReadableStream<Uint8Array> | null = null

  constructor(
    private binaryPath: string,
    private modelPath: string,
  ) {}

  async start(): Promise<void> {
    if (this.started) return

    const args = [
      "-m",
      this.modelPath,
      "-t",
      String(process.env.OMP_NUM_THREADS ?? 4),
      "--step",
      "500",
      "--max-len",
      "10",
      "--print_progress",
      "0",
      "--print_realtime",
      "1",
      "--print_timestamps",
      "0",
      "-l",
      "auto",
      "-f",
      "-",
    ]

    this.process = spawn(this.binaryPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    })

    this.started = true

    const stdout = this.process.stdout
    if (!stdout) throw new Error("whisper.cpp stdout not available")

    const chunks: Buffer[] = []
    let partialLine = ""

    const onStdout = (data: Buffer) => {
      chunks.push(data)
      const text = data.toString()
      partialLine += text

      const lines = partialLine.split("\n")
      partialLine = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
          const result: WhisperResult = JSON.parse(trimmed)
          this.resultsEmitter.emit("result", result)
        } catch {
          // Ignore non-JSON lines (whisper.cpp status messages)
        }
      }
    }

    stdout.on("data", onStdout)

    stdout.on("error", () => {
      this.resultsEmitter.emit("error", new Error("whisper.cpp stdout error"))
    })

    this.process.stderr?.on("data", (data: Buffer) => {
      const text = data.toString().trim()
      if (text) console.debug("whisper.cpp stderr:", text)
    })

    this.process.on("close", (code) => {
      if (code !== 0 && code !== null) {
        this.resultsEmitter.emit("error", new Error("whisper.cpp exited with code " + code))
      }
      this.resultsEmitter.emit("end")
    })

    // Expose stdout as a readable stream for the manager to consume
    this.stdoutStream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        const pushBuffer = () => {
          while (chunks.length > 0) {
            const buf = chunks.shift()!
            controller.enqueue(new Uint8Array(buf))
          }
        }
        pushBuffer()
        const interval = setInterval(() => {
          if (this.closed || !this.started) {
            clearInterval(interval)
            controller.close()
            return
          }
          pushBuffer()
        }, 50)
        this.resultsEmitter.on("end", () => {
          clearInterval(interval)
          pushBuffer()
          controller.close()
        })
      },
    })
  }

  feed(chunk: Uint8Array): void {
    if (!this.started || this.closed) return

    const combined = new Uint8Array(this.buffer.length + chunk.length)
    combined.set(this.buffer)
    combined.set(chunk, this.buffer.length)
    this.buffer = combined

    if (this.process?.stdin) {
      const toWrite = this.buffer
      this.buffer = new Uint8Array(0)
      this.process.stdin.write(Buffer.from(toWrite))
    }
  }

  async stop(): Promise<void> {
    if (!this.started) return

    this.closed = true

    if (this.buffer.byteLength > 0) {
      if (this.process?.stdin) {
        this.process.stdin.write(Buffer.from(this.buffer))
      }
      this.buffer = new Uint8Array(0)
    }

    if (this.process?.stdin) {
      this.process.stdin.end()
    }

    if (this.process) {
      await new Promise<void>((resolve) => {
        const proc = this.process
        if (!proc) {
          resolve()
          return
        }
        if (proc.killed) {
          resolve()
          return
        }
        proc.on("close", () => resolve())
        proc.kill("SIGTERM")
      })
      this.process = null
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

        return {
          async next() {
            if (ended && results.length === 0) {
              return { done: true, value: undefined as unknown as WhisperResult }
            }

            if (results.length > 0) {
              return { done: false, value: results.shift()! }
            }

            await new Promise<void>((resolve) => {
              const onResult = (result: WhisperResult) => {
                results.push(result)
                resolve()
              }
              const onEnd = () => {
                ended = true
                resolve()
              }
              emitter.on("result", onResult)
              emitter.on("end", onEnd)

              const cleanup = () => {
                emitter.off("result", onResult)
                emitter.off("end", onEnd)
              }

              setTimeout(cleanup, 5000)
            })

            if (results.length > 0) {
              return { done: false, value: results.shift()! }
            }

            return { done: true, value: undefined as unknown as WhisperResult }
          },
          return() {
            return this.next()
          },
        }
      },
    }
  }

  get stdout(): ReadableStream<Uint8Array> | null {
    return this.stdoutStream
  }
}

export function createWhisperStream(options: {
  binary: string
  model: string
}): WhisperStream {
  return new WhisperStreamImpl(options.binary, options.model)
}
