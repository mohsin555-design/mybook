import { modelLoader } from './modelLoader'
import { cosineSimilarity } from './utils/vectorMath'
import type { EmbeddingResult, NoteItem, SemanticMatch, WorkerRequest } from './types'

export class EmbeddingEngine {
  private embeddingCache: Map<string, number[]> = new Map()

  public async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const trimmed = text.trim()
    if (!trimmed) {
      return {
        text,
        embedding: new Array(384).fill(0),
        durationMs: 0,
      }
    }

    // Check in-memory cache
    const cached = this.embeddingCache.get(trimmed)
    if (cached) {
      return {
        text: trimmed,
        embedding: cached,
        durationMs: 1,
      }
    }

    const requestId = `embed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const start = performance.now()

    try {
      const worker = modelLoader.getOrCreateWorker()
      if (!worker) {
        throw new Error('Worker unavailable')
      }

      const req: WorkerRequest = {
        type: 'RUN_EMBED',
        payload: {
          id: requestId,
          text: trimmed,
        },
      }

      const res = await modelLoader.sendRequest<{ embedding: number[]; durationMs: number }>(req, requestId)
      this.embeddingCache.set(trimmed, res.embedding)

      return {
        text: trimmed,
        embedding: res.embedding,
        durationMs: res.durationMs,
      }
    } catch {
      // Deterministic fallback embedding based on token hashes
      const embedding = new Array(384).fill(0)
      for (let i = 0; i < trimmed.length; i++) {
        const code = trimmed.charCodeAt(i)
        const idx = (code * 19 + i * 37) % 384
        embedding[idx] += 1
      }
      const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)) || 1
      const normalized = embedding.map((v) => v / mag)

      const durationMs = Math.round(performance.now() - start)
      this.embeddingCache.set(trimmed, normalized)

      return {
        text: trimmed,
        embedding: normalized,
        durationMs,
      }
    }
  }

  public async findRelatedNotes(query: string, corpus: NoteItem[]): Promise<SemanticMatch[]> {
    if (!query.trim() || corpus.length === 0) return []

    const queryEmbedding = await this.generateEmbedding(query)
    const matches: SemanticMatch[] = []

    for (const note of corpus) {
      const noteText = `${note.title}\n${note.content}`
      const noteEmbedding = await this.generateEmbedding(noteText)
      const similarity = cosineSimilarity(queryEmbedding.embedding, noteEmbedding.embedding)
      matches.push({
        note,
        similarity: Number(similarity.toFixed(4)),
      })
    }

    return matches.sort((a, b) => b.similarity - a.similarity)
  }
}

export const embeddingEngine = new EmbeddingEngine()
