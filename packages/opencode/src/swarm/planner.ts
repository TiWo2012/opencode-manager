import { SwarmPolicy } from "@opencode-ai/core/swarm/policy"
import { Session } from "@/session/session"
import { SessionPrompt } from "@/session/prompt"
import { Agent } from "@/agent/agent"
import { Effect, Option, Schema } from "effect"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { Swarm } from "@opencode-ai/schema/swarm"

/**
 * Plan generation. A dedicated planner agent session explores the codebase and
 * produces a structured task graph with a fatality-score risk assessment. The
 * resulting plan is parsed against the schema contracts in
 * `@opencode-ai/schema/swarm`.
 */

const decodePlan = Schema.decodeUnknownOption(Swarm.Plan)

/**
 * Extract the first parseable JSON object from arbitrary text (the planner may
 * emit reasoning before the JSON). Uses brace matching that skips braces inside
 * string literals, and keeps scanning for the next object if a balanced region
 * fails to parse (e.g. reasoning text that itself contains braces).
 */
function extractJson(text: string): Option.Option<unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? (fenced[1] ?? text) : text
  let scanFrom = 0
  for (;;) {
    const start = candidate.indexOf("{", scanFrom)
    if (start === -1) return Option.none()
    let depth = 0
    let inString = false
    let escaped = false
    let matched = false
    for (let index = start; index < candidate.length; index++) {
      const char = candidate[index]
      if (inString) {
        if (escaped) {
          escaped = false
        } else if (char === "\\") {
          escaped = true
        } else if (char === '"') {
          inString = false
        }
        continue
      }
      if (char === '"') {
        inString = true
      } else if (char === "{") {
        depth++
      } else if (char === "}") {
        depth--
        if (depth === 0) {
          const raw = candidate.slice(start, index + 1)
          try {
            return Option.some(JSON.parse(raw) as unknown)
          } catch {
            matched = true
            break
          }
        }
      }
    }
    if (!matched) return Option.none()
    scanFrom = start + 1
  }
}

/** Parse planner output into a validated plan. Returns `undefined` on failure. */
export function parsePlan(text: string, assessedAt: number): Swarm.Plan | undefined {
  const raw = extractJson(text)
  if (Option.isNone(raw)) return
  const parsed = raw.value
  if (typeof parsed !== "object" || parsed === null) return
  const value = parsed as {
    summary?: unknown
    tasks?: unknown
    risk?: { score?: unknown; reason?: unknown }
  }
  if (typeof value.summary !== "string" || !Array.isArray(value.tasks) || typeof value.risk?.score !== "number") {
    return
  }
  const score = Math.min(10, Math.max(1, Math.round(value.risk.score))) as Swarm.RiskScore
  const candidate: Swarm.Plan = {
    summary: value.summary,
    tasks: value.tasks.flatMap((task) => {
      if (typeof task !== "object" || task === null) return []
      const item = task as {
        id?: unknown
        title?: unknown
        description?: unknown
        agent?: unknown
        dependsOn?: unknown
        requiresReview?: unknown
        validation?: unknown
      }
      if (typeof item.id !== "string" || typeof item.title !== "string") return []
      return [
        {
          id: item.id,
          title: item.title,
          ...(typeof item.description === "string" ? { description: item.description } : {}),
          ...(typeof item.agent === "string" ? { agent: item.agent } : {}),
          dependsOn: Array.isArray(item.dependsOn)
            ? item.dependsOn.filter((dep): dep is string => typeof dep === "string")
            : [],
          ...(item.requiresReview === true ? { requiresReview: true } : {}),
          ...(Array.isArray(item.validation)
            ? { validation: item.validation.filter((step): step is string => typeof step === "string") }
            : {}),
        },
      ]
    }),
    risk: {
      score,
      reason: typeof value.risk.reason === "string" ? value.risk.reason : "No reason provided",
      policy: SwarmPolicy.decide(score),
      assessedAt,
    },
  }
  if (candidate.tasks.length === 0) return
  const decoded = Schema.decodeUnknownOption(Swarm.Plan)(candidate)
  if (Option.isNone(decoded)) return
  return decoded.value
}

function finalText(result: SessionV1.WithParts): string {
  return result.parts
    .filter((part): part is Extract<SessionV1.Part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
}

const PLANNER_INSTRUCTIONS = `
You are planning a multi-agent software task. Analyze the request below and the
current repository, then produce a plan.

OUTPUT REQUIREMENT (critical):
Respond with ONLY a single JSON object. Do not include any thinking, reasoning,
explanation, markdown fences, code blocks, or text before or after the JSON.
The very first character of your reply must be "{" and the last character "}".
Use exactly this shape:

{
  "summary": "one-paragraph summary of the approach",
  "tasks": [
    {
      "id": "short kebab-case id (unique, 3-30 chars)",
      "title": "short imperative title",
      "description": "what the agent should implement (optional)",
      "agent": "general | explore | build (optional, default general)",
      "dependsOn": ["ids of tasks that must complete first"],
      "requiresReview": true,
      "validation": ["shell command that proves this task works (optional)"]
    }
  ],
  "risk": {
    "score": <integer 1-10>,
    "reason": "one or two sentences explaining the score"
  }
}

RISK RUBRIC — the score measures the FATALITY of autonomous execution going
catastrophically wrong: data loss, unrecoverable state, production impact,
breaking infrastructure. It is NOT about code size, difficulty, or how many
agents are needed.

- Score 1-2 (automatic): work confined to this repository, fully reversible
  with git, has tests, touches no production systems or external resources.
  MOST development tasks fall here — e.g. writing tests, adding features,
  refactoring, documentation.
- Score 3-5 (self-review): touches build/release tooling, migrations, or
  anything whose failure is annoying but recoverable.
- Score 6-7 (reviewer): could affect many users or external systems, hard to
  reverse, but not destructive.
- Score 8-9 (conservative): destructive or very hard to reverse, production
  data at risk.
- Score 10 (human approval): irreversible destruction, production data loss,
  infrastructure outside the repository. NEVER score 10 for ordinary code
  work. When in doubt, prefer a LOW score (1-3) and note the uncertainty in
  the reason.

Split the work into small parallelizable tasks with explicit dependencies.
Avoid over-decomposing; 2-6 tasks is typical. Prefer the "general" agent unless
the task is purely exploration ("explore") or implementation of an existing
plan ("build").

THE TASK:
`.trim()

/** Fallback plan when the planner output cannot be parsed (kept low-risk). */
export function fallbackPlan(task: string, assessedAt: number): Swarm.Plan {
  return {
    summary: `Fallback plan for: ${task}`,
    tasks: [
      {
        id: "task-1",
        title: "Complete the task",
        description: task,
        agent: "general",
        dependsOn: [],
      },
    ],
    risk: {
      score: 3,
      reason: "The planner could not produce a structured plan, so a conservative single-task default was used. Review before starting.",
      policy: "self-review",
      assessedAt,
    },
  }
}

/**
 * Run the planner agent and produce a validated plan.
 *
 * The planner session runs in the primary instance directory (planning is
 * read-only) and the response is parsed into the schema contract.
 */
export const runPlanner = Effect.fn("SwarmPlanner.run")(function* (input: { title: string; task: string }) {
  const sessions = yield* Session.Service
  const prompt = yield* SessionPrompt.Service
  const agents = yield* Agent.Service
  const planner = yield* agents.get("planner").pipe(Effect.option)
  const agentName = planner._tag === "Some" ? "planner" : "general"
  const assessedAt = Date.now()

  const session = yield* sessions.create({
    title: `Swarm plan: ${input.title}`,
    agent: agentName,
  })

  const runAttempt = Effect.fnUntraced(function* (promptText: string) {
    const result = yield* prompt.prompt({
      sessionID: session.id,
      agent: agentName,
      parts: [{ type: "text", text: promptText }],
    })
    return finalText(result)
  })

  const first = yield* runAttempt([PLANNER_INSTRUCTIONS, input.task].join("\n\n"))
  const parsed = parsePlan(first, assessedAt)
  if (parsed) return parsed

  // The model produced no parseable JSON (e.g. only reasoning, or prose).
  // Retry once with a corrective nudge before giving up.
  yield* Effect.logWarning("swarm planner first response did not parse; retrying", {
    output: first.slice(0, 1000),
  })
  const second = yield* runAttempt(
    [
      PLANNER_INSTRUCTIONS,
      "Your previous response was not accepted because it was not a single valid JSON object.",
      "Respond with ONLY the JSON object. No reasoning, no markdown, nothing before the opening brace.",
      "",
      "THE TASK:",
      input.task,
    ].join("\n\n"),
  )
  const retried = parsePlan(second, assessedAt)
  if (retried) return retried

  yield* Effect.logWarning("swarm planner output did not parse into a plan; using fallback", {
    output: second.slice(0, 1000),
  })
  return fallbackPlan(input.task, assessedAt)
})

export * as SwarmPlanner from "./planner"
