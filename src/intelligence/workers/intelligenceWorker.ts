import { pipeline, env, type ProgressCallback } from '@huggingface/transformers'
import { buildSystemPrompt, buildUserPrompt, cleanModelOutput, heuristicTransform } from '../prompts'
import type { WorkerRequest, WorkerResponse } from '../types'

// Configure browser-side Transformers.js
env.allowLocalModels = false
env.useBrowserCache = true

type PipelineFn = (input: unknown, options?: Record<string, unknown>) => Promise<unknown>

// Cached pipelines in the worker thread
let textPipeline: PipelineFn | null = null
let textModelLoadedId = ''
let embedPipeline: PipelineFn | null = null
let embedModelLoadedId = ''

function postProgress(status: 'preparing' | 'downloading' | 'loading' | 'ready' | 'error', progress?: number, message?: string, modelId?: string) {
  const response: WorkerResponse = {
    type: 'MODEL_PROGRESS',
    payload: {
      status,
      progress,
      message,
      modelId,
    },
  }
  self.postMessage(response)
}

function makeProgressCallback(modelId: string): ProgressCallback {
  return (info: { status?: string; file?: string; progress?: number }) => {
    if (info.status === 'initiate') {
      postProgress('preparing', 0, `Preparing ${info.file || modelId}...`, modelId)
    } else if (info.status === 'download' || info.status === 'progress') {
      const pct = typeof info.progress === 'number' ? Math.round(info.progress) : 0
      postProgress('downloading', pct, `Downloading ${info.file || 'model components'} (${pct}%)`, modelId)
    } else if (info.status === 'loading') {
      postProgress('loading', 95, 'Loading model into memory...', modelId)
    } else if (info.status === 'done') {
      postProgress('loading', 100, `Ready: ${info.file || modelId}`, modelId)
    }
  }
}

async function loadTextPipeline(modelId: string): Promise<PipelineFn> {
  if (textPipeline && textModelLoadedId === modelId) return textPipeline
  postProgress('preparing', 0, `Initializing ${modelId}...`, modelId)
  try {
    const isFlan = modelId.includes('Flan') || modelId.includes('T5') || modelId.includes('t5')
    const task = isFlan ? 'text2text-generation' : 'text-generation'

    const pipe = await pipeline(task as unknown as 'text-generation', modelId, {
      progress_callback: makeProgressCallback(modelId),
      dtype: 'q4',
      device: 'webgpu' in navigator ? 'webgpu' : 'wasm',
    })
    textPipeline = pipe as unknown as PipelineFn
    textModelLoadedId = modelId
    postProgress('ready', 100, 'Model ready for local inference', modelId)
    return textPipeline
  } catch (err) {
    postProgress('error', undefined, `Failed to load text model: ${err instanceof Error ? err.message : String(err)}`, modelId)
    throw err
  }
}

async function loadEmbedPipeline(modelId: string): Promise<PipelineFn> {
  if (embedPipeline && embedModelLoadedId === modelId) return embedPipeline
  postProgress('preparing', 0, `Initializing ${modelId}...`, modelId)
  try {
    const pipe = await pipeline('feature-extraction', modelId, {
      progress_callback: makeProgressCallback(modelId),
      dtype: 'q8',
    })
    embedPipeline = pipe as unknown as PipelineFn
    embedModelLoadedId = modelId
    postProgress('ready', 100, 'Embedding model ready', modelId)
    return embedPipeline
  } catch (err) {
    postProgress('error', undefined, `Failed to load embedding model: ${err instanceof Error ? err.message : String(err)}`, modelId)
    throw err
  }
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data
  if (!req || !req.type) return

  try {
    switch (req.type) {
      case 'LOAD_MODEL': {
        const { modelId, task } = req.payload
        if (task === 'embed') {
          await loadEmbedPipeline(modelId)
        } else {
          await loadTextPipeline(modelId)
        }
        break
      }

      case 'RUN_WRITING': {
        const { id, action, text, options } = req.payload
        const start = performance.now()
        let resultText = ''
        let modelUsed = textModelLoadedId || 'local-heuristics'

        try {
          if (textPipeline) {
            const systemPrompt = buildSystemPrompt(action, options)
            const userPrompt = buildUserPrompt(action, text, options)

            // For chat/instruct models
            const messages = [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ]

            const maxNewTokens = Math.min(512, Math.max(64, Math.round(text.length * 1.5)))

            const output = await textPipeline(messages, {
              max_new_tokens: maxNewTokens,
              temperature: 0.3,
              top_p: 0.9,
              repetition_penalty: 1.1,
            })

            let generated = ''
            if (Array.isArray(output) && output[0]?.generated_text) {
              const gen = output[0].generated_text
              if (Array.isArray(gen)) {
                generated = gen[gen.length - 1]?.content ?? ''
              } else if (typeof gen === 'string') {
                generated = gen
              }
            } else if (typeof output === 'string') {
              generated = output
            }

            resultText = cleanModelOutput(generated, text)
          } else {
            // Fast zero-latency heuristic transformation
            resultText = heuristicTransform(action, text)
            modelUsed = 'rule-based-fast'
          }
        } catch {
          // Graceful fallback to heuristic transform
          resultText = heuristicTransform(action, text)
          modelUsed = 'rule-based-fallback'
        }

        const durationMs = Math.round(performance.now() - start)
        const res: WorkerResponse = {
          type: 'WRITING_SUCCESS',
          payload: {
            id,
            transformedText: resultText,
            durationMs,
            modelUsed,
          },
        }
        self.postMessage(res)
        break
      }

      case 'RUN_EMBED': {
        const { id, text } = req.payload
        const start = performance.now()
        let embedding: number[] = []

        try {
          const pipe = embedPipeline || (await loadEmbedPipeline('Xenova/all-MiniLM-L6-v2'))
          const output = (await pipe(text, { pooling: 'mean', normalize: true })) as { data: Float32Array }
          embedding = Array.from(output.data)
        } catch {
          // Fallback pseudo-embedding based on token hashes
          embedding = new Array(384).fill(0)
          for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i)
            const idx = (code * 17 + i * 31) % 384
            const curr = embedding[idx] ?? 0
            embedding[idx] = curr + 1
          }
          const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)) || 1
          embedding = embedding.map((v) => v / mag)
        }

        const durationMs = Math.round(performance.now() - start)
        const res: WorkerResponse = {
          type: 'EMBED_SUCCESS',
          payload: {
            id,
            embedding,
            durationMs,
          },
        }
        self.postMessage(res)
        break
      }

      case 'RUN_CLASSIFY': {
        const { id, text, candidateLabels } = req.payload
        const start = performance.now()

        // Fast zero-shot keyword/embedding-based scoring
        const scores: Array<{ category: string; score: number }> = candidateLabels.map((cat) => {
          const lower = text.toLowerCase()
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
          return { category: cat, score: Math.min(0.99, score) }
        })

        // Normalize scores
        const total = scores.reduce((sum, item) => sum + item.score, 0)
        const normalized = scores
          .map((item) => ({ ...item, score: Number((item.score / total).toFixed(3)) }))
          .sort((a, b) => b.score - a.score)

        const top = normalized[0] ?? { category: 'Note', score: 0.5 }
        const durationMs = Math.round(performance.now() - start)

        const res: WorkerResponse = {
          type: 'CLASSIFY_SUCCESS',
          payload: {
            id,
            result: {
              text,
              predictedCategory: top.category,
              confidence: top.score,
              allScores: normalized,
              durationMs,
            },
          },
        }
        self.postMessage(res)
        break
      }
    }
  } catch (err) {
    const res: WorkerResponse = {
      type: 'ERROR',
      payload: {
        message: err instanceof Error ? err.message : String(err),
      },
    }
    self.postMessage(res)
  }
})
