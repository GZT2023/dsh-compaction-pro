import { describe, it, expect } from 'vitest'
import {
  buildInstruction,
  partialInstruction,
  mergeInstruction,
} from '../src/prompt.js'
import type { ResolvedProConfig } from '../src/summarize.js'

const base: ResolvedProConfig = {
  summaryLanguage: 'auto',
  faithful: true,
  recursive: true,
  chunkMessages: 40,
}

describe('buildInstruction', () => {
  it('emits the full canonical section structure in order', () => {
    const out = buildInstruction(base)
    const sections = [
      '## Primary Request and Intent',
      '## Key Technical Concepts',
      '## Files and Code',
      '## Decisions and Rationale',
      '## Errors and Fixes',
      '## Tool Outputs (key)',
      '## Pending Jobs',
      '## Current Work',
      '## Next Step',
      '## Open Questions / Risks',
      '## Critical Context',
    ]
    // every section present
    for (const s of sections) expect(out).toContain(s)
    // and they appear in the declared order
    const idx = sections.map((s) => out.indexOf(s))
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThan(idx[i - 1])
  })

  it('includes the mandatory faithfulness rules when faithful=true', () => {
    const out = buildInstruction({ ...base, faithful: true })
    expect(out).toContain('Faithfulness rules (MANDATORY)')
    expect(out).toContain('Preserve EXACT values')
    expect(out.toLowerCase()).toContain('do not translate or localize them')
  })

  it('omits the faithfulness rules when faithful=false', () => {
    const out = buildInstruction({ ...base, faithful: false })
    expect(out).not.toContain('Faithfulness rules (MANDATORY)')
    expect(out).not.toContain('Preserve EXACT values')
  })

  it('returns the custom instruction verbatim when non-empty', () => {
    const custom = 'USE THIS EXACT DIRECTIVE'
    const out = buildInstruction({ ...base, customInstruction: custom })
    expect(out).toBe(custom)
  })

  it('falls back to the default template when customInstruction is only whitespace', () => {
    const out = buildInstruction({ ...base, customInstruction: '   \n\t  ' })
    expect(out).toContain('## Primary Request and Intent')
    expect(out).not.toContain('USE THIS')
  })

  it('selects Simplified-Chinese guidance for summaryLanguage=zh', () => {
    const out = buildInstruction({ ...base, summaryLanguage: 'zh' })
    expect(out).toContain('简体中文')
    // identifiers/paths/numbers must stay verbatim even in zh mode
    expect(out).toContain('do not translate them')
  })

  it('selects English guidance for summaryLanguage=en', () => {
    const out = buildInstruction({ ...base, summaryLanguage: 'en' })
    expect(out).toContain('Write the summary in English.')
  })

  it('selects conversation-following guidance for summaryLanguage=auto', () => {
    const out = buildInstruction({ ...base, summaryLanguage: 'auto' })
    expect(out).toContain("Match the conversation's language")
  })
})

describe('partialInstruction', () => {
  it('asks for a terse factual digest and carries language guidance', () => {
    const out = partialInstruction(base)
    expect(out).toContain('concise factual digest')
    expect(out).toContain('Preserve exact identifiers')
    expect(out).toContain("Match the conversation's language")
  })
})

describe('mergeInstruction', () => {
  it('inlines every partial digest, preserving order', () => {
    const out = mergeInstruction(base, ['D1', 'D2', 'D3'])
    expect(out).toContain('D1')
    expect(out).toContain('D2')
    expect(out).toContain('D3')
    expect(out.indexOf('D1')).toBeLessThan(out.indexOf('D2'))
    expect(out.indexOf('D2')).toBeLessThan(out.indexOf('D3'))
  })

  it('requests the standard section structure and dedupes', () => {
    const out = mergeInstruction(base, ['x'])
    expect(out).toContain('Primary Request and Intent')
    expect(out).toContain('Critical Context')
    expect(out).toContain('dedupe')
  })
})
