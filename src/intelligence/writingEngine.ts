import { modelLoader } from './modelLoader'
import { heuristicTransform } from './prompts'
import type { WritingActionType, WritingOptions, WritingResult, WorkerRequest } from './types'

export class WritingEngine {
  private async executeAction(action: WritingActionType, text: string, options?: WritingOptions): Promise<WritingResult> {
    const trimmed = text.trim()
    if (!trimmed) {
      return {
        originalText: text,
        transformedText: '',
        action,
        durationMs: 0,
        modelUsed: 'none',
      }
    }

    const requestId = `writing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const start = performance.now()

    try {
      const worker = modelLoader.getOrCreateWorker()
      if (!worker) {
        // Fallback to local heuristic transformation
        const transformedText = heuristicTransform(action, trimmed)
        const durationMs = Math.round(performance.now() - start)
        return {
          originalText: text,
          transformedText,
          action,
          durationMs,
          modelUsed: 'heuristic-fast',
          isFallback: true,
        }
      }

      const req: WorkerRequest = {
        type: 'RUN_WRITING',
        payload: {
          id: requestId,
          action,
          text: trimmed,
          options,
        },
      }

      const res = await modelLoader.sendRequest<{
        transformedText: string
        durationMs: number
        modelUsed: string
      }>(req, requestId)

      return {
        originalText: text,
        transformedText: res.transformedText,
        action,
        durationMs: res.durationMs,
        modelUsed: res.modelUsed,
      }
    } catch {
      // Graceful fallback to heuristic transform
      const transformedText = heuristicTransform(action, trimmed)
      const durationMs = Math.round(performance.now() - start)
      return {
        originalText: text,
        transformedText,
        action,
        durationMs,
        modelUsed: 'heuristic-fallback',
        isFallback: true,
      }
    }
  }

  public async improve(text: string, options?: WritingOptions): Promise<WritingResult> {
    return this.executeAction('improve', text, options)
  }

  public async fixGrammar(text: string): Promise<WritingResult> {
    return this.executeAction('fix_grammar', text)
  }

  public async rewrite(text: string, options?: WritingOptions): Promise<WritingResult> {
    return this.executeAction('rewrite', text, options)
  }

  public async shorten(text: string): Promise<WritingResult> {
    return this.executeAction('shorten', text)
  }

  public async expand(text: string): Promise<WritingResult> {
    return this.executeAction('expand', text)
  }

  public async summarize(text: string): Promise<WritingResult> {
    return this.executeAction('summarize', text)
  }

  public async changeTone(text: string, tone: 'professional' | 'casual'): Promise<WritingResult> {
    const action = tone === 'professional' ? 'make_professional' : 'make_casual'
    return this.executeAction(action, text)
  }

  public async makeProfessional(text: string): Promise<WritingResult> {
    return this.executeAction('make_professional', text)
  }

  public async makeCasual(text: string): Promise<WritingResult> {
    return this.executeAction('make_casual', text)
  }

  public async generateTitle(text: string): Promise<WritingResult> {
    return this.executeAction('generate_title', text)
  }
}

export const writingEngine = new WritingEngine()
