export const LOCAL_INTELLIGENCE_ENABLED = true

export interface ModelCatalogEntry {
  id: string
  name: string
  task: 'text' | 'embed' | 'vision'
  description: string
  approxSizeMb: number
  license: string
  quantization: string
  recommendedTier: 'high' | 'medium' | 'low'
  defaultForTask?: boolean
}

export const MODEL_CATALOG: Record<string, ModelCatalogEntry> = {
  'onnx-community/Qwen2.5-0.5B-Instruct': {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    name: 'Qwen 2.5 0.5B Instruct (q4)',
    task: 'text',
    description: 'Ultra-fast, high-quality instruction-tuned text model running locally via WebGPU/WASM.',
    approxSizeMb: 350,
    license: 'Apache-2.0',
    quantization: 'q4 / onnx',
    recommendedTier: 'high',
    defaultForTask: true,
  },
  'Xenova/LaMini-Flan-T5-783M': {
    id: 'Xenova/LaMini-Flan-T5-783M',
    name: 'LaMini-Flan-T5 783M (q8)',
    task: 'text',
    description: 'Compact text transformation model suited for rewriting, summarization, and tone shifting.',
    approxSizeMb: 390,
    license: 'CC-BY-NC-4.0',
    quantization: 'q8 / onnx',
    recommendedTier: 'medium',
  },
  'Xenova/all-MiniLM-L6-v2': {
    id: 'Xenova/all-MiniLM-L6-v2',
    name: 'all-MiniLM-L6-v2',
    task: 'embed',
    description: 'High-speed sentence embedding model (384 dimensions) for local semantic similarity and categorization.',
    approxSizeMb: 23,
    license: 'Apache-2.0',
    quantization: 'quantized onnx',
    recommendedTier: 'low',
    defaultForTask: true,
  },
  'tesseract-ocr': {
    id: 'tesseract-ocr',
    name: 'Tesseract.js Client-Side OCR',
    task: 'vision',
    description: 'Pure WebAssembly OCR worker running client-side with zero cloud calls.',
    approxSizeMb: 15,
    license: 'Apache-2.0',
    quantization: 'WASM engine + traineddata',
    recommendedTier: 'low',
    defaultForTask: true,
  },
}

export const DEFAULT_TEXT_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct'
export const DEFAULT_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'

export const DEFAULT_CATEGORIES = [
  'Note',
  'Task',
  'Meeting',
  'Idea',
  'Journal',
  'Reference',
  'Other',
] as const
