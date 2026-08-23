/**
 * dsh-compaction-pro — a high-fidelity compaction backend for DeepSeek Harness.
 *
 * Extends the official `BasicCompactionEngine` and overrides ONLY the
 * `summarize()` hook (the documented extension point), inheriting all of
 * basic's pressure / retention / token-meter machinery. The differentiator is
 * the summarization quality: faithful PIT-preserving, bilingual, and optionally
 * recursive for very large regions.
 *
 * @module dsh-compaction-pro
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { type ProCompactionConfig, type ResolvedProConfig } from './summarize.js';
import type { SummarizationInput, SummaryResult } from './types.js';
export type { ProCompactionConfig, ResolvedProConfig } from './summarize.js';
/**
 * Drop-in, higher-fidelity replacement for `dsh-compaction-basic`.
 * Registers as `ctx.compaction`, superseding the built-in backend.
 */
export declare class ProCompactionEngine extends BasicCompactionEngine {
    static inject: string[];
    static Config: z<Schemastery.ObjectS<{
        thresholdRatio: z<number, number>;
        retainRatio: z<number, number>;
        retainTokens: z<number, number>;
        summarizationProvider: z<string, string>;
        summarizationModel: z<string, string>;
        maxTokens: z<number, number>;
        compactionRetries: z<number, number>;
        maxOverflowRetries: z<number, number>;
        modelPolicies: z<({
            provider?: string | null | undefined;
            model?: string | null | undefined;
            thresholdRatio?: number | null | undefined;
            retainRatio?: number | null | undefined;
            retainTokens?: number | null | undefined;
            summarizationProvider?: string | null | undefined;
            summarizationModel?: string | null | undefined;
            maxTokens?: number | null | undefined;
            compactionRetries?: number | null | undefined;
            maxOverflowRetries?: number | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
            provider: z<string, string>;
            model: z<string, string>;
            thresholdRatio: z<number, number>;
            retainRatio: z<number, number>;
            retainTokens: z<number, number>;
            summarizationProvider: z<string, string>;
            summarizationModel: z<string, string>;
            maxTokens: z<number, number>;
            compactionRetries: z<number, number>;
            maxOverflowRetries: z<number, number>;
        }>[]>;
        auto: z<boolean, boolean>;
        summaryLanguage: z<string, string>;
        faithful: z<boolean, boolean>;
        recursive: z<boolean, boolean>;
        chunkMessages: z<number, number>;
        customInstruction: z<string, string>;
    }>, Schemastery.ObjectT<{
        thresholdRatio: z<number, number>;
        retainRatio: z<number, number>;
        retainTokens: z<number, number>;
        summarizationProvider: z<string, string>;
        summarizationModel: z<string, string>;
        maxTokens: z<number, number>;
        compactionRetries: z<number, number>;
        maxOverflowRetries: z<number, number>;
        modelPolicies: z<({
            provider?: string | null | undefined;
            model?: string | null | undefined;
            thresholdRatio?: number | null | undefined;
            retainRatio?: number | null | undefined;
            retainTokens?: number | null | undefined;
            summarizationProvider?: string | null | undefined;
            summarizationModel?: string | null | undefined;
            maxTokens?: number | null | undefined;
            compactionRetries?: number | null | undefined;
            maxOverflowRetries?: number | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
            provider: z<string, string>;
            model: z<string, string>;
            thresholdRatio: z<number, number>;
            retainRatio: z<number, number>;
            retainTokens: z<number, number>;
            summarizationProvider: z<string, string>;
            summarizationModel: z<string, string>;
            maxTokens: z<number, number>;
            compactionRetries: z<number, number>;
            maxOverflowRetries: z<number, number>;
        }>[]>;
        auto: z<boolean, boolean>;
        summaryLanguage: z<string, string>;
        faithful: z<boolean, boolean>;
        recursive: z<boolean, boolean>;
        chunkMessages: z<number, number>;
        customInstruction: z<string, string>;
    }>>;
    /** Resolved additive configuration (faithful / language / recursion). */
    readonly proConfig: ResolvedProConfig;
    constructor(ctx: Context, config?: ProCompactionConfig);
    /**
     * The sole subclass hook. Delegates to dsh-compaction-pro's improved
     * summarizer (faithful, bilingual, recursive-aware).
     */
    protected summarize(input: SummarizationInput, agent: Agent, signal?: AbortSignal): Promise<SummaryResult>;
}
export default ProCompactionEngine;
/** Cordis plugin entry — registers the pro backend as `ctx.compaction`. */
export declare const name = "dsh-compaction-pro";
export declare function apply(ctx: Context): void;
