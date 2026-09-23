/**
 * Utility functions for local vector operations (cosine similarity, normalization)
 */

export function dotProduct(a: number[] | Float32Array, b: number[] | Float32Array): number {
  let sum = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const valA = a[i] ?? 0
    const valB = b[i] ?? 0
    sum += valA * valB
  }
  return sum
}

export function magnitude(vec: number[] | Float32Array): number {
  let sum = 0
  for (let i = 0; i < vec.length; i++) {
    const val = vec[i] ?? 0
    sum += val * val
  }
  return Math.sqrt(sum)
}

export function cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
  const magA = magnitude(a)
  const magB = magnitude(b)
  if (magA === 0 || magB === 0) return 0
  const sim = dotProduct(a, b) / (magA * magB)
  // Clamp between -1 and 1
  return Math.max(-1, Math.min(1, sim))
}

export function normalizeVector(vec: number[] | Float32Array): number[] {
  const mag = magnitude(vec)
  if (mag === 0) return Array.from(vec)
  return Array.from(vec).map((val) => val / mag)
}
