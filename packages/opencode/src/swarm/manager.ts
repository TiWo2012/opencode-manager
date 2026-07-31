import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Swarm } from "@opencode-ai/schema/swarm"
import { SwarmEvent } from "@opencode-ai/schema/swarm-event"
import { SwarmPolicy } from "@opencode-ai/core/swarm/policy"
import { AppProcess } from "@opencode-ai/core/process"
import { BackgroundJob } from "@/background/job"
import { Session } from "@/session/session"
import { SessionPrompt } from "@/session/prompt"
import { SessionID } from "@/session/schema"
import { Worktree } from "@/worktree"
import { Git } from "@/git"
import { EventV2Bridge } from "@/event-v2-bridge"
import { InstanceState } from "@/effect/instance-state"
import { Agent } from "@/agent/agent"
import { Graph } from "./graph"
import { Yolo } from "./yolo"
import { runPlanner } from "./planner"
import { Service, type Error, type Interface, SwarmConflict, SwarmNotFound } from "./service"
import { Cause, Effect, Exit, Fiber, Layer, Option, Schema, Scope, SynchronizedRef, Types } from "effect"
import { SessionV1 } from "@opencode-ai/core/v1/session"

/**
 * Swarm manager — server-side multi-agent orchestration.
 *
 * A swarm is a named group of agents working toward one task in isolated git
 * worktrees, scheduled from a dependency graph. In `yolo` mode the swarm
 * integrates into a dedicated `yolo` branch; in `normal` mode agents finish in
 * `awaiting-review` and merges are explicit actions.
 */

export { Service, type Error, type Interface, SwarmConflict, SwarmNotFound } from "./service"

// ---- runtime state -------------------------------------------------------

export type AgentRun = {
  sessionID: SessionID
  jobID: string
  branch: string
  worktreeDir: string
  integrationDir: string | undefined
  fiber: Fiber.Fiber<unknown, unknown> | undefined
}

export type SwarmRuntime = {
  info: Swarm.Info
  runs: Map<string, AgentRun>
  scheduler: Fiber.Fiber<unknown, unknown> | undefined
  integrationDir: string | undefined
}

type State = {
  swarms: SynchronizedRef.SynchronizedRef<Map<Swarm.ID, SwarmRuntime>>
}

function cloneInfo(info: Swarm.Info): Types.DeepMutable<Swarm.Info> {
  return structuredClone(info) as Types.DeepMutable<Swarm.Info>
}

function finalText(result: SessionV1.WithParts): string {
  return result.parts
    .filter((part): part is Extract<SessionV1.Part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 64)
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const scope = yield* Scope.Scope
    const sessions = yield* Session.Service
    const prompt = yield* SessionPrompt.Service
    const background = yield* BackgroundJob.Service
    const worktree = yield* Worktree.Service
    const gitSvc = yield* Git.Service
    const appProcess = yield* AppProcess.Service
    const events = yield* EventV2Bridge.Service
    const agents = yield* Agent.Service

    const yolo: Yolo.Services = { git: gitSvc, worktree, appProcess }

    const state = yield* InstanceState.make<State>(
      Effect.fn("Swarm.state")(function* () {
        return { swarms: yield* SynchronizedRef.make(new Map<Swarm.ID, SwarmRuntime>()) }
      }),
    )

    // ---- helpers -----------------------------------------------------------

    const getRuntime = Effect.fn("Swarm.getRuntime")(function* (swarmID: Swarm.ID) {
      const s = yield* InstanceState.get(state)
      const map = yield* SynchronizedRef.get(s.swarms)
      const rt = map.get(swarmID)
      if (!rt) return yield* new SwarmNotFound({ swarmID, message: `Swarm not found: ${swarmID}` })
      return rt
    })

    /**
     * Atomically mutate a swarm runtime. `fn` receives the current runtime and
     * returns `[value, nextRuntime]`. Returns `None` when the swarm does not
     * exist.
     */
    const modifyRuntime = <A>(
      swarmID: Swarm.ID,
      fn: (rt: SwarmRuntime) => readonly [A, SwarmRuntime],
    ): Effect.Effect<Option.Option<A>, never, never> =>
      Effect.gen(function* () {
        const s = yield* InstanceState.get(state)
        return yield* SynchronizedRef.modify(
          s.swarms,
          (map): readonly [Option.Option<A>, Map<Swarm.ID, SwarmRuntime>] => {
            const rt = map.get(swarmID)
            if (!rt) return [Option.none(), map]
            const [value, next] = fn(rt)
            return [Option.some(value), new Map(map).set(swarmID, next)]
          },
        )
      })

    const publishUpdated = Effect.fn("Swarm.publishUpdated")(function* (info: Swarm.Info) {
      yield* events.publish(SwarmEvent.Updated, { swarm: info }).pipe(Effect.ignore)
    })

    const notify = Effect.fn("Swarm.notify")(function* (
      swarmID: Swarm.ID,
      title: string,
      message: string,
      level: "info" | "success" | "warning" | "error" = "info",
    ) {
      yield* events.publish(SwarmEvent.Notify, { swarmID, title, message, level }).pipe(Effect.ignore)
    })

    const agentOf = Effect.fn("Swarm.agentOf")(function* (swarmID: Swarm.ID, agentID: string) {
      const rt = yield* getRuntime(swarmID)
      return rt.info.agents.find((item) => item.id === agentID)
    })

    const setAgentStatus = Effect.fn("Swarm.setAgentStatus")(function* (
      swarmID: Swarm.ID,
      agentID: string,
      patch: Partial<Omit<Swarm.Agent, "id">>,
      options: { event?: boolean } = {},
    ) {
      const updated = yield* modifyRuntime(swarmID, (rt) => {
        const info = cloneInfo(rt.info)
        const agent = info.agents.find((item) => item.id === agentID)
        if (!agent) return [undefined, rt]
        Object.assign(agent, patch)
        info.updatedAt = Date.now()
        return [agent, { ...rt, info }]
      })
      if (updated._tag === "None" || !updated.value) return
      const agent = updated.value
      if (options.event !== false) {
        yield* events.publish(SwarmEvent.AgentStatus, { swarmID, agent }).pipe(Effect.ignore)
      }
      const info = yield* get(swarmID)
      yield* publishUpdated(info)
    })

    // ---- create ------------------------------------------------------------

    const create = Effect.fn("Swarm.create")(function* (input) {
      const ctx = yield* InstanceState.context
      const id = Swarm.ID.create()
      const now = Date.now()
      const base = yield* gitSvc.defaultBranch(ctx.worktree)
      const baseBranch = base?.name ?? "main"
      let integrationBranch: string | undefined
      if (input.mode === "yolo") {
        integrationBranch = yield* Yolo.ensureYoloBranch({ git: gitSvc, cwd: ctx.worktree }, baseBranch)
      }
      const info: Swarm.Info = {
        id,
        projectID: ctx.project.id,
        title: input.title,
        mode: input.mode,
        status: "idle",
        ...(input.task ? { task: input.task } : {}),
        agents: [],
        ...(integrationBranch ? { integrationBranch } : {}),
        baseBranch,
        createdAt: now,
        updatedAt: now,
      }
      const s = yield* InstanceState.get(state)
      yield* SynchronizedRef.update(s.swarms, (map) =>
        new Map(map).set(id, {
          info,
          runs: new Map(),
          scheduler: undefined,
          integrationDir: undefined,
        }),
      )
      yield* events.publish(SwarmEvent.Created, { swarm: info }).pipe(Effect.ignore)
      yield* publishUpdated(info)
      yield* notify(id, "Swarm created", info.title, "info")
      return info
    })

    // ---- list / get ---------------------------------------------------------

    const list = Effect.fn("Swarm.list")(function* () {
      const s = yield* InstanceState.get(state)
      const map = yield* SynchronizedRef.get(s.swarms)
      return Array.from(map.values())
        .map((rt) => rt.info)
        .toSorted((a, b) => b.createdAt - a.createdAt)
    })

    const get = Effect.fn("Swarm.get")(function* (swarmID) {
      return (yield* getRuntime(swarmID)).info
    })

    // ---- plan ---------------------------------------------------------------

    const plan = Effect.fn("Swarm.plan")(function* (input) {
      const swarmID = input.swarmID
      yield* modifyRuntime(swarmID, (rt) => {
        const info = cloneInfo(rt.info)
        info.status = "planning"
        info.updatedAt = Date.now()
        return [undefined, { ...rt, info }]
      })

      const title = (yield* getRuntime(swarmID)).info.title
      const planned = yield* runPlanner({ title, task: input.prompt })
        .pipe(
          Effect.provideService(Session.Service, sessions),
          Effect.provideService(SessionPrompt.Service, prompt),
          Effect.provideService(Agent.Service, agents),
          Effect.exit,
        )
      if (Exit.isFailure(planned)) {
        const squash = Cause.squash(planned.cause)
        const message = squash instanceof Error ? squash.message : String(squash)
        yield* modifyRuntime(swarmID, (rt) => {
          const info = cloneInfo(rt.info)
          info.status = "failed"
          info.updatedAt = Date.now()
          return [undefined, { ...rt, info }]
        })
        yield* events.publish(SwarmEvent.Failed, { swarmID, error: message }).pipe(Effect.ignore)
        return yield* new SwarmConflict({ swarmID, message })
      }
      const parsed = planned.value

      const autoApprove = yield* modifyRuntime(swarmID, (rt) => {
        const info = cloneInfo(rt.info)
        info.plan = parsed as Types.DeepMutable<Swarm.Plan>
        info.risk = parsed.risk as Types.DeepMutable<Swarm.RiskAssessment>
        const automatic = info.mode === "yolo" && SwarmPolicy.canAutoContinue(parsed.risk.policy)
        if (automatic) info.approved = true
        info.updatedAt = Date.now()
        return [automatic, { ...rt, info }]
      })

      yield* events.publish(SwarmEvent.PlanCreated, { swarmID, plan: parsed }).pipe(Effect.ignore)
      const automatic = autoApprove._tag === "Some" && autoApprove.value
      if (automatic) {
        yield* events.publish(SwarmEvent.PlanApproved, { swarmID, automatic: true }).pipe(Effect.ignore)
      }
      const info = yield* get(swarmID)
      yield* publishUpdated(info)
      yield* notify(
        swarmID,
        "Swarm plan ready",
        automatic ? "Plan generated and auto-approved (yolo)" : "Plan generated, awaiting approval",
        automatic ? "success" : "info",
      )
      return info
    })

    // ---- approve -------------------------------------------------------------

    const approve = Effect.fn("Swarm.approve")(function* (swarmID) {
      const updated = yield* modifyRuntime(swarmID, (rt) => {
        const info = cloneInfo(rt.info)
        if (!info.plan) return [false, rt]
        info.approved = true
        info.updatedAt = Date.now()
        return [true, { ...rt, info }]
      })
      if (updated._tag === "None") {
        return yield* new SwarmNotFound({ swarmID, message: `Swarm not found: ${swarmID}` })
      }
      if (!updated.value) return yield* new SwarmConflict({ swarmID, message: "No plan to approve" })
      yield* events.publish(SwarmEvent.PlanApproved, { swarmID, automatic: false }).pipe(Effect.ignore)
      const info = yield* get(swarmID)
      yield* publishUpdated(info)
      yield* notify(swarmID, "Swarm plan approved", "Plan approved and ready to start", "success")
      return info
    })

    // ---- agent execution ------------------------------------------------------

    function buildTaskPrompt(info: Swarm.Info, task: Swarm.PlanTask, attempt: number, feedback?: string) {
      const deps = task.dependsOn
        .map((id) => info.agents.find((agent) => agent.id === id))
        .filter((agent) => agent !== undefined)
        .map((agent) => `- ${agent!.name}: ${agent!.status}`)
      const lines = [
        `You are agent "${task.agent ?? "general"}" in swarm "${info.title}" (mode: ${info.mode}).`,
        info.task ? `Swarm task: ${info.task}` : "",
        `Your task: ${task.title}`,
        task.description ? `Description: ${task.description}` : "",
        `Completed dependencies:${deps.length ? "\n" + deps.join("\n") : " none"}`,
        task.validation?.length
          ? `Validation steps that will run against the integration branch: ${task.validation.join("; ")}`
          : "",
        "",
        "You are working in your own git worktree, on your own branch.",
        "Implement the task completely. Do not touch files outside this worktree.",
        "When you are finished, describe exactly what you changed and how it was verified.",
      ]
      if (feedback) {
        lines.push("", "=== FEEDBACK FROM A PREVIOUS ATTEMPT ===", feedback)
      }
      if (attempt > 0) {
        lines.push(
          "",
          "This is a rework attempt after the feedback above. Resolve the reported problems;",
          "do not repeat the same mistakes. Keep your previous work unless the feedback requires changes.",
        )
      }
      return lines.filter(Boolean).join("\n\n")
    }

    const resolveAgentName = Effect.fn("Swarm.resolveAgentName")(function* (name: string | undefined) {
      if (!name) return "general"
      const found = yield* agents.get(name).pipe(Effect.option)
      return found._tag === "Some" ? name : "general"
    })

    const modelFor = Effect.fn("Swarm.modelFor")(function* (agentName: string) {
      const found = yield* agents.get(agentName).pipe(Effect.option)
      return found._tag === "Some" && found.value.model
        ? { providerID: found.value.model.providerID, modelID: found.value.model.modelID }
        : undefined
    })

    const agentLoop = Effect.fn("Swarm.agentLoop")(function* (input: {
      swarmID: Swarm.ID
      agentID: string
      sessionID: SessionID
      directory: string
      branch: string
      integrationDir: string | undefined
      task: Swarm.PlanTask | undefined
    }) {
      const info = yield* getRuntime(input.swarmID).pipe(Effect.map((rt) => rt.info))
      const task = input.task ?? {
        id: input.agentID,
        title: "Complete the task",
        description: info.task,
        agent: "general",
        dependsOn: [] as string[],
      }
      const mode = info.mode
      const agentName = yield* resolveAgentName(task.agent)
      const model = yield* modelFor(agentName)
      let feedback: string | undefined
      let text = ""
      for (let attempt = 0; attempt < Yolo.MAX_ATTEMPTS; attempt++) {
        const parts = [
          {
            type: "text" as const,
            text: buildTaskPrompt(info, task, attempt, feedback),
          },
        ]
        const result = yield* prompt.prompt({
          sessionID: input.sessionID,
          agent: agentName,
          ...(model ? { model } : {}),
          parts,
        })
        text = finalText(result)
        yield* Yolo.commitAgentWork(yolo, input.directory, `swarm: ${input.agentID} work (attempt ${attempt + 1})`)

        if (mode !== "yolo") return text

        yield* setAgentStatus(input.swarmID, input.agentID, { status: "merging" })
        const merged = yield* Yolo.mergeAgentBranch(yolo, {
          directory: input.integrationDir ?? input.directory,
          branch: input.branch,
          agentID: input.agentID,
        })
        if (merged.status === "conflict") {
          feedback = `Merging your branch into the integration branch failed:\n${merged.message ?? ""}\n\nFix the conflict in your branch and commit the resolution.`
          continue
        }
        const failures = yield* Yolo.runValidation(yolo, input.integrationDir ?? input.directory, task.validation ?? [])
        if (failures.length === 0) {
          yield* setAgentStatus(input.swarmID, input.agentID, { status: "merged" })
          return text
        }
        feedback = `Validation failed after merging into the integration branch:\n\n${failures.join("\n\n")}\n\nFix the issues and try again.`
      }
      return yield* Effect.fail(new Error(feedback ?? "Agent exhausted its retry budget"))
    })

    const feedbackRun = Effect.fn("Swarm.feedbackRun")(function* (input: {
      swarmID: Swarm.ID
      agentID: string
      sessionID: SessionID
      message: string
    }) {
      const info = yield* getRuntime(input.swarmID).pipe(Effect.map((rt) => rt.info))
      const task = info.plan?.tasks.find((item) => item.id === input.agentID)
      const agentName = yield* resolveAgentName(task?.agent)
      const model = yield* modelFor(agentName)
      return yield* prompt.prompt({
        sessionID: input.sessionID,
        agent: agentName,
        ...(model ? { model } : {}),
        parts: [
          {
            type: "text",
            text: [
              `Review feedback on your work for swarm "${info.title}" (agent: ${task?.title ?? input.agentID}).`,
              "",
              input.message,
              "",
              "Address the feedback, commit your changes to your branch, and describe what you changed.",
            ].join("\n\n"),
          },
        ],
      }).pipe(Effect.map((result) => finalText(result)))
    })

    function finalizeAgent(
      swarmID: Swarm.ID,
      agentID: string,
      job: BackgroundJob.Info | undefined,
    ): Effect.Effect<void, SwarmNotFound, never> {
      return Effect.gen(function* () {
        if (!job) {
          yield* setAgentStatus(swarmID, agentID, { status: "failed", error: "Agent job was not found" })
          return yield* scheduleNext(swarmID)
        }
        const rt = yield* getRuntime(swarmID)
        const mode = rt.info.mode
        const run = rt.runs.get(agentID)
        switch (job.status) {
          case "completed": {
            const base = mode === "yolo" ? "yolo" : (rt.info.baseBranch ?? undefined)
            let stats = { filesChanged: 0, additions: 0, deletions: 0 }
            if (run && base) {
              const result = yield* Yolo.agentStats(yolo, run.worktreeDir, base).pipe(Effect.option)
              if (result._tag === "Some") stats = result.value
            }
            const final = mode === "yolo" ? "completed" : "awaiting-review"
            yield* setAgentStatus(swarmID, agentID, {
              status: final,
              completedAt: Date.now(),
              filesChanged: stats.filesChanged,
              additions: stats.additions,
              deletions: stats.deletions,
            })
            const agent = yield* agentOf(swarmID, agentID)
            if (agent) {
              yield* events.publish(SwarmEvent.AgentCompleted, { swarmID, agent }).pipe(Effect.ignore)
            }
            break
          }
          case "error": {
            yield* setAgentStatus(swarmID, agentID, { status: "failed", error: job.error ?? "Agent failed" })
            const agent = yield* agentOf(swarmID, agentID)
            if (agent) {
              yield* events.publish(SwarmEvent.AgentFailed, { swarmID, agent }).pipe(Effect.ignore)
            }
            break
          }
          case "cancelled":
            yield* setAgentStatus(swarmID, agentID, { status: "cancelled" })
            break
          default:
            yield* setAgentStatus(swarmID, agentID, { status: "failed", error: "Unknown job state" })
        }
        return yield* scheduleNext(swarmID)
      })
    }

    function waitAndFinalize(
      swarmID: Swarm.ID,
      agentID: string,
      sessionID: SessionID,
    ): Effect.Effect<void, SwarmNotFound, never> {
      return Effect.gen(function* () {
        const waited = yield* background.wait({ id: sessionID })
        yield* finalizeAgent(swarmID, agentID, waited.info)
      })
    }

    function launchAgent(swarmID: Swarm.ID, agentID: string): Effect.Effect<void, never, never> {
      return Effect.gen(function* () {
        const rt = yield* getRuntime(swarmID)
        const info = rt.info
        const agent = info.agents.find((item) => item.id === agentID)
        if (!agent || agent.status !== "working") return
        const task = info.plan?.tasks.find((item) => item.id === agentID)
        const mode = info.mode
        const targetBranch = Yolo.integrationBranch(mode, info.baseBranch)

        let integrationDir = rt.integrationDir
        if (mode === "yolo" && !integrationDir) {
          const wt = yield* Yolo.integrationWorktree({ worktree, git: gitSvc }, targetBranch)
          integrationDir = wt.directory
          yield* modifyRuntime(swarmID, (rt2) => {
            const info2 = cloneInfo(rt2.info)
            info2.updatedAt = Date.now()
            return [undefined, { ...rt2, integrationDir, info: info2 }]
          })
        }

        const branch = Yolo.agentBranch(info.id, agentID)
        const ctx = yield* InstanceState.context
        if (yield* gitSvc.branchExists(ctx.worktree, branch)) {
          yield* gitSvc.run(["branch", "-D", branch], { cwd: ctx.worktree }).pipe(Effect.ignore)
        }
        const baseRef = mode === "yolo" ? "yolo" : (info.baseBranch ?? undefined)
        const wt = yield* worktree.create({
          name: slugify(`swarm-${agentID}`),
          branch,
          ...(baseRef ? { baseRef } : {}),
        })

        const agentName = yield* resolveAgentName(task?.agent)
        const session = yield* sessions.create({
          agent: agentName,
          title: `${agent.name} (swarm ${info.title})`,
          ...{ directory: wt.directory },
        })

        const run = agentLoop({
          swarmID,
          agentID,
          sessionID: session.id,
          directory: wt.directory,
          branch,
          integrationDir,
          task,
        }).pipe(Effect.catch(Effect.die))

        yield* background.start({
          id: session.id,
          type: "swarm",
          title: agent.name,
          metadata: { swarmID, agentID },
          run,
        })

        yield* modifyRuntime(swarmID, (rt2) => {
          const runs = new Map(rt2.runs).set(agentID, {
            sessionID: session.id,
            jobID: session.id,
            branch,
            worktreeDir: wt.directory,
            integrationDir,
            fiber: undefined,
          })
          return [undefined, { ...rt2, runs }]
        })

        const fiber = yield* waitAndFinalize(swarmID, agentID, session.id).pipe(Effect.forkIn(scope))
        yield* modifyRuntime(swarmID, (rt2) => {
          const runs = new Map(rt2.runs)
          const existing = runs.get(agentID)
          if (existing) runs.set(agentID, { ...existing, fiber })
          return [undefined, { ...rt2, runs }]
        })
      }).pipe(
        Effect.catchCause((cause) => Effect.logError("swarm agent launch failed", { swarmID, agentID, cause })),
      )
    }

    function completeSwarm(swarmID: Swarm.ID): Effect.Effect<void> {
      return Effect.gen(function* () {
        const updated = yield* modifyRuntime(swarmID, (rt) => {
          if (!Graph.allSucceeded(rt.info.agents)) return [undefined, rt]
          const summary = rt.info.agents.map((agent) => `- ${agent.name}: ${agent.status}`).join("\n")
          const info = { ...cloneInfo(rt.info), status: "completed" as const, result: summary, updatedAt: Date.now() }
          return [info, { ...rt, info }]
        })
        if (updated._tag === "None" || !updated.value) return
        const info = updated.value
        yield* events.publish(SwarmEvent.Completed, { swarmID, result: info.result }).pipe(Effect.ignore)
        yield* publishUpdated(info)
        yield* notify(swarmID, "Swarm completed", info.title, "success")
      })
    }

    function failSwarm(swarmID: Swarm.ID, error: string): Effect.Effect<void> {
      return Effect.gen(function* () {
        const updated = yield* modifyRuntime(swarmID, (rt) => {
          const info = cloneInfo(rt.info)
          info.status = "failed"
          info.updatedAt = Date.now()
          return [info, { ...rt, info }]
        })
        if (updated._tag === "None") return
        yield* events.publish(SwarmEvent.Failed, { swarmID, error }).pipe(Effect.ignore)
        yield* publishUpdated(updated.value)
        yield* notify(swarmID, "Swarm failed", error, "error")
      })
    }

    function scheduleNext(swarmID: Swarm.ID): Effect.Effect<void, SwarmNotFound, never> {
      return Effect.gen(function* () {
        const s = yield* InstanceState.get(state)
        type ScheduleResult = {
          launched: string[]
          blocked: Swarm.Agent[]
          done: boolean
          allSucceeded: boolean
        }
        const result = yield* SynchronizedRef.modifyEffect(
          s.swarms,
          (map): Effect.Effect<readonly [ScheduleResult | undefined, Map<Swarm.ID, SwarmRuntime>], never, never> => {
            const rt = map.get(swarmID)
            if (!rt || rt.info.status !== "running") return Effect.succeed([undefined, map])
            const info = cloneInfo(rt.info)
            const launched: string[] = []
            for (const id of Graph.ready(info.agents)) {
              const agent = info.agents.find((item) => item.id === id)
              if (!agent) continue
              agent.status = "working"
              launched.push(id)
            }
            const blocked: Swarm.Agent[] = []
            for (const id of Graph.blocked(info.agents)) {
              const agent = info.agents.find((item) => item.id === id)
              if (!agent) continue
              agent.status = "blocked"
              blocked.push(agent)
            }
            info.updatedAt = Date.now()
            const next = { ...rt, info }
            const value: ScheduleResult = {
              launched,
              blocked,
              done: Graph.isDone(info.agents),
              allSucceeded: Graph.allSucceeded(info.agents),
            }
            return Effect.succeed([value, new Map(map).set(swarmID, next)])
          },
        )
        if (!result) return

        for (const id of result.launched) {
          const agent = yield* agentOf(swarmID, id)
          if (!agent) continue
          yield* events.publish(SwarmEvent.AgentStatus, { swarmID, agent }).pipe(Effect.ignore)
        }
        for (const agent of result.blocked) {
          yield* events
            .publish(SwarmEvent.AgentBlocked, { swarmID, agent, reason: "dependency failed" })
            .pipe(Effect.ignore)
        }
        const rt = yield* getRuntime(swarmID)
        yield* publishUpdated(rt.info)

        for (const id of result.launched) {
          yield* launchAgent(swarmID, id).pipe(Effect.ignore)
        }

        if (result.launched.length === 0 && result.blocked.length > 0) {
          yield* failSwarm(swarmID, "One or more agents are blocked by a failed dependency")
        } else if (result.launched.length === 0 && result.done) {
          if (result.allSucceeded) yield* completeSwarm(swarmID)
          else yield* failSwarm(swarmID, "One or more agents failed")
        }
      })
    }

    const scheduler = Effect.fn("Swarm.scheduler")(function* (swarmID: Swarm.ID) {
      yield* scheduleNext(swarmID)
    })

    // ---- start ----------------------------------------------------------------

    const start = Effect.fn("Swarm.start")(function* (swarmID) {
      const rt = yield* getRuntime(swarmID)
      const info = rt.info
      if (!info.plan) return yield* new SwarmConflict({ swarmID, message: "No plan to start" })
      if (info.approved !== true) return yield* new SwarmConflict({ swarmID, message: "Plan has not been approved" })
      if (info.status === "running") return info
      if (info.status === "completed" || info.status === "failed" || info.status === "cancelled") {
        return yield* new SwarmConflict({ swarmID, message: `Swarm is already ${info.status}` })
      }

      const agents = info.plan.tasks.map((task) => ({
        id: task.id,
        name: task.title,
        ...(task.agent ? { role: task.agent } : {}),
        task: task.description ?? task.title,
        status: "queued" as const,
        dependsOn: [...task.dependsOn],
      }))
      yield* modifyRuntime(swarmID, (rt2) => {
        const next = cloneInfo(rt2.info)
        next.status = "running"
        next.agents = agents as Types.DeepMutable<Swarm.Agent>[]
        next.updatedAt = Date.now()
        return [undefined, { ...rt2, info: next }]
      })

      yield* events.publish(SwarmEvent.Started, { swarmID }).pipe(Effect.ignore)
      const started = yield* get(swarmID)
      yield* publishUpdated(started)
      yield* notify(swarmID, "Swarm started", info.title, "info")

      const fiber = yield* scheduler(swarmID).pipe(Effect.forkIn(scope))
      yield* modifyRuntime(swarmID, (rt2) => {
        const schedulerFiber = fiber
        return [undefined, { ...rt2, scheduler: schedulerFiber }]
      })
      return yield* get(swarmID)
    })

    // ---- cancel ----------------------------------------------------------------

    function cancelAgent(swarmID: Swarm.ID, agentID: string): Effect.Effect<void, SwarmNotFound, never> {
      return Effect.gen(function* () {
        const rt = yield* getRuntime(swarmID)
        const run = rt.runs.get(agentID)
        if (run) {
          yield* background.cancel(run.jobID).pipe(Effect.ignore)
          yield* prompt.cancel(run.sessionID).pipe(Effect.ignore)
          if (run.fiber) yield* Fiber.interrupt(run.fiber).pipe(Effect.ignore)
        }
        yield* setAgentStatus(swarmID, agentID, { status: "cancelled" })
      })
    }

    const cancel = Effect.fn("Swarm.cancel")(function* (swarmID) {
      const rt = yield* getRuntime(swarmID)
      if (rt.info.status === "completed" || rt.info.status === "failed" || rt.info.status === "cancelled") {
        return rt.info
      }
      for (const agentID of Array.from(rt.runs.keys())) {
        yield* cancelAgent(swarmID, agentID)
      }
      yield* modifyRuntime(swarmID, (rt2) => {
        const info = cloneInfo(rt2.info)
        info.status = "cancelled"
        for (const agent of info.agents) {
          if (!Graph.isTerminal(agent.status)) agent.status = "cancelled"
        }
        info.updatedAt = Date.now()
        return [undefined, { ...rt2, info }]
      })
      if (rt.scheduler) yield* Fiber.interrupt(rt.scheduler).pipe(Effect.ignore)
      yield* events.publish(SwarmEvent.Cancelled, { swarmID }).pipe(Effect.ignore)
      const info = yield* get(swarmID)
      yield* publishUpdated(info)
      yield* notify(swarmID, "Swarm cancelled", info.title, "warning")
      return info
    })

    // ---- agent actions -----------------------------------------------------------

    function pushFeedback(swarmID: Swarm.ID, agentID: string, message: string): Effect.Effect<void, Error, never> {
      return Effect.gen(function* () {
        const rt = yield* getRuntime(swarmID)
        const run = rt.runs.get(agentID)
        if (!run) return yield* new SwarmConflict({ swarmID, message: `No session for agent ${agentID}` })
        const task = rt.info.plan?.tasks.find((item) => item.id === agentID)
        const runEffect = feedbackRun({ swarmID, agentID, sessionID: run.sessionID, message }).pipe(
          Effect.catch(Effect.die),
        )
        const extended = yield* background.extend({ id: run.jobID, run: runEffect })
        yield* setAgentStatus(swarmID, agentID, { status: "working" })
        if (!extended) {
          yield* background.start({
            id: run.sessionID,
            type: "swarm",
            title: task?.title ?? agentID,
            metadata: { swarmID, agentID },
            run: runEffect,
          })
          yield* waitAndFinalize(swarmID, agentID, run.sessionID).pipe(Effect.forkIn(scope))
        }
        yield* notify(swarmID, "Agent feedback sent", `Feedback pushed to ${task?.title ?? agentID}`, "info")
      })
    }

    const reviewAgent = Effect.fn("Swarm.reviewAgent")(function* (input: {
      swarmID: Swarm.ID
      agentID: string
      message?: string
    }) {
      const rt = yield* getRuntime(input.swarmID)
      const agent = rt.info.agents.find((item) => item.id === input.agentID)
      if (!agent) {
        return yield* new SwarmConflict({ swarmID: input.swarmID, message: `Agent not found: ${input.agentID}` })
      }
      const hasFeedback = input.message !== undefined && input.message.trim().length > 0
      yield* modifyRuntime(input.swarmID, (rt2) => {
        const info = cloneInfo(rt2.info)
        const item = info.agents.find((a) => a.id === input.agentID)
        if (!item) return [undefined, rt2]
        item.review = hasFeedback
          ? { status: "issues", findings: [{ severity: "warning", message: input.message!.trim() }] }
          : { status: "passed", findings: [] }
        info.updatedAt = Date.now()
        return [undefined, { ...rt2, info }]
      })
      if (hasFeedback) {
        yield* events
          .publish(SwarmEvent.ReviewRequired, { swarmID: input.swarmID, agent, policy: "reviewer" })
          .pipe(Effect.ignore)
        yield* pushFeedback(input.swarmID, input.agentID, input.message!.trim())
      } else {
        const reviewed = yield* agentOf(input.swarmID, input.agentID)
        if (reviewed) {
          yield* events
            .publish(SwarmEvent.ReviewCompleted, { swarmID: input.swarmID, agent: reviewed })
            .pipe(Effect.ignore)
        }
        yield* notify(input.swarmID, "Review passed", agent.name, "success")
      }
      const info = yield* get(input.swarmID)
      yield* publishUpdated(info)
      return info
    })

    const mergeAgent = Effect.fn("Swarm.mergeAgent")(function* (input: {
      swarmID: Swarm.ID
      agentID: string
      requireReview?: boolean
    }) {
      const rt = yield* getRuntime(input.swarmID)
      const agent = rt.info.agents.find((item) => item.id === input.agentID)
      if (!agent) {
        return yield* new SwarmConflict({ swarmID: input.swarmID, message: `Agent not found: ${input.agentID}` })
      }
      if (input.requireReview && agent.review?.status !== "passed") {
        return yield* new SwarmConflict({
          swarmID: input.swarmID,
          message: `Agent ${input.agentID} has not passed review`,
        })
      }
      const run = rt.runs.get(input.agentID)
      if (!run) {
        return yield* new SwarmConflict({
          swarmID: input.swarmID,
          message: `No worktree for agent ${input.agentID}`,
        })
      }
      const mode = rt.info.mode
      const target = Yolo.integrationBranch(mode, rt.info.baseBranch)

      let integrationDir = rt.integrationDir
      if (!integrationDir) {
        const wt = yield* Yolo.integrationWorktree({ worktree, git: gitSvc }, target).pipe(
          Effect.catch((error) =>
            Effect.fail(
              new SwarmConflict({
                swarmID: input.swarmID,
                message: `Failed to create integration worktree: ${error.message}`,
              }),
            ),
          ),
        )
        integrationDir = wt.directory
        yield* modifyRuntime(input.swarmID, (rt2) => {
          const info = cloneInfo(rt2.info)
          info.updatedAt = Date.now()
          return [undefined, { ...rt2, integrationDir, info }]
        })
      }

      yield* setAgentStatus(input.swarmID, input.agentID, { status: "merging" })
      const merged = yield* Yolo.mergeAgentBranch(yolo, {
        directory: integrationDir!,
        branch: run.branch,
        agentID: input.agentID,
      })
      const updated = yield* modifyRuntime(input.swarmID, (rt2) => {
        const info = cloneInfo(rt2.info)
        const item = info.agents.find((a) => a.id === input.agentID)
        if (!item) return [undefined, rt2]
        item.merge = { status: merged.status, target, ...(merged.message ? { message: merged.message } : {}) }
        item.status = merged.status === "merged" ? "merged" : "awaiting-review"
        item.completedAt = merged.status === "merged" ? Date.now() : item.completedAt
        info.updatedAt = Date.now()
        return [item, { ...rt2, info }]
      })
      if (updated._tag === "Some" && updated.value && merged.status === "merged") {
        yield* events
          .publish(SwarmEvent.MergeCompleted, { swarmID: input.swarmID, agent: updated.value, target })
          .pipe(Effect.ignore)
        yield* notify(input.swarmID, "Merge completed", `${agent.name} merged into ${target}`, "success")
      } else {
        yield* notify(input.swarmID, "Merge conflict", `${agent.name} merge had a conflict`, "warning")
      }
      yield* scheduleNext(input.swarmID)
      const info = yield* get(input.swarmID)
      yield* publishUpdated(info)
      return info
    })

    const agent = Effect.fn("Swarm.agent")(function* (input) {
      const rt = yield* getRuntime(input.swarmID)
      const exists = rt.info.agents.some((item) => item.id === input.agentID)
      if (!exists) {
        return yield* new SwarmConflict({ swarmID: input.swarmID, message: `Agent not found: ${input.agentID}` })
      }
      switch (input.action) {
        case "cancel":
          yield* cancelAgent(input.swarmID, input.agentID)
          break
        case "review":
          return yield* reviewAgent({ swarmID: input.swarmID, agentID: input.agentID, message: input.message })
        case "merge":
          return yield* mergeAgent({ swarmID: input.swarmID, agentID: input.agentID })
        case "approve-merge":
          return yield* mergeAgent({ swarmID: input.swarmID, agentID: input.agentID, requireReview: true })
        case "retry":
          yield* pushFeedback(
            input.swarmID,
            input.agentID,
            input.message ?? "Please retry the task, addressing any outstanding issues.",
          )
          break
      }
      const info = yield* get(input.swarmID)
      yield* publishUpdated(info)
      return info
    })

    return Service.of({ create, list, get, plan, approve, start, cancel, agent })
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer: layer,
  deps: [
    BackgroundJob.node,
    Session.node,
    SessionPrompt.node,
    Worktree.node,
    Git.node,
    EventV2Bridge.node,
    Agent.node,
    AppProcess.node,
  ],
})

export * as SwarmManager from "./manager"
