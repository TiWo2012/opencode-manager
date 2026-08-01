import { createRoot, createContext, useContext, createMemo, type Accessor } from "solid-js"
import { describe, expect, test } from "bun:test"

const Ctx = createContext<Accessor<{ url: string }>>()
function useSDK() {
  const v = useContext(Ctx)
  if (!v) throw new Error("SDK context must be used within a context provider")
  return v
}

// Guards the swarm client/context pattern: `useServerSDK()` must be called at
// provider render time (when a reactive owner is current), NOT lazily from an
// async event handler. Solid's `useContext` reads the current owner's context,
// and async handlers run with no owner, so the hook call throws there. A memo
// accessor captured at render time stays callable from async code.
describe("solid context owner", () => {
  test("calling the useContext hook with no provider owner throws", async () => {
    const message = await createRoot((dispose) => {
      try {
        useSDK()
        dispose()
        return ""
      } catch (error) {
        dispose()
        return (error as Error).message
      }
    })
    expect(message).toContain("context must be used within a context provider")
  })

  test("a memo accessor captured inside a reactive root is readable from async code", async () => {
    const read = await createRoot((dispose) => {
      const memo = createMemo(() => ({ url: "http://sidecar" }))
      // Capture the accessor (like `const serverSDK = useServerSDK()`), then
      // dispose the root; the accessor still reads its last value.
      const accessor = () => memo().url
      dispose()
      return accessor
    })
    expect(await Promise.resolve().then(() => read())).toBe("http://sidecar")
  })
})
