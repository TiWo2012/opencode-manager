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

function extractJson(text: string): Option.Option<unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? (fenced[1] ?? text) : text
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return Option.none()
  const raw = candidate.slice(start, end + 1)
  try {
    return Option.some(JSON.parse(raw) as unknown)
  } catch {
    return Option.none()
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
current repository, then output a plan as a SINGLE JSON object with exactly
this shape (no prose, no markdown fences, no comments):

{
  "summary": "one-paragraph summary of the approach",
  "tasks": [
    {
      "id": "short kebab-case id (unique)",
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
    "reason": "why this fatality score"
  }
}

RISK RUBRIC: the score measures the potential impact of autonomous execution
going catastrophically wrong — NOT complexity. 1-2: isolated, reversible. 3-5:
moderate blast radius. 6-7: wide impact. 8-9: destructive or hard to reverse.
10: human approval is required (never bypass this).

Split the work into small parallelizable tasks with explicit dependencies.
Avoid over-decomposing; 2-6 tasks is typical. Prefer the "general" agent unless
the task is purely exploration ("explore") or implementation of an existing
plan ("build").

THE TASK:
`.trim()

/** Fallback plan when the planner output cannot be parsed (risk 10 = human approval). */
export function fallbackPlan(task: string, assessedAt: number): Swarm.Plan {
  return {
    summary: `Automatic fallback plan for: ${task}`,
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
      score: 10,
      reason: "Plan generation failed; conservative human approval required",
      policy: "human-approval",
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

  const result = yield* prompt.prompt({
    sessionID: session.id,
    agent: agentName,
    parts: [{ type: "text", text: [PLANNER_INSTRUCTIONS, input.task].join("\n\n") }],
  })

  const text = finalText(result)
  return parsePlan(text, assessedAt) ?? fallbackPlan(input.task, assessedAt)
})

export * as SwarmPlanner from "./planner"
