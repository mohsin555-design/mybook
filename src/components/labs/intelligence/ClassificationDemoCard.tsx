import { useState } from 'react'
import { TagIcon, SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { classificationEngine } from '../../../intelligence/classificationEngine'
import type { ClassificationResult } from '../../../intelligence/types'
import { Button } from '../../ui/button'

export interface ClassificationDemoCardProps {
  selectedEditorText?: string
}

export function ClassificationDemoCard({ selectedEditorText = '' }: ClassificationDemoCardProps) {
  const [inputText, setInputText] = useState(
    'Schedule quarterly engineering sync on Friday at 2pm to review sprint deliverables and release dates.'
  )
  const [result, setResult] = useState<ClassificationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleClassify = async () => {
    if (!inputText.trim()) return
    setIsLoading(true)
    try {
      const res = await classificationEngine.classify(inputText)
      setResult(res)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseSelection = () => {
    if (selectedEditorText.trim()) {
      setInputText(selectedEditorText)
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TagIcon className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Local Note Classification
          </h3>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Zero-Shot / Heuristic Categorizer
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enter note text to classify..."
          rows={2}
          className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />

        <div className="flex items-center justify-between gap-2">
          {selectedEditorText ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUseSelection}
              className="h-7 px-2 text-[11px] text-primary hover:bg-primary/5"
            >
              Use Editor Selection
            </Button>
          ) : (
            <div />
          )}

          <Button
            type="button"
            size="sm"
            onClick={handleClassify}
            disabled={isLoading || !inputText.trim()}
            className="h-8 text-xs ml-auto"
          >
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                Classifying...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <SparklesIcon className="w-3.5 h-3.5" />
                Classify Note
              </span>
            )}
          </Button>
        </div>
      </div>

      {result && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">Predicted:</span>
              <span className="px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary">
                {result.predictedCategory}
              </span>
              <span className="text-slate-400">({Math.round(result.confidence * 100)}% confidence)</span>
            </div>
            <span className="text-[11px] text-slate-400">{result.durationMs}ms</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {result.allScores.map((item) => (
              <div
                key={item.category}
                className={`flex flex-col gap-1 p-2 rounded-lg border text-xs ${
                  item.category === result.predictedCategory
                    ? 'border-primary/40 bg-primary/5 font-medium'
                    : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex justify-between items-center text-[11px]">
                  <span>{item.category}</span>
                  <span>{Math.round(item.score * 100)}%</span>
                </div>
                <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.round(item.score * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
