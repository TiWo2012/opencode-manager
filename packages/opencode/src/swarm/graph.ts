/**
 * Dependency graph primitives for swarm scheduling.
 *
 * Agents are scheduled from a plan's task dependency graph. A task may only
 * run once every task it depends on has reached a successful terminal state
 * (completed or merged). A task whose dependencies failed is blocked.
 */

export * from "@opencode-ai/schema/swarm-graph"

export * as Graph from "./graph"
