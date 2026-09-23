import { useState, useEffect, useCallback, useRef } from 'react'
import { ShieldCheckIcon, BeakerIcon } from '@heroicons/react/24/outline'
import type { JSONContent } from '@tiptap/core'

import {
  detectDeviceCapability,
  checkOfflineModelCache,
  modelLoader,
  writingEngine,
  MODEL_CATALOG,
  DEFAULT_TEXT_MODEL,
} from '../intelligence'
import type {
  DeviceCapability,
  ModelProgressInfo,
  WritingActionType,
  WritingResult,
  DiagnosticsInfo,
} from '../intelligence/types'

import { LabEditor, type LabEditorMethods } from '../components/labs/intelligence/LabEditor'
import { IntelligenceActionToolbar } from '../components/labs/intelligence/IntelligenceActionToolbar'
import { WritingResultPreview } from '../components/labs/intelligence/WritingResultPreview'
import { LocalModelStatusCard } from '../components/labs/intelligence/LocalModelStatusCard'
import { ClassificationDemoCard } from '../components/labs/intelligence/ClassificationDemoCard'
import { EmbeddingSimilarityDemoCard } from '../components/labs/intelligence/EmbeddingSimilarityDemoCard'
import { OcrImageToBlocksCard } from '../components/labs/intelligence/OcrImageToBlocksCard'
import { DiagnosticsPanel } from '../components/labs/intelligence/DiagnosticsPanel'
import { UnsupportedDeviceState } from '../components/labs/intelligence/UnsupportedDeviceState'

export function LocalIntelligenceLabPage() {
  const [capability, setCapability] = useState<DeviceCapability | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_TEXT_MODEL)
  const [modelProgress, setModelProgress] = useState<ModelProgressInfo>({
    status: 'idle',
    modelId: DEFAULT_TEXT_MODEL,
  })
  const [selectedText, setSelectedText] = useState('')
  const [hasSelection, setHasSelection] = useState(false)
  const [isWritingActionRunning, setIsWritingActionRunning] = useState(false)
  const [currentWritingAction, setCurrentWritingAction] = useState<WritingActionType | null>(null)
  const [writingResult, setWritingResult] = useState<WritingResult | null>(null)
  const [activeTab, setActiveTab] = useState<'writing' | 'classify' | 'embed' | 'ocr'>('writing')

  const [diagnostics, setDiagnostics] = useState<DiagnosticsInfo>({
    capability: {
      hasWebGpu: false,
      hasWasm: true,
      tier: 'medium',
      hardwareConcurrency: 4,
      isOnline: true,
      isSupported: true,
      browserEnv: 'Browser',
      notes: [],
    },
    activeModel: DEFAULT_TEXT_MODEL,
    modelStatus: 'idle',
    modelSizeApprox: `~${MODEL_CATALOG[DEFAULT_TEXT_MODEL]?.approxSizeMb ?? 350} MB`,
    lastInferenceDurationMs: null,
    lastAction: null,
    offlineCached: false,
    errorMessage: null,
    logs: [],
  })

  const editorMethodsRef = useRef<{
    replaceSelection: (text: string) => void
    insertBelowSelection: (text: string) => void
    insertBlocks: (blocks: JSONContent[]) => void
    getSelectedText: () => string
    getAllText: () => string
  } | null>(null)

  const addLog = useCallback((message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setDiagnostics((prev) => ({
      ...prev,
      logs: [...prev.logs.slice(-40), { timestamp, level, message }],
    }))
  }, [])

  // Detect capability on mount
  useEffect(() => {
    let isMounted = true
    detectDeviceCapability().then(async (cap) => {
      if (!isMounted) return
      setCapability(cap)
      const isCached = await checkOfflineModelCache(selectedModelId)
      setDiagnostics((prev) => ({
        ...prev,
        capability: cap,
        offlineCached: isCached,
      }))
      addLog(`Device capability analyzed: ${cap.tier.toUpperCase()} tier (${cap.hasWebGpu ? 'WebGPU' : 'WASM'})`)
    })

    const unsubscribe = modelLoader.addProgressListener((info) => {
      if (!isMounted) return
      setModelProgress(info)
      setDiagnostics((prev) => ({
        ...prev,
        modelStatus: info.status,
        errorMessage: info.status === 'error' ? info.message ?? 'Unknown error' : null,
      }))
      if (info.message) {
        addLog(info.message, info.status === 'error' ? 'error' : 'info')
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [addLog, selectedModelId])

  const handleLoadModel = async () => {
    addLog(`Initiating download/load for model: ${selectedModelId}`)
    try {
      await modelLoader.loadModel(selectedModelId, 'text')
    } catch (err) {
      addLog(`Failed to load model: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  const handleSelectionChange = useCallback((text: string, selected: boolean) => {
    setSelectedText(text)
    setHasSelection(selected)
  }, [])

  const handleEditorReady = useCallback((methods: LabEditorMethods) => {
    editorMethodsRef.current = methods
  }, [])

  const handleWritingAction = async (action: WritingActionType) => {
    let targetText = selectedText.trim()
    if (!targetText && editorMethodsRef.current) {
      targetText = editorMethodsRef.current.getAllText().trim()
    }
    if (!targetText) {
      addLog('No text available in editor to process', 'warn')
      return
    }

    setIsWritingActionRunning(true)
    setCurrentWritingAction(action)
    setWritingResult(null)
    addLog(`Executing local writing action: ${action} on ${targetText.length} chars...`)

    try {
      let res: WritingResult
      switch (action) {
        case 'improve':
          res = await writingEngine.improve(targetText)
          break
        case 'fix_grammar':
          res = await writingEngine.fixGrammar(targetText)
          break
        case 'rewrite':
          res = await writingEngine.rewrite(targetText)
          break
        case 'shorten':
          res = await writingEngine.shorten(targetText)
          break
        case 'expand':
          res = await writingEngine.expand(targetText)
          break
        case 'summarize':
          res = await writingEngine.summarize(targetText)
          break
        case 'make_professional':
          res = await writingEngine.makeProfessional(targetText)
          break
        case 'make_casual':
          res = await writingEngine.makeCasual(targetText)
          break
        case 'generate_title':
          res = await writingEngine.generateTitle(targetText)
          break
        default:
          res = await writingEngine.improve(targetText)
          break
      }

      setWritingResult(res)
      setDiagnostics((prev) => ({
        ...prev,
        lastInferenceDurationMs: res.durationMs,
        lastAction: action,
      }))
      addLog(`Writing action '${action}' completed in ${res.durationMs}ms via ${res.modelUsed}`)
    } catch (err) {
      addLog(`Writing action failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setIsWritingActionRunning(false)
      setCurrentWritingAction(null)
    }
  }

  const handleReplaceSelection = (text: string) => {
    if (editorMethodsRef.current) {
      editorMethodsRef.current.replaceSelection(text)
      setWritingResult(null)
      addLog('Replaced text in editor')
    }
  }

  const handleInsertBelow = (text: string) => {
    if (editorMethodsRef.current) {
      editorMethodsRef.current.insertBelowSelection(text)
      setWritingResult(null)
      addLog('Inserted text below selection')
    }
  }

  const handleInsertBlocks = (blocks: JSONContent[]) => {
    if (editorMethodsRef.current) {
      editorMethodsRef.current.insertBlocks(blocks)
      addLog(`Inserted ${blocks.length} structured blocks into editor`)
    }
  }

  const handleInsertText = (text: string) => {
    if (editorMethodsRef.current) {
      editorMethodsRef.current.insertBelowSelection(text)
      addLog('Inserted raw OCR text into editor')
    }
  }

  if (capability && !capability.isSupported) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <UnsupportedDeviceState />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Banner / Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <BeakerIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white">
                  Writin Local Intelligence Lab
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Experimental
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Zero-cost, on-device AI inference with complete privacy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60 text-xs font-medium">
              <ShieldCheckIcon className="w-4 h-4 text-emerald-500" />
              <span>Zero Network AI Cost</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1 flex flex-col gap-6">
        {/* Top Control Bar: Model Status Card */}
        <LocalModelStatusCard
          progressInfo={modelProgress}
          selectedModelId={selectedModelId}
          onSelectModel={(id) => {
            setSelectedModelId(id)
            setDiagnostics((prev) => ({
              ...prev,
              activeModel: id,
              modelSizeApprox: `~${MODEL_CATALOG[id]?.approxSizeMb ?? 350} MB`,
            }))
          }}
          onLoadModel={handleLoadModel}
          isOnline={capability?.isOnline ?? true}
        />

        {/* Workspace Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Real Writin Editor & Transformations (7 cols) */}
          <section className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Sample Document Editor
              </span>
              <span className="text-xs text-slate-400">
                Uses real Writin Tiptap block extensions
              </span>
            </div>

            {/* Real Tiptap Document Editor */}
            <LabEditor
              onSelectionChange={handleSelectionChange}
              onEditorReady={handleEditorReady}
            />

            {/* Live Result Preview Banner (When Action Executes) */}
            {writingResult && (
              <WritingResultPreview
                result={writingResult}
                onReplace={handleReplaceSelection}
                onInsertBelow={handleInsertBelow}
                onRetry={() => currentWritingAction && handleWritingAction(currentWritingAction)}
                onCancel={() => setWritingResult(null)}
                isLoading={isWritingActionRunning}
              />
            )}
          </section>

          {/* Right Column: Lab Modules & Tools (5 cols) */}
          <section className="lg:col-span-5 flex flex-col gap-4">
            {/* Lab Module Tabs */}
            <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('writing')}
                className={`flex-1 py-1.5 px-2 rounded-md transition-all ${
                  activeTab === 'writing'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Writing Tools
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('classify')}
                className={`flex-1 py-1.5 px-2 rounded-md transition-all ${
                  activeTab === 'classify'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Classification
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('embed')}
                className={`flex-1 py-1.5 px-2 rounded-md transition-all ${
                  activeTab === 'embed'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Embeddings
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ocr')}
                className={`flex-1 py-1.5 px-2 rounded-md transition-all ${
                  activeTab === 'ocr'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Image OCR
              </button>
            </div>

            {/* Active Tab Content */}
            {activeTab === 'writing' && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                <IntelligenceActionToolbar
                  onActionClick={handleWritingAction}
                  isLoading={isWritingActionRunning}
                  currentAction={currentWritingAction}
                  hasSelection={hasSelection}
                />
              </div>
            )}

            {activeTab === 'classify' && (
              <div className="animate-in fade-in duration-150">
                <ClassificationDemoCard selectedEditorText={selectedText} />
              </div>
            )}

            {activeTab === 'embed' && (
              <div className="animate-in fade-in duration-150">
                <EmbeddingSimilarityDemoCard selectedEditorText={selectedText} />
              </div>
            )}

            {activeTab === 'ocr' && (
              <div className="animate-in fade-in duration-150">
                <OcrImageToBlocksCard
                  onInsertBlocks={handleInsertBlocks}
                  onInsertText={handleInsertText}
                />
              </div>
            )}

            {/* Diagnostics Panel (Collapsible) */}
            <DiagnosticsPanel diagnostics={diagnostics} />
          </section>
        </div>
      </main>
    </div>
  )
}
