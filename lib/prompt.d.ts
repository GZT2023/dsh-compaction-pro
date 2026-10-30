/**
 * Compaction instruction builders for dsh-compaction-pro.
 *
 * The default dsh-compaction-basic prompt is a generic English template. This
 * module is where dsh-compaction-pro earns its keep:
 *   1. Faithful / PIT-preserving — exact numbers, paths, commands, identifiers
 *      are never rounded or paraphrased (critical for coding + quant agents).
 *   2. Bilingual — output follows the conversation language; code/identifiers
 *      stay verbatim (Chinese users are the dominant dsh demographic).
 *   3. Decisions AND rationale — matches how the user actually reasons.
 *   4. Recursive-aware — PARTIAL digests chunks, MERGE folds them back.
 *
 * @module dsh-compaction-pro/prompt
 */
import type { ResolvedProConfig } from './summarize.js';
/**
 * Build the main compaction directive delivered as the final user message.
 * @param cfg - resolved pro configuration (language / faithfulness / custom).
 * @returns the instruction string appended after the replayed conversation.
 */
export declare function buildInstruction(cfg: ResolvedProConfig): string;
/**
 * Instruction for a single chunk during recursive (pre-)summarization.
 * Produces a terse factual digest, not the full structure.
 */
export declare function partialInstruction(cfg: ResolvedProConfig): string;
/**
 * Instruction that folds chunk digests back into the canonical structure.
 * @param cfg - resolved pro configuration.
 * @param partials - ordered chunk digests.
 * @returns the merge directive with digests inlined.
 */
export declare function mergeInstruction(cfg: ResolvedProConfig, partials: string[]): string;
