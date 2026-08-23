/**
 * High-fidelity summarization backend for dsh-compaction-pro.
 *
 * Mirrors the cache-reusing `ctx.llm.stream()` call shape of
 * dsh-compaction-basic (so the provider's warm prefix cache is reused), but
 * swaps in dsh-compaction-pro's improved prompt and adds optional recursive
 * chunking for very large regions. The policy / retention / token-meter
 * machinery from the base `BasicCompactionEngine` is inherited untouched.
 *
 * @module dsh-compaction-pro/summarize
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ResolvedConfig } from '@deepseek-ai/dsh-compaction-basic';
import type { SummarizationInput, SummaryResult } from './types.js';
/** Additive configuration vocabulary understood by dsh-compaction-pro. */
export interface ProCompactionConfig {
    /** Output language of the summary. `auto` follows the conversation. Default `auto`. */
    summaryLanguage?: 'en' | 'zh' | 'auto';
    /** Preserve exact numbers/paths/commands/identifiers. Default `true`. */
    faithful?: boolean;
    /** Split very large regions into chunks, then merge. Default `true`. */
    recursive?: boolean;
    /** Messages per chunk when `recursive` is on. Default `40`. */
    chunkMessages?: number;
    /** Fully replace the built-in compaction instruction. */
    customInstruction?: string;
}
/** Resolved + validated additive config with no optional fields. */
export interface ResolvedProConfig {
    readonly summaryLanguage: 'en' | 'zh' | 'auto';
    readonly faithful: boolean;
    readonly recursive: boolean;
    readonly chunkMessages: number;
    readonly customInstruction?: string;
}
/**
 * The full resolved config the summarizer needs: base policy fields
 * (`summarizationProvider/Model`, `maxTokens`) plus the pro additions.
 */
export type ProResolvedFull = ResolvedConfig & ResolvedProConfig;
/** Apply defaults to the additive pro config. */
export declare function resolveProConfig(c?: ProCompactionConfig): ResolvedProConfig;
/**
 * Run dsh-compaction-pro summarization for one region.
 *
 * Implements the documented `summarize()` contract of `BasicCompactionEngine`:
 * replay the conversation prefix (system/tools/leading messages) and append the
 * instruction as the final user message so the provider's warm prefix cache is
 * reused. When `recursive` is enabled and the region is large, it first
 * condenses each chunk, then merges the digests into the final structure.
 *
 * @param ctx - context providing the LLM service.
 * @param config - resolved base + pro config.
 * @param input - replayed conversation prefix to condense.
 * @param agent - supplies routed-model history, fallback model, and session id.
 * @param signal - optional cancellation forwarded to the adapter.
 * @returns safe text-only summary blocks and the exact call envelope.
 */
export declare function proSummarize(ctx: Context, config: ProResolvedFull, input: SummarizationInput, agent: Agent, signal?: AbortSignal): Promise<SummaryResult>;
