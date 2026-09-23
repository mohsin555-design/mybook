import type { JSONContent } from '@tiptap/core'

export type WritingActionType =
  | 'improve'
  | 'fix_grammar'
  | 'rewrite'
  | 'shorten'
  | 'expand'
  | 'summarize'
  | 'make_professional'
  | 'make_casual'
  | 'generate_title'

export type ModelLoadStatus =
  | 'idle'
  | 'preparing'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'error'

export interface ModelProgressInfo {
  status: ModelLoadStatus
  progress?: number // 0 to 100
  loadedBytes?: number
  totalBytes?: number
  message?: string
  modelId?: string
}

export interface DeviceCapability {
  hasWebGpu: boolean
  hasWasm: boolean
  tier: 'high' | 'medium' | 'low'
  hardwareConcurrency: number
  deviceMemoryGb?: number
  isOnline: boolean
  isSupported: boolean
  browserEnv: string
  notes: string[]
}

export interface WritingOptions {
  tone?: 'professional' | 'casual' | 'concise' | 'creative'
  format?: 'paragraph' | 'bullet' | 'title'
  targetLength?: 'shorter' | 'longer' | 'similar'
  context?: string
}

export interface WritingResult {
  originalText: string
  transformedText: string
  action: WritingActionType
  durationMs: number
  modelUsed: string
  isFallback?: boolean
}

export interface ClassificationCategory {
  category: string
  score: number
  description?: string
}

export interface ClassificationResult {
  text: string
  predictedCategory: string
  confidence: number
  allScores: ClassificationCategory[]
  durationMs: number
}

export interface NoteItem {
  id: string
  title: string
  category: string
  content: string
}

export interface SemanticMatch {
  note: NoteItem
  similarity: number // 0 to 1
}

export interface EmbeddingResult {
  text: string
  embedding: number[]
  durationMs: number
}

export interface OcrResult {
  rawText: string
  confidence: number
  lines: string[]
  formattedBlocks: JSONContent[]
  durationMs: number
  imagePreviewUrl?: string
}

export interface DiagnosticsInfo {
  capability: DeviceCapability
  activeModel: string
  modelStatus: ModelLoadStatus
  modelSizeApprox: string
  lastInferenceDurationMs: number | null
  lastAction: string | null
  offlineCached: boolean
  errorMessage: string | null
  logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }>
}

// Worker message protocol
export type WorkerRequest =
  | { type: 'LOAD_MODEL'; payload: { modelId: string; task: 'text' | 'embed' } }
  | { type: 'RUN_WRITING'; payload: { id: string; action: WritingActionType; text: string; options?: WritingOptions } }
  | { type: 'RUN_EMBED'; payload: { id: string; text: string } }
  | { type: 'RUN_CLASSIFY'; payload: { id: string; text: string; candidateLabels: string[] } }

export type WorkerResponse =
  | { type: 'MODEL_PROGRESS'; payload: ModelProgressInfo }
  | { type: 'WRITING_SUCCESS'; payload: { id: string; transformedText: string; durationMs: number; modelUsed: string } }
  | { type: 'EMBED_SUCCESS'; payload: { id: string; embedding: number[]; durationMs: number } }
  | { type: 'CLASSIFY_SUCCESS'; payload: { id: string; result: ClassificationResult } }
  | { type: 'ERROR'; payload: { id?: string; message: string; details?: unknown } }
