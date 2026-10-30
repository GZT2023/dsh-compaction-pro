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
export {};
