import { ArrowPathIcon, CheckIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline'
import type { WritingResult } from '../../../intelligence/types'
import { Button } from '../../ui/button'

export interface WritingResultPreviewProps {
  result: WritingResult
  onReplace: (transformedText: string) => void
  onInsertBelow: (transformedText: string) => void
  onRetry: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function WritingResultPreview({
  result,
  onReplace,
  onInsertBelow,
  onRetry,
  onCancel,
  isLoading = false,
}: WritingResultPreviewProps) {
  const actionLabel = result.action.replace('_', ' ').toUpperCase()

  return (
    <div className="flex flex-col gap-3 p-4 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-primary px-1.5 py-0.5 rounded bg-primary/10 text-[11px]">
            {actionLabel}
          </span>
          <span>{result.durationMs}ms</span>
          <span>•</span>
          <span className="truncate max-w-[150px]">{result.modelUsed}</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          aria-label="Close preview"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Transformed Result Preview Box */}
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed shadow-sm">
        {result.transformedText}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          onClick={() => onReplace(result.transformedText)}
          disabled={isLoading}
          className="h-8 text-xs font-medium"
        >
          <CheckIcon className="w-3.5 h-3.5 mr-1" />
          Replace Selection
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onInsertBelow(result.transformedText)}
          disabled={isLoading}
          className="h-8 text-xs font-medium"
        >
          <PlusIcon className="w-3.5 h-3.5 mr-1" />
          Insert Below
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRetry}
          disabled={isLoading}
          className="h-8 text-xs text-slate-600 dark:text-slate-300"
        >
          <ArrowPathIcon className="w-3.5 h-3.5 mr-1" />
          Retry
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isLoading}
          className="h-8 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 ml-auto"
        >
          Dismiss
        </Button>
      </div>
    </div>
  )
}
