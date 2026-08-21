import { describe, it, expect, vi } from 'vitest'

// The entire @deepseek-ai/dsh-llm runtime is mocked: we only need its shape,
// not a live LLM. This keeps the suite fast, offline, and free of the heavy
// cordis dependency graph.
vi.mock('@deepseek-ai/dsh-llm', () => {
  class BlockAssembler {
    blocks_: any[] = []
    finish_: any = { kind: 'stop' }
    usage_: any = { totalTokens: 7, promptTokens: 3, completionTokens: 4 }
    push(chunk: any) {
      if (chunk && Array.isArray(chunk.blocks)) this.blocks_ = this.blocks_.concat(chunk.blocks)
      if (chunk && chunk.finish) this.finish_ = chunk.finish
    }
    get finish() {
      return this.finish_
    }
    blocks() {
      return this.blocks_
    }
    get usage() {
      return this.usage_
    }
  }
  return {
    BlockAssembler,
    contentHasImage: (blocks: any[]) => Array.isArray(blocks) && blocks.some((b) => b && b.type === 'image'),
    createUserMessage: (m: any) => ({ role: 'user', ...m }),
    LlmError: class LlmError extends Error {
      code?: string
      constructor(msg: string, code?: string) {
        super(msg)
        this.code = code
      }
    },
  }
})

import { proSummarize, resolveProConfig } from '../src/summarize.js'
import type { ProResolvedFull } from '../src/summarize.js'

function makeCtx(chunks: any[]) {
  const ctx: any = {
    llm: {
      stream: async function* (opts: any) {
        ctx.__lastOptions = opts
        for (const c of chunks) yield c
      },
    },
  }
  return ctx
}

function makeAgent(provider = 'prov', model = 'model') {
  return {
    session: {
      id: 'session-1',
      requestHeader: () => ({ config: { provider, model } }),
    },
    options: {},
  } as any
}

const fullConfig: ProResolvedFull = {
  ...resolveProConfig(),
  summarizationProvider: '',
  summarizationModel: '',
  maxTokens: 100,
} as any

const TEXT = (t: string) => ({ type: 'text', text: t })
const oneTextChunk = [{ blocks: [TEXT('SUMMARY TEXT')], finish: { kind: 'stop' } }]

describe('resolveProConfig', () => {
  it('applies all documented defaults', () => {
    const r = resolveProConfig()
    expect(r).toEqual({
      summaryLanguage: 'auto',
      faithful: true,
      recursive: true,
      chunkMessages: 40,
      customInstruction: undefined,
    })
  })

  it('passes through every override', () => {
    const r = resolveProConfig({
      summaryLanguage: 'zh',
      faithful: false,
      recursive: false,
      chunkMessages: 12,
      customInstruction: 'CUSTOM',
    })
    expect(r.summaryLanguage).toBe('zh')
    expect(r.faithful).toBe(false)
    expect(r.recursive).toBe(false)
    expect(r.chunkMessages).toBe(12)
    expect(r.customInstruction).toBe('CUSTOM')
  })
})

describe('proSummarize — single-pass path', () => {
  it('returns a structured SummaryResult from one stream call', async () => {
    const ctx = makeCtx(oneTextChunk)
    const res = await proSummarize(
      ctx as any,
      fullConfig,
      { messages: [{ role: 'user', content: 'hi' }] },
      makeAgent(),
    )
    expect(res.summary).toHaveLength(1)
    expect(res.summary[0]).toMatchObject(TEXT('SUMMARY TEXT'))
    expect(res.llmStreamCall).toBe(true)
    expect(res.provider).toBe('prov')
    expect(res.model).toBe('model')
    expect(res.maxTokens).toBe(100)
    expect(res.usage).toEqual({ totalTokens: 7, promptTokens: 3, completionTokens: 4 })
  })

  it('wires the faithful instruction as the final user message', async () => {
    const ctx = makeCtx(oneTextChunk)
    await proSummarize(
      ctx as any,
      fullConfig,
      { messages: [{ role: 'user', content: 'hi' }] },
      makeAgent(),
    )
    const msgs = ctx.__lastOptions.messages
    const last = msgs[msgs.length - 1]
    expect(last.role).toBe('user')
    expect(last.content[0].text).toContain('Faithfulness rules (MANDATORY)')
    // replayed prefix is preserved ahead of the instruction
    expect(msgs[0]).toMatchObject({ role: 'user', content: 'hi' })
  })

  it('forwards system/tools when present on the input', async () => {
    const ctx = makeCtx(oneTextChunk)
    await proSummarize(
      ctx as any,
      fullConfig,
      {
        system: 'SYS',
        tools: [{ name: 't', inputSchema: {} }] as any,
        messages: [{ role: 'user', content: 'hi' }],
      },
      makeAgent(),
    )
    expect(ctx.__lastOptions.system).toBe('SYS')
    expect(ctx.__lastOptions.tools).toEqual([{ name: 't', inputSchema: {} }])
  })
})

describe('proSummarize — recursive path', () => {
  it('splits into N chunks + 1 merge call when messages exceed chunkMessages', async () => {
    let calls = 0
    const ctx: any = {
      llm: {
        stream: async function* () {
          calls++
          for (const c of oneTextChunk) yield c
        },
      },
    }
    const messages = Array.from({ length: 85 }, (_, i) => ({ role: 'user', content: `m${i}` }))
    const res = await proSummarize(ctx, { ...fullConfig, chunkMessages: 40 }, { messages }, makeAgent())
    // 85 messages / 40 per chunk = 3 chunks + 1 merge = 4 calls
    expect(calls).toBe(4)
    expect(res.summary[0]).toMatchObject(TEXT('SUMMARY TEXT'))
  })

  it('stays single-pass on the boundary (messages == chunkMessages)', async () => {
    let calls = 0
    const ctx: any = {
      llm: {
        stream: async function* () {
          calls++
          for (const c of oneTextChunk) yield c
        },
      },
    }
    const messages = Array.from({ length: 40 }, (_, i) => ({ role: 'user', content: `m${i}` }))
    await proSummarize(ctx, { ...fullConfig, chunkMessages: 40 }, { messages }, makeAgent())
    expect(calls).toBe(1)
  })
})

describe('proSummarize — provider/model resolution', () => {
  it('falls back to the routed model when summarizationProvider/Model are undefined', async () => {
    const ctx = makeCtx(oneTextChunk)
    const res = await proSummarize(
      ctx as any,
      { ...fullConfig, summarizationProvider: undefined, summarizationModel: undefined } as any,
      { messages: [{ role: 'user', content: 'x' }] },
      makeAgent('routed-prov', 'routed-model'),
    )
    expect(res.provider).toBe('routed-prov')
    expect(res.model).toBe('routed-model')
  })
})

describe('proSummarize — failure modes', () => {
  it('throws when the summary contains no text', async () => {
    const ctx = makeCtx([{ blocks: [], finish: { kind: 'stop' } }])
    await expect(
      proSummarize(ctx as any, fullConfig, { messages: [{ role: 'user', content: 'x' }] }, makeAgent()),
    ).rejects.toThrow(/no text summary content/)
  })

  it('throws LlmError when the summary contains an image block', async () => {
    const ctx = makeCtx([{ blocks: [{ type: 'image', url: 'http://x' }], finish: { kind: 'stop' } }])
    await expect(
      proSummarize(ctx as any, fullConfig, { messages: [{ role: 'user', content: 'x' }] }, makeAgent()),
    ).rejects.toThrow(/cannot contain image output/)
  })

  it('propagates a terminal stream error with its code', async () => {
    const ctx = makeCtx([{ blocks: [], finish: { kind: 'error', failure: { message: 'boom', code: 'E1' } } }])
    await expect(
      proSummarize(ctx as any, fullConfig, { messages: [{ role: 'user', content: 'x' }] }, makeAgent()),
    ).rejects.toThrow(/boom/)
  })

  it('throws a helpful error when no provider/model is available', async () => {
    const ctx = makeCtx(oneTextChunk)
    const agent = {
      session: { id: 's', requestHeader: () => undefined },
      options: {},
    } as any
    await expect(
      proSummarize(
        ctx as any,
        { ...fullConfig, summarizationProvider: '', summarizationModel: '' },
        { messages: [{ role: 'user', content: 'x' }] },
        agent,
      ),
    ).rejects.toThrow(/no provider\/model available/)
  })
})
