import { AppProcess } from "@opencode-ai/core/process"
import { Git } from "@/git"
import { Worktree } from "@/worktree"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { Swarm } from "@opencode-ai/schema/swarm"

/**
 * YOLO mode git integration.
 *
 * YOLO swarms integrate into a dedicated `yolo` sandbox branch and never
 * touch the user's own branches. Agent branches (`agent/<id>`) are created
 * from `yolo`, merged back into a `yolo` worktree, and validated before the
 * agent is considered done.
 */

export const YOLO_BRANCH = "yolo"
export const MAX_ATTEMPTS = 3

/** The integration branch a swarm merges into (always `yolo` in yolo mode). */
export function integrationBranch(mode: Swarm.Mode, baseBranch?: string): string {
  return mode === "yolo" ? YOLO_BRANCH : baseBranch ?? "main"
}

/** Agent branch name for a plan task. */
export function agentBranch(swarmID: Swarm.ID, taskID: string): string {
  return `agent/${swarmID}-${taskID}`
}

/** Services used by the integration helpers. */
export interface Services {
  readonly git: Git.Interface
  readonly worktree: Worktree.Interface
  readonly appProcess: AppProcess.Interface
}

/**
 * Ensure the `yolo` branch exists, created from the default branch.
 * Never touches the user's own branches.
 */
export function ensureYoloBranch(svc: { git: Git.Interface; cwd: string }, baseBranch: string): Effect.Effect<string> {
  return Effect.gen(function* () {
    if (yield* svc.git.branchExists(svc.cwd, YOLO_BRANCH)) return YOLO_BRANCH
    const created = yield* svc.git.createBranch(svc.cwd, YOLO_BRANCH, baseBranch)
    if (created.exitCode !== 0) {
      yield* Effect.logError("failed to create yolo branch", {
        base: baseBranch,
        message: created.stderr.toString("utf8"),
      })
    }
    return YOLO_BRANCH
  })
}

/**
 * Create (or return) a worktree checked out on the integration branch. The
 * worktree is created detached then switched to the branch so we never rely on
 * the branch being free for a fresh checkout.
 */
export function integrationWorktree(
  svc: { worktree: Worktree.Interface; git: Git.Interface },
  branch: string,
) {
  return Effect.gen(function* () {
    const info = yield* svc.worktree.makeWorktreeInfo({ detached: true, name: `swarm-${branch}` })
    yield* svc.worktree.createFromInfo(info)
    const checkout = yield* svc.git.checkout(info.directory, branch)
    if (checkout.exitCode !== 0) {
      yield* Effect.logError("failed to checkout integration branch in worktree", {
        branch,
        directory: info.directory,
        message: checkout.stderr.toString("utf8"),
      })
    }
    return info
  })
}

/** Commit the agent's work on its branch. Missing changes are not an error. */
export function commitAgentWork(
  svc: Pick<Services, "git">,
  directory: string,
  message: string,
): Effect.Effect<{ committed: boolean; output: string }> {
  return Effect.gen(function* () {
    const status = yield* svc.git.status(directory)
    if (status.length === 0) return { committed: false, output: "" }
    const result = yield* svc.git.commitAll(directory, message)
    return { committed: result.exitCode === 0, output: result.stderr.toString("utf8") }
  })
}

/**
 * Merge an agent branch into the integration branch inside the integration
 * worktree. Conflicts are aborted and reported so the agent can fix them.
 */
export function mergeAgentBranch(
  svc: Pick<Services, "git">,
  input: {
    directory: string
    branch: string
    agentID: string
  },
): Effect.Effect<{ status: Swarm.MergeStatus; message?: string }> {
  return Effect.gen(function* () {
    const merged = yield* svc.git.merge(input.directory, input.branch, `swarm: merge ${input.agentID}`)
    if (merged.exitCode === 0) {
      return { status: "merged", message: "Merged into integration branch" }
    }
    const message = merged.stderr.toString("utf8") || merged.stdout.toString("utf8") || "Merge conflict"
    yield* svc.git.run(["merge", "--abort"], { cwd: input.directory }).pipe(Effect.ignore)
    return { status: "conflict", message }
  })
}

/**
 * Run validation commands (task `validation` steps) in a directory and return
 * the list of failed commands with their output.
 */
export function runValidation(
  svc: Pick<Services, "appProcess">,
  directory: string,
  commands: readonly string[],
) {
  return Effect.gen(function* () {
    const failures: string[] = []
    for (const command of commands) {
      const text = command.trim()
      if (!text) continue
      const [shell, args] = process.platform === "win32" ? ["cmd", ["/c", text]] : ["bash", ["-lc", text]]
      const result = yield* svc.appProcess.run(
        ChildProcess.make(shell, args as string[], {
          cwd: directory,
          extendEnv: true,
          stdin: "ignore",
          forceKillAfter: "60 seconds",
        }),
      )
      const output = result.stdout.toString("utf8") + result.stderr.toString("utf8")
      if (result.exitCode !== 0) {
        failures.push(`$ ${text}\n${output.trim()}`)
      }
    }
    return failures
  })
}

/** File change stats for an agent branch relative to a base ref. */
export function agentStats(
  svc: Pick<Services, "git">,
  directory: string,
  baseRef: string,
): Effect.Effect<{ filesChanged: number; additions: number; deletions: number }> {
  return Effect.gen(function* () {
    const stats = yield* svc.git.stats(directory, baseRef)
    return {
      filesChanged: stats.length,
      additions: stats.reduce((sum, item) => sum + item.additions, 0),
      deletions: stats.reduce((sum, item) => sum + item.deletions, 0),
    }
  })
}

export * as Yolo from "./yolo"
