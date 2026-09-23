import { DEFAULT_CATEGORIES } from './config'
import { modelLoader } from './modelLoader'
import type { ClassificationResult, WorkerRequest } from './types'

export class ClassificationEngine {
  public async classify(
    text: string,
    candidateCategories: string[] = [...DEFAULT_CATEGORIES]
  ): Promise<ClassificationResult> {
    const trimmed = text.trim()
    if (!trimmed) {
      return {
        text,
        predictedCategory: 'Other',
        confidence: 0,
        allScores: candidateCategories.map((c) => ({ category: c, score: 0 })),
        durationMs: 0,
      }
    }

    const requestId = `classify_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const start = performance.now()

    try {
      const worker = modelLoader.getOrCreateWorker()
      if (!worker) {
        throw new Error('Worker unavailable')
      }

      const req: WorkerRequest = {
        type: 'RUN_CLASSIFY',
        payload: {
          id: requestId,
          text: trimmed,
          candidateLabels: candidateCategories,
        },
      }

      const res = await modelLoader.sendRequest<{ result: ClassificationResult }>(req, requestId)
      return res.result
    } catch {
      // Heuristic category scoring fallback
      const lower = trimmed.toLowerCase()
      const scores = candidateCategories.map((cat) => {
        let score = 0.1
        const catLower = cat.toLowerCase()
        if (catLower === 'task' || catLower === 'to-do') {
          if (/todo|task|deadline|due|fix|assign|action item|must|should|priority|\[\s*\]/i.test(lower)) score += 0.8
        } else if (catLower === 'meeting') {
          if (/meeting|agenda|sync|discussion|attendees|call|minutes|zoom|standup/i.test(lower)) score += 0.85
        } else if (catLower === 'idea') {
          if (/idea|concept|brainstorm|proposal|vision|future|what if|innovate/i.test(lower)) score += 0.8
        } else if (catLower === 'journal') {
          if (/today|journal|reflect|felt|feeling|personal|diary|grateful|morning/i.test(lower)) score += 0.85
        } else if (catLower === 'reference') {
          if (/reference|doc|guide|manual|link|url|api|documentation|spec|cheat sheet/i.test(lower)) score += 0.75
        } else if (catLower === 'note') {
          score += 0.4
        } else {
          score += 0.15
        }
        return { category: cat, score }
      })

      const total = scores.reduce((s, c) => s + c.score, 0)
      const normalized = scores
        .map((c) => ({ category: c.category, score: Number((c.score / total).toFixed(3)) }))
        .sort((a, b) => b.score - a.score)

      const top = normalized[0] ?? { category: 'Note', score: 0.5 }
      const durationMs = Math.round(performance.now() - start)

      return {
        text: trimmed,
        predictedCategory: top.category,
        confidence: top.score,
        allScores: normalized,
        durationMs,
      }
    }
  }
}

export const classificationEngine = new ClassificationEngine()
