import { spawn } from "node:child_process"
import { detectPlatform } from "./model"

export interface AudioCapture {
  start(): Promise<void>
  stop(): void
  readonly stream: ReadableStream<Uint8Array> | null
}

interface PlatformCapture {
  start(): Promise<ReadableStream<Uint8Array>>
  stop(): void
}

class LinuxAudioCapture implements PlatformCapture {
  private process: ReturnType<typeof spawn> | null = null
  private stream: ReadableStream<Uint8Array> | null = null

  async start(): Promise<ReadableStream<Uint8Array>> {
    const controller = new AbortController()
    const { signal } = controller

    const device = "default"
    const args = ["--format=s16le", "--rate=16000", "--channels=1", "--device=" + device, "-"]

    let child: ReturnType<typeof spawn>
    try {
      child = spawn("parec", args, { stdio: ["ignore", "pipe", "ignore"] })
    } catch {
      child = spawn("arecord", ["-f", "S16_LE", "-r", "16000", "-c", "1", "-D", device], {
        stdio: ["ignore", "pipe", "ignore"],
      })
    }

    this.process = child
    this.stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        child.stdout?.on("data", (chunk: Buffer) => {
          if (!signal.aborted) {
            controller.enqueue(new Uint8Array(chunk))
          }
        })

        child.stdout?.on("error", () => {
          if (!signal.aborted) {
            controller.close()
          }
        })

        child.on("close", () => {
          if (!signal.aborted) {
            controller.close()
          }
        })

        child.on("error", () => {
          if (!signal.aborted) {
            controller.close()
          }
        })
      },
      cancel: () => {
        this.stop()
      },
    })

    return this.stream
  }

  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.stream = null
  }
}

class MacAudioCapture implements PlatformCapture {
  private process: ReturnType<typeof spawn> | null = null
  private stream: ReadableStream<Uint8Array> | null = null

  async start(): Promise<ReadableStream<Uint8Array>> {
    const controller = new AbortController()
    const { signal } = controller

    const args = [
      "-f",
      "avfoundation",
      "-i",
      ":0",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-f",
      "s16le",
      "-",
    ]

    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "ignore"] })
    this.process = child
    this.stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        child.stdout?.on("data", (chunk: Buffer) => {
          if (!signal.aborted) {
            controller.enqueue(new Uint8Array(chunk))
          }
        })

        child.stdout?.on("error", () => {
          if (!signal.aborted) {
            controller.close()
          }
        })

        child.on("close", () => {
          if (!signal.aborted) {
            controller.close()
          }
        })

        child.on("error", () => {
          if (!signal.aborted) {
            controller.close()
          }
        })
      },
      cancel: () => {
        this.stop()
      },
    })

    return this.stream
  }

  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.stream = null
  }
}

class WindowsAudioCapture implements PlatformCapture {
  private process: ReturnType<typeof spawn> | null = null
  private stream: ReadableStream<Uint8Array> | null = null

  async start(): Promise<ReadableStream<Uint8Array>> {
    const controller = new AbortController()
    const { signal } = controller

    const args = [
      "-f",
      "dshow",
      "-i",
      "audio=" + "default",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-f",
      "s16le",
      "-",
    ]

    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "ignore"] })
    this.process = child
    this.stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        child.stdout?.on("data", (chunk: Buffer) => {
          if (!signal.aborted) {
            controller.enqueue(new Uint8Array(chunk))
          }
        })

        child.stdout?.on("error", () => {
          if (!signal.aborted) {
            controller.close()
          }
        })

        child.on("close", () => {
          if (!signal.aborted) {
            controller.close()
          }
        })

        child.on("error", () => {
          if (!signal.aborted) {
            controller.close()
          }
        })
      },
      cancel: () => {
        this.stop()
      },
    })

    return this.stream
  }

  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.stream = null
  }
}

class ClosedAudioCapture implements AudioCapture {
  get stream(): null {
    return null
  }

  async start(): Promise<void> {
    // no-op
  }

  stop(): void {
    // no-op
  }
}

export function createAudioCapture(device: string): AudioCapture {
  const platform = detectPlatform()

  if (platform === "darwin") {
    const capture = new MacAudioCapture()
    let capturedStream: ReadableStream<Uint8Array> | null = null
    return {
      get stream() {
        return capturedStream
      },
      start: async () => {
        capturedStream = await capture.start()
      },
      stop: () => capture.stop(),
    }
  }

  if (platform === "linux") {
    const capture = new LinuxAudioCapture()
    let capturedStream: ReadableStream<Uint8Array> | null = null
    return {
      get stream() {
        return capturedStream
      },
      start: async () => {
        capturedStream = await capture.start()
      },
      stop: () => capture.stop(),
    }
  }

  if (platform === "win32") {
    const capture = new WindowsAudioCapture()
    let capturedStream: ReadableStream<Uint8Array> | null = null
    return {
      get stream() {
        return capturedStream
      },
      start: async () => {
        capturedStream = await capture.start()
      },
      stop: () => capture.stop(),
    }
  }

  return new ClosedAudioCapture()
}
