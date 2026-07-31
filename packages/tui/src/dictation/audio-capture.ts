import { Readable } from "node:stream"
import type { Microphone, MicrophoneOptions } from "decibri"

export interface AudioCapture {
  start(): Promise<void>
  stop(): void
  readonly stream: ReadableStream<Uint8Array> | null
}

function resolveDevice(device: string): MicrophoneOptions["device"] {
  if (device === "" || device === "default") return undefined
  return device
}

class DecibriAudioCapture implements AudioCapture {
  private microphone: Microphone | null = null
  private webStream: ReadableStream<Uint8Array> | null = null

  constructor(private device: string) {}

  async start(): Promise<void> {
    const { Microphone } = await import("decibri")

    this.microphone = new Microphone({
      sampleRate: 16000,
      channels: 1,
      framesPerBuffer: 1600,
      device: resolveDevice(this.device),
    })

    this.webStream = Readable.toWeb(this.microphone as unknown as Readable) as unknown as ReadableStream<Uint8Array>
  }

  stop(): void {
    this.microphone?.stop()
    this.microphone = null
    this.webStream = null
  }

  get stream(): ReadableStream<Uint8Array> | null {
    return this.webStream
  }
}

export function createAudioCapture(device: string): AudioCapture {
  return new DecibriAudioCapture(device)
}
