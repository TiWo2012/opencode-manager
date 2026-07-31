const MODEL_IDS: Record<string, string> = {
  tiny: "onnx-community/whisper-tiny",
  base: "onnx-community/whisper-base",
  small: "onnx-community/whisper-small",
  medium: "onnx-community/whisper-medium-ONNX",
}

export function getWhisperModelId(size: string): string {
  const id = MODEL_IDS[size]
  if (!id) throw new Error("Unknown whisper model size: " + size)
  return id
}
