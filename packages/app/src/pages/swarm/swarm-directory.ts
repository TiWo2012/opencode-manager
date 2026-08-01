import { createMemo, type Accessor } from "solid-js"
import { useGlobal } from "@/context/global"
import { useLayout } from "@/context/layout"
import { useServer } from "@/context/server"
import { useServerSync } from "@/context/server-sync"

/**
 * Resolves the active directory for the swarm routes.
 *
 * Swarm is project-scoped and its routes live outside the `/:dir` tree, so the
 * directory comes from the app's current-project state instead of the URL: the
 * home project selection, then the selected server's most recently used project,
 * then the server's working directory.
 */
export function useSwarmDirectory(): Accessor<string> {
  const layout = useLayout()
  const global = useGlobal()
  const server = useServer()
  const serverSync = useServerSync()

  return createMemo(() => {
    const selected = layout.home.selection().directory
    if (selected) return selected
    const conn = server.current
    const last = conn ? global.ensureServerCtx(conn).projects.last() : undefined
    if (last) return last
    return serverSync().data.path.directory
  })
}
