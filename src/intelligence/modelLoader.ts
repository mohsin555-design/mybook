import { DEFAULT_TEXT_MODEL, MODEL_CATALOG } from './config'
import type { ModelLoadStatus, ModelProgressInfo, WorkerRequest, WorkerResponse } from './types'

type ProgressListener = (info: ModelProgressInfo) => void

class ModelLoaderManager {
  private worker: Worker | null = null
  private activeModelId: string = DEFAULT_TEXT_MODEL
  private currentStatus: ModelLoadStatus = 'idle'
  private progressListeners: Set<ProgressListener> = new Set()
  private pendingRequests: Map<string, { resolve: (val: unknown) => void; reject: (err: unknown) => void }> = new Map()

  constructor() {
    // Lazy worker instantiation
  }

  public getStatus(): ModelLoadStatus {
    return this.currentStatus
  }

  public getActiveModelId(): string {
    return this.activeModelId
  }

  public getActiveModelDetails() {
    return MODEL_CATALOG[this.activeModelId] ?? {
      id: this.activeModelId,
      name: this.activeModelId,
      approxSizeMb: 350,
      license: 'Open-Source',
    }
  }

  public addProgressListener(listener: ProgressListener): () => void {
    this.progressListeners.add(listener)
    // Dispatch immediate status
    listener({ status: this.currentStatus, modelId: this.activeModelId })
    return () => {
      this.progressListeners.delete(listener)
    }
  }

  private notifyProgress(info: ModelProgressInfo) {
    this.currentStatus = info.status
    this.progressListeners.forEach((listener) => {
      try {
        listener(info)
      } catch {
        // Ignore listener error
      }
    })
  }

  public getOrCreateWorker(): Worker | null {
    if (typeof window === 'undefined') return null
    if (!this.worker) {
      try {
        this.worker = new Worker(new URL('./workers/intelligenceWorker.ts', import.meta.url), {
          type: 'module',
        })
        this.worker.addEventListener('message', this.handleWorkerMessage.bind(this))
        this.worker.addEventListener('error', (err) => {
          this.notifyProgress({
            status: 'error',
            message: `Worker error: ${err.message || 'Script failed'}`,
            modelId: this.activeModelId,
          })
        })
      } catch (err) {
        this.notifyProgress({
          status: 'error',
          message: `Worker initialization failed: ${err instanceof Error ? err.message : String(err)}`,
          modelId: this.activeModelId,
        })
        return null
      }
    }
    return this.worker
  }

  private handleWorkerMessage(event: MessageEvent<WorkerResponse>) {
    const res = event.data
    if (!res || !res.type) return

    if (res.type === 'MODEL_PROGRESS') {
      this.notifyProgress(res.payload)
    } else if (res.type === 'WRITING_SUCCESS' || res.type === 'EMBED_SUCCESS' || res.type === 'CLASSIFY_SUCCESS') {
      const id = res.payload.id
      const pending = this.pendingRequests.get(id)
      if (pending) {
        this.pendingRequests.delete(id)
        pending.resolve(res.payload)
      }
    } else if (res.type === 'ERROR') {
      const id = res.payload.id
      if (id) {
        const pending = this.pendingRequests.get(id)
        if (pending) {
          this.pendingRequests.delete(id)
          pending.reject(new Error(res.payload.message))
        }
      }
    }
  }

  public async loadModel(modelId: string = this.activeModelId, task: 'text' | 'embed' = 'text'): Promise<void> {
    this.activeModelId = modelId
    this.notifyProgress({ status: 'preparing', progress: 0, message: `Preparing ${modelId}...`, modelId })

    const worker = this.getOrCreateWorker()
    if (!worker) {
      this.notifyProgress({ status: 'ready', progress: 100, message: 'Running with local fast heuristics', modelId })
      return
    }

    const req: WorkerRequest = {
      type: 'LOAD_MODEL',
      payload: { modelId, task },
    }
    worker.postMessage(req)
  }

  public sendRequest<T>(req: WorkerRequest, requestId: string): Promise<T> {
    const worker = this.getOrCreateWorker()
    if (!worker) {
      return Promise.reject(new Error('Web Worker unavailable'))
    }

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: resolve as (val: unknown) => void,
        reject,
      })
      worker.postMessage(req)
    })
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.currentStatus = 'idle'
    this.pendingRequests.clear()
  }
}

export const modelLoader = new ModelLoaderManager()
