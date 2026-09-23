import type { WritingActionType, WritingOptions } from './types'

export function buildSystemPrompt(action: WritingActionType, options?: WritingOptions): string {
  const customContext = options?.context ? ` Consider this context: ${options.context}.` : ''
  switch (action) {
    case 'improve':
      return `You are an expert writing assistant in Writin. Improve clarity, phrasing, flow, and vocabulary of the user text. Preserve the original meaning and core facts. Return ONLY the improved text directly with no conversational commentary or quotes.${customContext}`
    case 'fix_grammar':
      return 'You are a meticulous grammar and spell checker. Fix spelling, grammatical errors, punctuation, and typographical mistakes. Keep the original wording and style intact where correct. Return ONLY the corrected text.'
    case 'rewrite':
      return 'You are an editor in Writin. Rewrite the following text to make it engaging, well-structured, and clear while preserving all original facts. Return ONLY the rewritten text with no preamble.'
    case 'shorten':
      return 'You are a concise writing editor. Condense the text by removing redundant words and filler while keeping the essential message and key facts. Return ONLY the concise text.'
    case 'expand':
      return 'You are a writing assistant. Expand the text with logical transitions, clear structure, and expressive elaboration while strictly preserving facts. Return ONLY the expanded text.'
    case 'summarize':
      return 'You are an executive summarizer. Produce a clear, succinct summary of the main points in the provided text. Return ONLY the summary.'
    case 'make_professional':
      return 'You are a business communications expert. Rewrite the text in a polished, confident, professional, and clear tone suitable for work or publication. Return ONLY the revised text.'
    case 'make_casual':
      return 'You are a friendly editor. Rewrite the text in a natural, warm, conversational, and accessible tone while preserving meaning. Return ONLY the revised text.'
    case 'generate_title':
      return 'You are a title generator. Generate a single, concise, compelling title (3 to 8 words) that captures the core theme of the text. Do not use quotes. Return ONLY the title text.'
    default:
      return 'You are a writing assistant. Enhance the following text while preserving facts. Return ONLY the final text.'
  }
}

export function buildUserPrompt(action: WritingActionType, text: string, options?: WritingOptions): string {
  const cleanInput = text.trim()
  const contextNote = options?.context ? `\nContext: ${options.context}` : ''

  switch (action) {
    case 'improve':
      return `Improve this text:\n\n${cleanInput}${contextNote}`
    case 'fix_grammar':
      return `Correct grammar and spelling in this text:\n\n${cleanInput}`
    case 'rewrite':
      return `Rewrite this text clearly:\n\n${cleanInput}${contextNote}`
    case 'shorten':
      return `Make this text shorter and more concise:\n\n${cleanInput}`
    case 'expand':
      return `Elaborate and expand on this text:\n\n${cleanInput}`
    case 'summarize':
      return `Summarize this text:\n\n${cleanInput}`
    case 'make_professional':
      return `Make this text professional and polished:\n\n${cleanInput}`
    case 'make_casual':
      return `Make this text casual and conversational:\n\n${cleanInput}`
    case 'generate_title':
      return `Generate a concise title for this text:\n\n${cleanInput}`
    default:
      return `Process this text:\n\n${cleanInput}`
  }
}

/**
 * Clean model output to strip conversational artifacts like:
 * "Here is the improved text:", quotation marks, code backticks, etc.
 */
export function cleanModelOutput(rawOutput: string, originalText: string): string {
  if (!rawOutput) return originalText

  let text = rawOutput.trim()

  // Remove common AI preambles
  const preambles = [
    /^here('?s| is) (the |a |your )?(improved|rewritten|shortened|expanded|corrected|summarized|revised|professional|casual)?\s*(text|version|summary|title|output)?:\s*/i,
    /^(improved|rewritten|shortened|expanded|corrected|summarized|revised|title):\s*/i,
    /^sure!?,?\s*(here is.+?:\s*)?/i,
  ]

  for (const pattern of preambles) {
    text = text.replace(pattern, '')
  }

  // Remove surrounding quotes if model added them
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith('“') && text.endsWith('”')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim()
  }

  // Remove markdown code fence wrappers if output was wrapped in ```
  if (text.startsWith('```') && text.endsWith('```')) {
    const lines = text.split('\n')
    if (lines.length > 2) {
      text = lines.slice(1, -1).join('\n').trim()
    }
  }

  return text.trim() || originalText
}

/**
 * High-quality deterministic/heuristic writing transformations
 * used for fast instant preview, offline fallbacks, and low-tier devices.
 */
export function heuristicTransform(action: WritingActionType, text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  switch (action) {
    case 'fix_grammar': {
      // Basic common grammar/spelling rule corrections
      let fixed = trimmed
        .replace(/\b(teh|hte)\b/gi, 'the')
        .replace(/\b(dont|cant|wont|isnt|arent|didnt|couldnt|shouldnt|wouldnt)\b/gi, (m) => {
          const dict: Record<string, string> = {
            dont: "don't", cant: "can't", wont: "won't", isnt: "isn't",
            arent: "aren't", didnt: "didn't", couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't"
          }
          return dict[m.toLowerCase()] ?? m
        })
        .replace(/\b(recieve|seperate|definately|occured|untill)\b/gi, (m) => {
          const dict: Record<string, string> = {
            recieve: 'receive', seperate: 'separate', definately: 'definitely', occured: 'occurred', untill: 'until'
          }
          return dict[m.toLowerCase()] ?? m
        })
        .replace(/\s{2,}/g, ' ')
        .replace(/([.!?])\s*([a-z])/g, (_, p1, p2) => `${p1} ${p2.toUpperCase()}`)
      if (/^[a-z]/.test(fixed)) {
        fixed = fixed.charAt(0).toUpperCase() + fixed.slice(1)
      }
      if (!/[.!?]$/.test(fixed) && !fixed.includes('\n')) {
        fixed += '.'
      }
      return fixed
    }

    case 'shorten': {
      // Condense wordy phrases
      const reductions: Array<[RegExp, string]> = [
        [/\bin order to\b/gi, 'to'],
        [/\bdue to the fact that\b/gi, 'because'],
        [/\bat the present time\b/gi, 'currently'],
        [/\bfor the purpose of\b/gi, 'for'],
        [/\bwith regard to\b/gi, 'regarding'],
        [/\bin the event that\b/gi, 'if'],
        [/\butilize\b/gi, 'use'],
        [/\bas a matter of fact\b/gi, 'actually'],
        [/\bneedless to say\b/gi, 'clearly'],
        [/\bvery\s+/gi, ''],
        [/\breally\s+/gi, ''],
      ]
      let condensed = trimmed
      for (const [re, rep] of reductions) {
        condensed = condensed.replace(re, rep)
      }
      return condensed.replace(/\s{2,}/g, ' ')
    }

    case 'make_professional': {
      const formalReplacements: Array<[RegExp, string]> = [
        [/\bkinda\b/gi, 'somewhat'],
        [/\bgonna\b/gi, 'going to'],
        [/\bwanna\b/gi, 'intend to'],
        [/\bgotta\b/gi, 'must'],
        [/\byeah\b/gi, 'yes'],
        [/\bnope\b/gi, 'no'],
        [/\bstuff\b/gi, 'materials'],
        [/\bthings\b/gi, 'elements'],
        [/\blots of\b/gi, 'numerous'],
        [/\ba lot of\b/gi, 'substantial'],
        [/\bcheck out\b/gi, 'review'],
        [/\blook into\b/gi, 'investigate'],
      ]
      let formal = trimmed
      for (const [re, rep] of formalReplacements) {
        formal = formal.replace(re, rep)
      }
      if (/^[a-z]/.test(formal)) formal = formal.charAt(0).toUpperCase() + formal.slice(1)
      return formal
    }

    case 'make_casual': {
      const casualReplacements: Array<[RegExp, string]> = [
        [/\bfurthermore\b/gi, 'also'],
        [/\bconsequently\b/gi, 'so'],
        [/\bnevertheless\b/gi, 'still'],
        [/\butilize\b/gi, 'use'],
        [/\bcommence\b/gi, 'start'],
        [/\bterminate\b/gi, 'end'],
        [/\bin accordance with\b/gi, 'based on'],
      ]
      let casual = trimmed
      for (const [re, rep] of casualReplacements) {
        casual = casual.replace(re, rep)
      }
      return casual
    }

    case 'generate_title': {
      const firstSentence = trimmed.split(/[.!?\n]/)[0] ?? trimmed
      const words = firstSentence.replace(/[^\w\s]/g, '').split(/\s+/).slice(0, 6)
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    }

    case 'summarize': {
      const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean)
      if (sentences.length <= 2) return trimmed
      return `${sentences[0]} ${sentences[sentences.length - 1]}`
    }

    case 'expand': {
      return `${trimmed}\n\nKey considerations and next steps should be outlined to ensure complete clarity and actionable follow-through.`
    }

    case 'improve':
    case 'rewrite':
    default: {
      let improved = trimmed
        .replace(/\b(teh|hte)\b/gi, 'the')
        .replace(/\s{2,}/g, ' ')
      if (/^[a-z]/.test(improved)) {
        improved = improved.charAt(0).toUpperCase() + improved.slice(1)
      }
      return improved
    }
  }
}
