import {
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline'
import { MODEL_CATALOG } from '../../../intelligence/config'
import type { ModelLoadStatus, ModelProgressInfo } from '../../../intelligence/types'
import { Button } from '../../ui/button'

export interface LocalModelStatusCardProps {
  progressInfo: ModelProgressInfo
  selectedModelId: string
  onSelectModel: (modelId: string) => void
  onLoadModel: () => void
  isOnline: boolean
  isCached?: boolean
}

export function LocalModelStatusCard({
  progressInfo,
  selectedModelId,
  onSelectModel,
  onLoadModel,
  isOnline,
  isCached = false,
}: LocalModelStatusCardProps) {
  const model = MODEL_CATALOG[selectedModelId] ?? {
    id: selectedModelId,
    name: selectedModelId,
    approxSizeMb: 350,
    license: 'Apache-2.0',
    description: 'Local on-device language model',
  }

  const getStatusBadge = (status: ModelLoadStatus) => {
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            Ready in memory
          </span>
        )
      case 'downloading':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
            <ArrowDownTrayIcon className="w-3.5 h-3.5 animate-bounce" />
            Downloading weights ({progressInfo.progress ?? 0}%)
          </span>
        )
      case 'loading':
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <CpuChipIcon className="w-3.5 h-3.5 animate-spin" />
            {isCached ? 'Loading weights from cache...' : 'Initializing local engine...'}
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
            <ExclamationCircleIcon className="w-3.5 h-3.5" />
            Load failed
          </span>
        )
      case 'idle':
      default:
        if (isCached) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
              <CheckCircleIcon className="w-3.5 h-3.5" />
              Cached on device (0 MB download)
            </span>
          )
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Fast heuristics active (Model uninstantiated)
          </span>
        )
    }
  }

  const isWorking = progressInfo.status === 'downloading' || progressInfo.status === 'loading' || progressInfo.status === 'preparing'

  return (
    <div className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CpuChipIcon className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Local Writing Model
          </h3>
        </div>
        <div>{getStatusBadge(progressInfo.status)}</div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex-1">
          <label htmlFor="model-select" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Selected Model {isCached ? `(Cached on device, ~${model.approxSizeMb} MB)` : `(~${model.approxSizeMb} MB)`}
          </label>
          <select
            id="model-select"
            value={selectedModelId}
            onChange={(e) => onSelectModel(e.target.value)}
            disabled={isWorking}
            className="w-full h-8 px-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Object.values(MODEL_CATALOG)
              .filter((m) => m.task === 'text')
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (~{m.approxSizeMb} MB, {m.quantization})
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-end">
          <Button
            type="button"
            size="sm"
            onClick={onLoadModel}
            disabled={isWorking || progressInfo.status === 'ready'}
            className="h-8 text-xs whitespace-nowrap"
          >
            {isWorking ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isCached ? 'Loading Cache...' : 'Loading...'}
              </span>
            ) : progressInfo.status === 'ready' ? (
              <span className="flex items-center gap-1.5">
                <CheckCircleIcon className="w-3.5 h-3.5" />
                Model Loaded
              </span>
            ) : isCached ? (
              <span className="flex items-center gap-1.5">
                <CpuChipIcon className="w-3.5 h-3.5" />
                Load from Local Cache
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                Download & Load Model
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Progress Bar when downloading */}
      {isWorking && (
        <div className="flex flex-col gap-1 pt-1">
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressInfo.progress ?? 30}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {progressInfo.message || 'Loading model weights...'}
          </span>
        </div>
      )}

      {/* Privacy Guarantee Banner */}
      <div className="flex items-start gap-2 p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
        <ShieldCheckIcon className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[11px]">100% Client-Side Privacy</span>
          <span className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90">
            Runs locally on this device. Your text is not sent to an AI server.
            {!isOnline && ' (Operating in Offline Mode)'}
          </span>
        </div>
      </div>
    </div>
  )
}
