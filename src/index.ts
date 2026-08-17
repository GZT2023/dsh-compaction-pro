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

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { BasicCompactionEngine, type BasicCompactionConfig } from '@deepseek-ai/dsh-compaction-basic'
import type { Agent } from '@deepseek-ai/dsh-agent'

import {
  proSummarize,
  resolveProConfig,
  type ProCompactionConfig,
  type ResolvedProConfig,
} from './summarize.js'
import type { SummarizationInput, SummaryResult } from './types.js'

export type { ProCompactionConfig, ResolvedProConfig } from './summarize.js'

// Mirror the base policy schema (basic strips unknown keys, so our additions
// ride on a separate resolved object) and append the pro vocabulary.
const num = z.number()
const str = z.string()
const modelPolicy = z.object({
  provider: z.string().required(),
  model: z.string().required(),
  thresholdRatio: num,
  retainRatio: num,
  retainTokens: z.number().step(1).min(0),
  summarizationProvider: str,
  summarizationModel: str,
  maxTokens: z.number().step(1).min(1),
  compactionRetries: z.number().step(1).min(0),
  maxOverflowRetries: z.number().step(1).min(0),
})

// Keys owned by the base `BasicCompactionEngine`. The base constructor
// validates its config against `BasicCompactionConfig` and THROWS on any
// unknown key, so we must strip our pro-only keys before calling super().
const BASE_KEYS = [
  'thresholdRatio', 'retainRatio', 'retainTokens', 'summarizationProvider',
  'summarizationModel', 'maxTokens', 'compactionRetries', 'maxOverflowRetries',
  'modelPolicies', 'auto',
] as const

/**
 * Drop-in, higher-fidelity replacement for `dsh-compaction-basic`.
 * Registers as `ctx.compaction`, superseding the built-in backend.
 */
export class ProCompactionEngine extends BasicCompactionEngine {
  static inject = ['llm', 'tokenMeter', 'sessions']

  static Config = z.object({
    thresholdRatio: num,
    retainRatio: num,
    retainTokens: z.number().step(1).min(0),
    summarizationProvider: str,
    summarizationModel: str,
    maxTokens: z.number().step(1).min(1),
    compactionRetries: z.number().step(1).min(0),
    maxOverflowRetries: z.number().step(1).min(0),
    modelPolicies: z.array(modelPolicy),
    auto: z.boolean(),
    // --- dsh-compaction-pro additions ---
    // Allowed values: 'en' | 'zh' | 'auto'. schemastery v3 exposes no static
    // literal/union factory, so we validate the string and document the set.
    summaryLanguage: z.string(),
    faithful: z.boolean(),
    recursive: z.boolean(),
    chunkMessages: z.number().step(1).min(1),
    customInstruction: z.string(),
  })

  /** Resolved additive configuration (faithful / language / recursion). */
  readonly proConfig: ResolvedProConfig

  constructor(ctx: Context, config: ProCompactionConfig = {}) {
    // The base `BasicCompactionEngine` validates its config against
    // `BasicCompactionConfig` and THROWS on unknown keys, so strip our
    // pro-only keys before super(). The full config (base + pro) is kept
    // for `resolveProConfig` and the `summarize()` override.
    const cfg = config as Record<string, unknown>
    const base: Record<string, unknown> = {}
    for (const k of BASE_KEYS) if (k in cfg) base[k] = cfg[k]
    super(ctx, base as unknown as BasicCompactionConfig)
    this.proConfig = resolveProConfig(config)
  }

  /**
   * The sole subclass hook. Delegates to dsh-compaction-pro's improved
   * summarizer (faithful, bilingual, recursive-aware).
   */
  protected override async summarize(
    input: SummarizationInput,
    agent: Agent,
    signal?: AbortSignal,
  ): Promise<SummaryResult> {
    const full = { ...this.config, ...this.proConfig }
    return proSummarize(this.ctx, full, input, agent, signal)
  }
}

export default ProCompactionEngine

/** Cordis plugin entry — registers the pro backend as `ctx.compaction`. */
export const name = 'dsh-compaction-pro'

export function apply(ctx: Context): void {
  ctx.plugin(ProCompactionEngine)
  // Startup self-check / conflict guidance: this plugin and the built-in
  // `dsh-compaction-basic` both register the same `ctx.compaction` service.
  // If both are enabled, cordis aborts startup with a "service already
  // provided" error. Announce activation so the failure mode is
  // self-explanatory, and tell the user to disable the built-in backend.
  const msg =
    '[dsh-compaction-pro] registered as the `ctx.compaction` provider ' +
    '(high-fidelity mode). If the harness fails to start with a ' +
    '"service already provided" / conflicting `ctx.compaction` error, you ' +
    'have BOTH dsh-compaction-basic and dsh-compaction-pro enabled — ' +
    'disable dsh-compaction-basic in your cordis.patch.yml.'
  if (ctx.logger?.info) ctx.logger.info(msg)
  else console.log(msg)
}
