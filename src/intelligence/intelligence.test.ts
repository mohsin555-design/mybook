import { describe, it, expect } from 'vitest'
import {
  dotProduct,
  cosineSimilarity,
  normalizeVector,
} from './utils/vectorMath'
import {
  buildSystemPrompt,
  buildUserPrompt,
  cleanModelOutput,
  heuristicTransform,
} from './prompts'
import {
  ocrTextToStructuredMarkdown,
  convertOcrTextToBlocks,
} from './utils/blockConverter'
import { detectDeviceCapability, checkOfflineModelCache } from './capabilityDetection'
import { writingEngine } from './writingEngine'
import { embeddingEngine } from './embeddingEngine'
import { classificationEngine } from './classificationEngine'
import { MODEL_CATALOG, DEFAULT_TEXT_MODEL } from './config'

describe('Vector Math Utilities', () => {
  it('computes dot product accurately', () => {
    expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32)
    expect(dotProduct([0, 0], [1, 1])).toBe(0)
  })

  it('computes cosine similarity accurately', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0)
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0)
    expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBeCloseTo(-1.0)
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0)
  })

  it('normalizes vector to unit length', () => {
    const norm = normalizeVector([3, 4])
    expect(norm[0]).toBeCloseTo(0.6)
    expect(norm[1]).toBeCloseTo(0.8)
    expect(normalizeVector([0, 0])).toEqual([0, 0])
  })
})

describe('Prompt Construction & Output Cleaning', () => {
  it('builds system prompts for all action types', () => {
    const actions = [
      'improve',
      'fix_grammar',
      'rewrite',
      'shorten',
      'expand',
      'summarize',
      'make_professional',
      'make_casual',
      'generate_title',
    ] as const

    actions.forEach((act) => {
      const prompt = buildSystemPrompt(act)
      expect(prompt).toBeTruthy()
      expect(typeof prompt).toBe('string')
    })
  })

  it('builds user prompts with context if provided', () => {
    const promptWithContext = buildUserPrompt('improve', 'Hello world', { context: 'Formal letter' })
    expect(promptWithContext).toContain('Hello world')
    expect(promptWithContext).toContain('Context: Formal letter')

    const simplePrompt = buildUserPrompt('fix_grammar', 'Teh test')
    expect(simplePrompt).toContain('Teh test')
  })

  it('cleans conversational preambles and quotes from model outputs', () => {
    expect(cleanModelOutput('Here is the improved text: Clean result.', 'orig')).toBe('Clean result.')
    expect(cleanModelOutput('Improved: Better wording.', 'orig')).toBe('Better wording.')
    expect(cleanModelOutput('"Quoted text without outer quotes"', 'orig')).toBe('Quoted text without outer quotes')
    expect(cleanModelOutput('```\nFenced output\n```', 'orig')).toBe('Fenced output')
    expect(cleanModelOutput('', 'fallback text')).toBe('fallback text')
  })

  it('executes heuristic writing transforms reliably', () => {
    // Grammar
    expect(heuristicTransform('fix_grammar', 'teh test was seperate and definately dont fail')).toContain('The test')
    expect(heuristicTransform('fix_grammar', 'teh test was seperate and definately dont fail')).toContain("don't")

    // Shorten
    expect(heuristicTransform('shorten', 'in order to test due to the fact that it works')).toBe('to test because it works')

    // Professional
    expect(heuristicTransform('make_professional', 'we gotta check out this stuff')).toContain('must')
    expect(heuristicTransform('make_professional', 'we gotta check out this stuff')).toContain('materials')

    // Casual
    expect(heuristicTransform('make_casual', 'furthermore we shall commence')).toContain('also')
    expect(heuristicTransform('make_casual', 'furthermore we shall commence')).toContain('start')

    // Title
    expect(heuristicTransform('generate_title', 'Zero-cost local artificial intelligence architecture')).toBeTruthy()

    // Summarize
    expect(heuristicTransform('summarize', 'First sentence. Middle sentence. Last sentence.')).toContain('First sentence.')
  })
})

describe('OCR to Block Conversion', () => {
  it('converts plain OCR text and lists to markdown', () => {
    const raw = `Meeting Notes
• First bullet item
• Second bullet item
1. Numbered step one
2. Numbered step two
[x] Finished task
[ ] Pending task`

    const md = ocrTextToStructuredMarkdown(raw)
    expect(md).toContain('- First bullet item')
    expect(md).toContain('1. Numbered step one')
    expect(md).toContain('- [x] Finished task')
    expect(md).toContain('- [ ] Pending task')
  })

  it('converts OCR markdown into Writin block JSON content', () => {
    const raw = `# Title Heading
This is a standard paragraph.
- Bullet item A
- Bullet item B`

    const blocks = convertOcrTextToBlocks(raw)
    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    expect(blocks.some((b) => b.type === 'heading')).toBe(true)
    expect(blocks.some((b) => b.type === 'bulletList')).toBe(true)
  })
})

describe('Capability Detection', () => {
  it('detects capability safely without crashing in test environment', async () => {
    const cap = await detectDeviceCapability(true)
    expect(cap).toBeDefined()
    expect(typeof cap.hasWebGpu).toBe('boolean')
    expect(typeof cap.hasWasm).toBe('boolean')
    expect(['high', 'medium', 'low']).toContain(cap.tier)
    expect(cap.hardwareConcurrency).toBeGreaterThanOrEqual(1)
  })

  it('handles offline cache check gracefully', async () => {
    const cached = await checkOfflineModelCache('test-model')
    expect(typeof cached).toBe('boolean')
  })
})

describe('Writing Engine API', () => {
  it('returns empty transform for empty input', async () => {
    const res = await writingEngine.improve('   ')
    expect(res.transformedText).toBe('')
    expect(res.durationMs).toBe(0)
  })

  it('performs writing transformations across all actions', async () => {
    const text = 'In order to make things better we gotta utilize this method.'

    const improved = await writingEngine.improve(text)
    expect(improved.transformedText).toBeTruthy()
    expect(improved.action).toBe('improve')

    const shortened = await writingEngine.shorten(text)
    expect(shortened.transformedText.length).toBeLessThanOrEqual(text.length + 10)
    expect(shortened.action).toBe('shorten')

    const prof = await writingEngine.makeProfessional('we gotta check out this stuff')
    expect(prof.transformedText).toContain('must')

    const casual = await writingEngine.makeCasual('furthermore we commence')
    expect(casual.transformedText).toContain('also')

    const title = await writingEngine.generateTitle(text)
    expect(title.transformedText.split(' ').length).toBeLessThanOrEqual(8)
  })
})

describe('Embedding & Classification Engines', () => {
  it('generates local embeddings and ranks related notes', async () => {
    const corpus = [
      { id: '1', title: 'WebGPU Architecture', category: 'Tech', content: 'Using WebGPU shaders for on-device acceleration' },
      { id: '2', title: 'Fruit Salad Recipe', category: 'Food', content: 'Apples, oranges, and fresh berries mixed with honey' },
    ]

    const matches = await embeddingEngine.findRelatedNotes('WebGPU compute performance', corpus)
    expect(matches.length).toBe(2)
    expect(matches[0]?.note.id).toBe('1')
    expect(matches[0]?.similarity).toBeGreaterThan(matches[1]?.similarity ?? 0)
  })

  it('classifies text into appropriate categories', async () => {
    const taskResult = await classificationEngine.classify('TODO: fix the failing unit test before 5pm deadline')
    expect(taskResult.predictedCategory).toBe('Task')
    expect(taskResult.confidence).toBeGreaterThan(0.3)

    const meetingResult = await classificationEngine.classify('Weekly sync agenda and meeting attendees')
    expect(meetingResult.predictedCategory).toBe('Meeting')

    const ideaResult = await classificationEngine.classify('Brainstorming a novel concept and vision for the product')
    expect(ideaResult.predictedCategory).toBe('Idea')
  })
})

describe('Model Catalog & Config', () => {
  it('contains valid default models and metadata', () => {
    expect(MODEL_CATALOG[DEFAULT_TEXT_MODEL]).toBeDefined()
    expect(MODEL_CATALOG[DEFAULT_TEXT_MODEL]?.approxSizeMb).toBeGreaterThan(0)
    expect(MODEL_CATALOG[DEFAULT_TEXT_MODEL]?.license).toBeTruthy()
  })
})
