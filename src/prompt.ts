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

import type { ResolvedProConfig } from './summarize.js'

/** Instruction fragment selecting the output language. */
function languageGuidance(cfg: ResolvedProConfig): string {
  switch (cfg.summaryLanguage) {
    case 'zh':
      return 'Write the summary in Chinese (简体中文). Keep code, identifiers, file paths, and numbers exactly as they appear — do not translate them.'
    case 'en':
      return 'Write the summary in English.'
    default:
      return "Match the conversation's language: if the user wrote mainly in Chinese, write the summary in Chinese (keeping code/identifiers/paths/numbers verbatim); if mainly English, write in English."
  }
}

/** The single canonical section block shared by every structured summary. */
const SECTIONS = [
  '## Primary Request and Intent',
  '- [user\'s original and evolving goals; quote verbatim where exact wording matters]',
  '',
  '## Key Technical Concepts',
  '- [technologies, frameworks, patterns, conventions in play]',
  '',
  '## Files and Code',
  '- [exact path: why it matters, key changes or snippets]',
  '',
  '## Decisions and Rationale',
  '- [every non-trivial decision AND why it was made; include rejected alternatives when recorded]',
  '',
  '## Errors and Fixes',
  '- [error string: root cause + how resolved; include user feedback/corrections]',
  '',
  '## Tool Outputs (key)',
  '- [key tool results worth keeping: returned data shapes, important returned values, file contents snippets]',
  '',
  '## Pending Jobs',
  '- [explicitly requested work not yet done]',
  '',
  '## Current Work',
  '- [precisely what was in progress at this checkpoint]',
  '',
  '## Next Step',
  '- [single next action aligned with the most recent request, or "(none)"]',
  '',
  '## Open Questions / Risks',
  '- [unresolved issues, ambiguities, blockers, things to verify]',
  '',
  '## Critical Context',
  '- [constraints, user preferences, environment facts, data needed to continue]',
].join('\n')

/** Mandatory faithfulness rules — the core differentiator vs basic. */
const FAITHFULNESS_RULES = [
  'Faithfulness rules (MANDATORY):',
  '- Preserve EXACT values: numbers, file paths, command strings, error messages, identifiers, API endpoints, version strings. Never round, approximate, or "clean up" numeric/identifier data.',
  '- Quote user instructions verbatim where the exact wording matters.',
  '- Keep code, symbols, and identifiers unchanged. Do not translate or localize them.',
  '- If the conversation already contains a <compacted-summary> block, it is a PRIOR checkpoint: preserve still-true facts, drop stale ones, merge newer information into ONE consolidated summary under this same structure. Do not copy it forward verbatim.',
].join('\n')

/**
 * Build the main compaction directive delivered as the final user message.
 * @param cfg - resolved pro configuration (language / faithfulness / custom).
 * @returns the instruction string appended after the replayed conversation.
 */
export function buildInstruction(cfg: ResolvedProConfig): string {
  // A custom instruction fully replaces the built-in prompt (power users).
  if (cfg.customInstruction !== undefined && cfg.customInstruction.trim().length > 0) {
    return cfg.customInstruction
  }

  const lang = languageGuidance(cfg)
  const faithful = cfg.faithful ? `\n${FAITHFULNESS_RULES}` : ''

  return [
    'You are a high-fidelity compaction engine for an AI coding/quant assistant. '
    + 'Condense the conversation ABOVE into a structured checkpoint that lets another model resume the work with NO loss of essential context and NO corruption of exact data.',
    '',
    `Output EXACTLY this Markdown structure, in order. Use terse bullets, not prose. Write "(none)" for an empty section — never drop a section.`,
    '',
    SECTIONS,
    faithful,
    '',
    'Language rules:',
    `- ${lang}`,
    '- Do NOT mention this summarization request or that the context was compacted.',
    '- Output only the checkpoint text.',
  ].join('\n')
}

/**
 * Instruction for a single chunk during recursive (pre-)summarization.
 * Produces a terse factual digest, not the full structure.
 */
export function partialInstruction(cfg: ResolvedProConfig): string {
  const lang = languageGuidance(cfg)
  return [
    'Summarize the conversation segment ABOVE into a concise factual digest (terse bullets).',
    '- Preserve exact identifiers, file paths, numbers, commands, and error strings.',
    '- Do not drop tool results or decisions.',
    `- ${lang}`,
    '- Output only the digest text.',
  ].join('\n')
}

/**
 * Instruction that folds chunk digests back into the canonical structure.
 * @param cfg - resolved pro configuration.
 * @param partials - ordered chunk digests.
 * @returns the merge directive with digests inlined.
 */
export function mergeInstruction(cfg: ResolvedProConfig, partials: string[]): string {
  const lang = languageGuidance(cfg)
  return [
    'The following are partial digests of an earlier conversation, in order.',
    'Merge them into ONE structured checkpoint using the standard sections '
    + '(Primary Request and Intent / Key Technical Concepts / Files and Code / '
    + 'Decisions and Rationale / Errors and Fixes / Tool Outputs / Pending Jobs / '
    + 'Current Work / Next Step / Open Questions / Critical Context).',
    '- Preserve all exact values and dedupe.',
    `- ${lang}`,
    '- Output only the checkpoint text.',
    '---',
    partials.join('\n\n---\n\n'),
  ].join('\n')
}
