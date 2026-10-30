/**
 * dsh-compaction-pro — a high-fidelity compaction backend for DeepSeek Harness.
 */
import type { Context } from '@deepseek-ai/cordis';
import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { type ProCompactionConfig, type ResolvedProConfig } from './summarize.js';
import type { SummarizationInput, SummaryResult } from './types.js';
export type { ProCompactionConfig, ResolvedProConfig } from './summarize.js';
export declare class ProCompactionEngine extends BasicCompactionEngine {
    static inject: string[];
    static Config: any;
    readonly proConfig: ResolvedProConfig;
    constructor(ctx: Context, config?: ProCompactionConfig);
    protected summarize(input: SummarizationInput, agent: Agent, signal?: AbortSignal): Promise<SummaryResult>;
}
export default ProCompactionEngine;
export declare const name = "dsh-compaction-pro";
export declare function apply(ctx: Context): void;
