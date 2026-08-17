/**
 * Local mirror of the `summarize()` contract types.
 *
 * The shipped `@deepseek-ai/dsh-compaction-basic` package does NOT re-export
 * `SummarizationInput` / `SummaryResult` from its root, and its `"./src/*"`
 * export subpath points at `src/` files that are not included in the published
 * artifact (only `lib/` + `lib/types/` ship). Importing them from the root or
 * the subpath therefore fails for a consumer at both type-check and runtime.
 *
 * These definitions are copied verbatim from the built
 * `lib/types/summarizer.d.ts` so dsh-compaction-pro stays wire-compatible with
 * the base engine's `protected summarize()` hook. They depend only on
 * `dsh-llm` types, which ARE exported from that package's root.
 *
 * @module dsh-compaction-pro/types
 */

import type {
  ContentBlock,
  Message,
  TokenUsage,
  ToolSchema,
} from '@deepseek-ai/dsh-llm'

/**
 * The replayed conversation surface the summarizer condenses. Reproducing the
 * last routed request's system prompt, tools, and leading messages verbatim
 * lets the auxiliary call reuse the provider's warm prefix cache; the trailing
 * compaction instruction is then the only novel input.
 */
export interface SummarizationInput {
  /** The conversation's own system prompt, reused for prefix-cache alignment; absent for a system-less request. */
  readonly system?: string
  /** The conversation's tool schemas, reused for prefix-cache alignment; absent when the request carried none. */
  readonly tools?: readonly ToolSchema[]
  /** The shadowed region, in surface order, that precedes the compaction instruction. */
  readonly messages: readonly Message[]
}

/** Safe summary content plus the exact auxiliary call envelope recorded with it. */
export type SummaryResult = {
  summary: ContentBlock[]
  provider: string
  model: string
  maxTokens?: number
  /** Provider-reported usage for this summarization request. */
  usage?: TokenUsage
} & ({
  /** Complete provider output before the text-only summary projection. */
  rawOutput: ContentBlock[]
  /** Identifies exactly one call through this context's `ctx.llm.stream()`. */
  llmStreamCall: true
} | {
  /** Optional complete output from an unmarked template, remote, or other summarizer. */
  rawOutput?: ContentBlock[]
  /** An unmarked result does not identify a call through this context's LLM seam. */
  llmStreamCall?: never
})
