import { homedir } from "node:os"
import { join } from "node:path"
import { access, mkdir, stat } from "node:fs/promises"

const CACHE_DIR = join(homedir(), ".cache", "opencode", "whisper-models")

const MODEL_URLS: Record<string, string> = {
  tiny: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
  base: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
  small: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
  medium: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
}

export interface WhisperModel {
  path: string
  size: string
  loaded: boolean
}

export function detectPlatform(): "darwin" | "linux" | "win32" {
  return process.platform as "darwin" | "linux" | "win32"
}

async function ensureCacheDir() {
  return mkdir(CACHE_DIR, { recursive: true })
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export async function getWhisperModelPath(size: string): Promise<string> {
  const path = join(CACHE_DIR, "ggml-" + size + ".bin")

  try {
    await ensureCacheDir()
  } catch {
    return path
  }

  const exists = await fileExists(path)
  if (exists) return path

  const url = MODEL_URLS[size]
  if (!url) throw new Error("Unknown whisper model size: " + size)

  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to download model: " + response.status + " " + response.statusText)

  const buffer = Buffer.from(await response.arrayBuffer())
  await Bun.write(path, buffer)

  return path
}
