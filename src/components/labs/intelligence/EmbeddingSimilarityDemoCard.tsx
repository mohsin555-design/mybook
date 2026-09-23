import { useState } from 'react'
import { MagnifyingGlassIcon, DocumentDuplicateIcon, SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { embeddingEngine } from '../../../intelligence/embeddingEngine'
import type { NoteItem, SemanticMatch } from '../../../intelligence/types'
import { Button } from '../../ui/button'

const SAMPLE_NOTES_CORPUS: NoteItem[] = [
  {
    id: 'note-1',
    title: 'Zero-Cost Local AI Architecture',
    category: 'Architecture',
    content: 'Running Transformers.js and ONNX Runtime Web locally in browser Web Workers ensures zero server costs and absolute user privacy.',
  },
  {
    id: 'note-2',
    title: 'Client-Side Offline Data Persistence',
    category: 'Database',
    content: 'IndexedDB and Dexie allow local workspace files and attachments to be saved without internet connectivity.',
  },
  {
    id: 'note-3',
    title: 'WebGPU Hardware Acceleration',
    category: 'Performance',
    content: 'Leveraging WebGPU compute shaders drastically speeds up tensor operations, neural network inference, and matrix multiplications on device.',
  },
  {
    id: 'note-4',
    title: 'Sprint Retrospective & Team Action Items',
    category: 'Meeting',
    content: 'Discussed editor performance bottlenecks, resolved block drag-and-drop bugs, and planned the upcoming release milestones.',
  },
  {
    id: 'note-5',
    title: 'Typography & Design System Guidelines',
    category: 'Design',
    content: 'Consistently apply Figtree and Inter variable fonts with Tailwind CSS utility classes and Shadcn UI components.',
  },
]

export interface EmbeddingSimilarityDemoCardProps {
  selectedEditorText?: string
}

export function EmbeddingSimilarityDemoCard({ selectedEditorText = '' }: EmbeddingSimilarityDemoCardProps) {
  const [query, setQuery] = useState('How can we accelerate neural network models on device hardware?')
  const [matches, setMatches] = useState<SemanticMatch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [durationMs, setDurationMs] = useState<number | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) return
    setIsLoading(true)
    const start = performance.now()
    try {
      const results = await embeddingEngine.findRelatedNotes(query, SAMPLE_NOTES_CORPUS)
      setMatches(results)
      setDurationMs(Math.round(performance.now() - start))
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseSelection = () => {
    if (selectedEditorText.trim()) {
      setQuery(selectedEditorText)
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MagnifyingGlassIcon className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Local Semantic Search & Embeddings
          </h3>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          384-dim Sentence Vector Space
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter search query or concept..."
            className="w-full h-9 pl-3 pr-20 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="absolute right-1 top-1">
            <Button
              type="button"
              size="sm"
              onClick={handleSearch}
              disabled={isLoading || !query.trim()}
              className="h-7 px-2.5 text-xs"
            >
              {isLoading ? (
                <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <SparklesIcon className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline ml-1">Search</span>
            </Button>
          </div>
        </div>

        {selectedEditorText && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUseSelection}
              className="h-6 px-2 text-[11px] text-primary hover:bg-primary/5"
            >
              Use Editor Selection as Query
            </Button>
          </div>
        )}
      </div>

      {/* Semantic Matches List */}
      {matches.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Ranked by Cosine Similarity</span>
            {durationMs !== null && <span>{durationMs}ms</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            {matches.map((item, idx) => {
              const pct = Math.max(0, Math.min(100, Math.round(item.similarity * 100)))
              const isTop = idx === 0

              return (
                <div
                  key={item.note.id}
                  className={`flex flex-col gap-1 p-2.5 rounded-lg border text-xs transition-all ${
                    isTop
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <DocumentDuplicateIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {item.note.title}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium shrink-0 ${
                        pct > 75
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : pct > 50
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {pct}% Match
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                    {item.note.content}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
