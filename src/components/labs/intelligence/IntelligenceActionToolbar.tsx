import {
  SparklesIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  FaceSmileIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import type { WritingActionType } from '../../../intelligence/types'
import { Button } from '../../ui/button'

interface ActionConfig {
  id: WritingActionType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const WRITING_ACTIONS: ActionConfig[] = [
  { id: 'improve', label: 'Improve Writing', description: 'Enhance clarity, phrasing, and flow', icon: SparklesIcon },
  { id: 'fix_grammar', label: 'Fix Grammar', description: 'Correct grammar, typos, and punctuation', icon: CheckCircleIcon },
  { id: 'rewrite', label: 'Rewrite', description: 'Rephrase sentences smoothly', icon: PencilSquareIcon },
  { id: 'shorten', label: 'Shorten', description: 'Make concise and remove filler', icon: ArrowsPointingInIcon },
  { id: 'expand', label: 'Expand', description: 'Elaborate with clear details', icon: ArrowsPointingOutIcon },
  { id: 'summarize', label: 'Summarize', description: 'Distill into key takeaways', icon: DocumentTextIcon },
  { id: 'make_professional', label: 'Professional', description: 'Polish into formal business tone', icon: BriefcaseIcon },
  { id: 'make_casual', label: 'Casual', description: 'Adapt to friendly, natural tone', icon: FaceSmileIcon },
  { id: 'generate_title', label: 'Generate Title', description: 'Create a succinct 4-6 word title', icon: TagIcon },
]

export interface IntelligenceActionToolbarProps {
  onActionClick: (action: WritingActionType) => void
  isLoading?: boolean
  currentAction?: WritingActionType | null
  hasSelection?: boolean
  disabled?: boolean
}

export function IntelligenceActionToolbar({
  onActionClick,
  isLoading = false,
  currentAction = null,
  hasSelection = false,
  disabled = false,
}: IntelligenceActionToolbarProps) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Writing Actions
          </span>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {hasSelection ? 'Targeting selected text' : 'Select text or transform document'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-1.5">
        {WRITING_ACTIONS.map((action) => {
          const Icon = action.icon
          const isThisActive = isLoading && currentAction === action.id

          return (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isLoading}
              onClick={() => {
                if (!disabled && !isLoading) {
                  onActionClick(action.id)
                }
              }}
              className={`h-9 px-2.5 justify-start text-xs font-normal border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all ${
                isThisActive ? 'ring-2 ring-primary bg-primary/10' : ''
              }`}
              title={action.description}
            >
              {isThisActive ? (
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-1.5" />
              ) : (
                <Icon className="w-3.5 h-3.5 text-primary mr-1.5 shrink-0" />
              )}
              <span className="truncate">{action.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
