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

import type { Context } from '@deepseek-ai/cordis'
import {
  BlockAssembler,
  contentHasImage,
  createUserMessage,
  LlmError,
} from '@deepseek-ai/dsh-llm'
import type {
  ContentBlock,
  FinishReason,
  GenerateOptions,
  Message,
  TokenUsage,
} from '@deepseek-ai/dsh-llm'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ResolvedConfig } from '@deepseek-ai/dsh-compaction-basic'

import {
  buildInstruction,
  mergeInstruction,
  partialInstruction,
} from './prompt.js'
import type { SummarizationInput, SummaryResult } from './types.js'

/** Additive configuration vocabulary understood by dsh-compaction-pro. */
export interface ProCompactionConfig {
  /** Output language of the summary. `auto` follows the conversation. Default `auto`. */
  summaryLanguage?: 'en' | 'zh' | 'auto'
  /** Preserve exact numbers/paths/commands/identifiers. Default `true`. */
  faithful?: boolean
  /** Split very large regions into chunks, then merge. Default `true`. */
  recursive?: boolean
  /** Messages per chunk when `recursive` is on. Default `40`. */
  chunkMessages?: number
  /** Fully replace the built-in compaction instruction. */
  customInstruction?: string
}

/** Resolved + validated additive config with no optional fields. */
export interface ResolvedProConfig {
  readonly summaryLanguage: 'en' | 'zh' | 'auto'
  readonly faithful: boolean
  readonly recursive: boolean
  readonly chunkMessages: number
  readonly customInstruction?: string
}

/**
 * The full resolved config the summarizer needs: base policy fields
 * (`summarizationProvider/Model`, `maxTokens`) plus the pro additions.
 */
export type ProResolvedFull = ResolvedConfig & ResolvedProConfig

/** Apply defaults to the additive pro config. */
export function resolveProConfig(c: ProCompactionConfig = {}): ResolvedProConfig {
  return {
    summaryLanguage: c.summaryLanguage ?? 'auto',
    faithful: c.faithful ?? true,
    recursive: c.recursive ?? true,
    chunkMessages: c.chunkMessages ?? 40,
    customInstruction: c.customInstruction,
  }
}

/** Resolve the provider/model pair to summarize with. */
function resolveSummarizeTarget(
  agent: Agent,
  config: ProResolvedFull,
): { provider: string; model: string } {
  const latest = agent.session.requestHeader()?.config
  const routed = latest !== undefined && latest.provider.length > 0 && latest.model.length > 0
    ? { provider: latest.provider, model: latest.model }
    : undefined
  const agentTarget = agent.options.provider !== undefined && agent.options.provider.length > 0
    && agent.options.model !== undefined && agent.options.model.length > 0
    ? { provider: agent.options.provider, model: agent.options.model }
    : undefined
  const target = routed ?? agentTarget
  if (target === undefined) {
    throw new Error(
      'dsh-compaction-pro: no provider/model available for summarization '
      + '(set summarizationProvider/summarizationModel, route one request, or set AgentOptions)',
    )
  }
  // `summarizationProvider`/`summarizationModel` are optional: when left
  // unset (the documented default — "reuse the conversation's routed model")
  // they are `undefined`, so guard against reading `.length` on them.
  const provider = config.summarizationProvider ? config.summarizationProvider : target.provider
  const model = config.summarizationModel ? config.summarizationModel : target.model
  return { provider, model }
}

/** One streaming summarization call; returns text-only blocks + usage. */
async function runStream(
  ctx: Context,
  options: GenerateOptions,
): Promise<{ blocks: ContentBlock[]; usage?: TokenUsage }> {
  const assembler = new BlockAssembler()
  for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk)

  const error = finishError(assembler.finish)
  if (error !== undefined) throw error

  const raw = assembler.blocks()
  if (contentHasImage(raw)) {
    throw new LlmError('compaction summary cannot contain image output', 'UNSUPPORTED_CONTENT')
  }
  const text = raw.filter(
    (block: ContentBlock): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text',
  )
  if (!text.some((block) => block.text.trim().length > 0)) {
    throw new Error('dsh-compaction-pro: summarization produced no text summary content')
  }
  return { blocks: text, usage: assembler.usage }
}

/** Map a terminal finish to its fail-closed error. */
function finishError(finish: FinishReason): Error | undefined {
  switch (finish.kind) {
    case 'error':
    case 'aborted': {
      const error = new Error(finish.failure.message) as Error & { code?: string }
      error.code = finish.failure.code
      return error
    }
    case 'max-tokens': {
      const error = new Error('dsh-compaction-pro: summarization truncated at the token cap (incomplete checkpoint)') as Error & { code?: string }
      error.code = 'MAX_TOKENS'
      return error
    }
    default:
      return undefined
  }
}

/** Wrap streamed text blocks into a valid SummaryResult. */
function finalize(
  result: { blocks: ContentBlock[]; usage?: TokenUsage },
  provider: string,
  model: string,
  maxTokens?: number,
): SummaryResult {
  return {
    summary: result.blocks,
    rawOutput: result.blocks,
    llmStreamCall: true,
    provider,
    model,
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(result.usage === undefined ? {} : { usage: result.usage }),
  }
}

/** Split messages into chunks no larger than `size`. */
function chunkMessages(messages: readonly Message[], size: number): Message[][] {
  const out: Message[][] = []
  for (let i = 0; i < messages.length; i += size) out.push(messages.slice(i, i + size))
  return out
}

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
export async function proSummarize(
  ctx: Context,
  config: ProResolvedFull,
  input: SummarizationInput,
  agent: Agent,
  signal?: AbortSignal,
): Promise<SummaryResult> {
  const { provider, model } = resolveSummarizeTarget(agent, config)
  const maxTokens = config.maxTokens
  const sessionId = agent.session.id
  const baseOptions: Omit<GenerateOptions, 'messages'> = {
    provider,
    model,
    maxTokens,
    sessionId,
    purpose: 'compaction',
    ...(signal === undefined ? {} : { signal }),
  }

  // Recursive path: condense each chunk, then merge into the final structure.
  if (config.recursive && input.messages.length > config.chunkMessages) {
    const chunks = chunkMessages(input.messages, config.chunkMessages)
    const partials: string[] = []
    for (const chunk of chunks) {
      const partial = await runStream(ctx, {
        ...baseOptions,
        messages: [
          ...chunk,
          createUserMessage({
            content: [{ type: 'text', text: partialInstruction(config) }],
            source: { kind: 'plugin', plugin: 'dsh-compaction-pro' },
          }),
        ],
      })
      partials.push(partial.blocks.map(b => (b as Extract<ContentBlock, { type: 'text' }>).text).join(''))
    }
    const merged = await runStream(ctx, {
      ...baseOptions,
      messages: [
        createUserMessage({
          content: [{ type: 'text', text: mergeInstruction(config, partials) }],
          source: { kind: 'plugin', plugin: 'dsh-compaction-pro' },
        }),
      ],
    })
    return finalize(merged, provider, model, maxTokens)
  }

  // Single-pass path: replay prefix + improved instruction.
  const full = await runStream(ctx, {
    ...baseOptions,
    messages: [
      ...input.messages,
      createUserMessage({
        content: [{ type: 'text', text: buildInstruction(config) }],
        source: { kind: 'plugin', plugin: 'dsh-compaction-pro' },
      }),
    ],
    ...(input.system === undefined ? {} : { system: input.system }),
    ...(input.tools === undefined ? {} : { tools: [...input.tools] }),
  })
  return finalize(full, provider, model, maxTokens)
}
