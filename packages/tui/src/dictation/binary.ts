import { homedir } from "node:os"
import { join, dirname } from "node:path"
import { access, mkdir, readFile, rm } from "node:fs/promises"
import { execFile } from "node:child_process"
import { createReadStream } from "node:fs"
import { createWriteStream } from "node:fs"

const SHIPPED_BINARY_DIR = join(__dirname, "binaries")

const GITHUB_RELEASES = "https://github.com/ggerganov/whisper.cpp/releases/download"

const BINARY_NAMES: Record<string, string> = {
  darwin: "whisper",
  linux: "whisper",
  win32: "whisper.exe",
}

function getBinaryName(platform: string): string {
  return BINARY_NAMES[platform] ?? "whisper"
}

async function fileAccessible(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function checkShippedBinary(): Promise<string | null> {
  const binaryDir = SHIPPED_BINARY_DIR
  const exists = await fileAccessible(binaryDir)
  if (!exists) return null

  const platform = detectPlatformForBinary()
  const name = getBinaryName(platform)
  const path = join(binaryDir, name)

  const accessible = await fileAccessible(path)
  return accessible ? path : null
}

function detectPlatformForBinary(): "darwin" | "linux" | "win32" {
  switch (process.platform) {
    case "darwin":
      return "darwin"
    case "linux":
      return "linux"
    case "win32":
      return "win32"
    default:
      return "linux"
  }
}

function detectArch(): string {
  const arch = process.arch
  if (arch === "arm64") return "arm64"
  if (arch === "x64") return "x86_64"
  return arch
}

function getDownloadUrl(platform: string, arch: string): string {
  const name = getBinaryName(platform)
  const tag = "v1.7.4"
  const archSuffix = platform === "darwin" ? arch : arch === "x86_64" ? "x64" : arch

  if (platform === "darwin") {
    return GITHUB_RELEASES + "/" + tag + "/" + name + "-" + archSuffix + ".tar.gz"
  }
  if (platform === "win32") {
    return GITHUB_RELEASES + "/" + tag + "/" + name + "-" + archSuffix + ".zip"
  }
  return GITHUB_RELEASES + "/" + tag + "/" + name + "-" + archSuffix + ".tar.gz"
}

async function extractTarGz(url: string, destDir: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to download binary: " + response.status)

  const buffer = Buffer.from(await response.arrayBuffer())
  const tempFile = join(destDir, "whisper-download.tar.gz")
  await Bun.write(tempFile, buffer)

  try {
    await new Promise<void>((resolve, reject) => {
      execFile("tar", ["-xzf", tempFile, "-C", destDir], (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  } finally {
    await rm(tempFile).catch(() => undefined)
  }
}

async function extractZip(url: string, destDir: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to download binary: " + response.status)

  const buffer = Buffer.from(await response.arrayBuffer())
  const tempFile = join(destDir, "whisper-download.zip")
  await Bun.write(tempFile, buffer)

  try {
    await new Promise<void>((resolve, reject) => {
      execFile("unzip", ["-o", tempFile, "-d", destDir], (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  } finally {
    await rm(tempFile).catch(() => undefined)
  }
}

async function downloadBinary(): Promise<string> {
  const platform = detectPlatformForBinary()
  const arch = detectArch()
  const name = getBinaryName(platform)
  const destDir = SHIPPED_BINARY_DIR

  await mkdir(destDir, { recursive: true })
  const destPath = join(destDir, name)

  const accessible = await fileAccessible(destPath)
  if (accessible) return destPath

  const url = getDownloadUrl(platform, arch)

  if (platform === "win32") {
    await extractZip(url, destDir)
  } else {
    await extractTarGz(url, destDir)
  }

  await new Promise<void>((resolve, reject) => {
    execFile("chmod", ["+x", destPath], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })

  return destPath
}

async function checkSystemPath(name: string): Promise<string | null> {
  const accessible = await fileAccessible(name)
  if (accessible) return name

  const result = await new Promise<string | null>((resolve) => {
    execFile("which", [name], (err, stdout) => {
      if (err) resolve(null)
      else resolve(stdout.trim() || null)
    })
  })

  return result
}

export async function findWhisperBinary(): Promise<string | null> {
  const shipped = await checkShippedBinary()
  if (shipped) return shipped

  const platform = detectPlatformForBinary()
  const name = getBinaryName(platform)

  const system = await checkSystemPath(name)
  if (system) return system

  return null
}

export async function downloadWhisperBinary(): Promise<string> {
  const existing = await findWhisperBinary()
  if (existing) return existing

  return downloadBinary()
}
