import type { DeviceCapability } from './types'

let cachedCapability: DeviceCapability | null = null

export async function detectDeviceCapability(forceRefresh = false): Promise<DeviceCapability> {
  if (cachedCapability && !forceRefresh) {
    // Keep dynamic properties updated
    return {
      ...cachedCapability,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    }
  }

  let hasWebGpu = false
  const notes: string[] = []

  if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu) {
    try {
      const adapter = await (navigator as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu.requestAdapter()
      if (adapter) {
        hasWebGpu = true
        notes.push('WebGPU hardware acceleration is available')
      } else {
        notes.push('WebGPU adapter was not found')
      }
    } catch {
      notes.push('WebGPU initialization failed, using WebAssembly fallback')
    }
  } else {
    notes.push('WebGPU is not supported by this browser/platform')
  }

  const hasWasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function'
  if (hasWasm) {
    notes.push('WebAssembly runtime is available for local CPU inference')
  } else {
    notes.push('WebAssembly is unavailable')
  }

  const hardwareConcurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 4
  const deviceMemoryGb = typeof navigator !== 'undefined' && 'deviceMemory' in navigator
    ? (navigator as { deviceMemory?: number }).deviceMemory
    : undefined

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

  let tier: 'high' | 'medium' | 'low' = 'low'
  if (hasWebGpu && (!deviceMemoryGb || deviceMemoryGb >= 4) && hardwareConcurrency >= 4) {
    tier = 'high'
  } else if (hasWasm && hardwareConcurrency >= 2) {
    tier = 'medium'
  } else {
    tier = 'low'
  }

  const isSupported = hasWebGpu || hasWasm

  let browserEnv = 'Browser'
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent
    if (/chrome|chromium|crios/i.test(ua)) browserEnv = 'Chromium-based'
    else if (/firefox|fxios/i.test(ua)) browserEnv = 'Firefox'
    else if (/safari/i.test(ua)) browserEnv = 'Safari / WebKit'
    else browserEnv = 'Modern Web Browser'
  }

  cachedCapability = {
    hasWebGpu,
    hasWasm,
    tier,
    hardwareConcurrency,
    deviceMemoryGb,
    isOnline,
    isSupported,
    browserEnv,
    notes,
  }

  return cachedCapability
}

export async function checkOfflineModelCache(modelId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    if (localStorage.getItem(`model_cached_${modelId}`) === 'true') {
      return true
    }
  } catch {
    // Ignore localStorage access restrictions
  }

  if (!('caches' in window)) return false
  try {
    const cacheNames = await window.caches.keys()
    const modelBase = modelId.split('/').pop() || modelId
    for (const name of cacheNames) {
      if (name.includes('transformers') || name.includes('onnx') || name.includes('tesseract')) {
        const cache = await window.caches.open(name)
        const keys = await cache.keys()
        if (
          keys.some(
            (req) =>
              req.url.includes(modelId) ||
              req.url.includes(encodeURIComponent(modelId)) ||
              (modelBase && req.url.includes(modelBase)) ||
              req.url.includes('traineddata')
          )
        ) {
          try {
            localStorage.setItem(`model_cached_${modelId}`, 'true')
          } catch {
            // Ignore
          }
          return true
        }
      }
    }
  } catch {
    // Cache check failed or was blocked
  }
  return false
}
