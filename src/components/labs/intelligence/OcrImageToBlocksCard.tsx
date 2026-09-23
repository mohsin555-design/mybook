import { useState, useRef } from 'react'
import {
  PhotoIcon,
  DocumentArrowUpIcon,
  SparklesIcon,
  ArrowPathIcon,
  CheckIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import type { JSONContent } from '@tiptap/core'
import { ocrEngine } from '../../../intelligence/ocrEngine'
import type { OcrResult } from '../../../intelligence/types'
import { Button } from '../../ui/button'

export interface OcrImageToBlocksCardProps {
  onInsertBlocks?: (blocks: JSONContent[]) => void
  onInsertText?: (text: string) => void
}

export function OcrImageToBlocksCard({ onInsertBlocks, onInsertText }: OcrImageToBlocksCardProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressText, setProgressText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp')) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setOcrResult(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp')) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setOcrResult(null)
    }
  }

  const handleRunOcr = async () => {
    if (!selectedFile && !previewUrl) return
    setIsProcessing(true)
    setProgressText('Preparing OCR worker...')

    try {
      const source = selectedFile || previewUrl!
      const res = await ocrEngine.extractTextFromImage(source, (_pct, msg) => {
        setProgressText(msg)
      })
      setOcrResult(res)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleLoadSampleImage = () => {
    // Canvas generated sample receipt/note image
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 240
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, 400, 240)
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 16px sans-serif'
      ctx.fillText('Project Action Items', 20, 36)
      ctx.font = '13px sans-serif'
      ctx.fillText('[x] 1. Complete WebGPU benchmark', 20, 72)
      ctx.fillText('[ ] 2. Implement local text rewriting', 20, 102)
      ctx.fillText('[ ] 3. Validate zero external network calls', 20, 132)
      ctx.fillText('• Key Note: Maintain 100% on-device privacy', 20, 170)
      ctx.fillText('| Module | Status |', 20, 204)
      ctx.fillText('| OCR | Operational |', 20, 224)
    }
    const dataUrl = canvas.toDataURL('image/png')
    setPreviewUrl(dataUrl)
    setSelectedFile(null)
    setOcrResult(null)
  }

  const handleClear = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setOcrResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PhotoIcon className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Image to Text & Blocks (Local OCR)
          </h3>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Client-Side WebAssembly OCR
        </span>
      </div>

      {/* Upload Zone / Preview */}
      {!previewUrl ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
        >
          <DocumentArrowUpIcon className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
            Drop an image here (PNG, JPG) or click to browse
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Extracts text and formats into headings, bullet lists, checklists, and tables
          </p>
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handleLoadSampleImage()
              }}
              className="h-7 text-xs"
            >
              Load Sample Image Note
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4">
          {/* Image Preview Box */}
          <div className="flex flex-col gap-2 md:w-1/2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Source Image:
            </span>
            <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 max-h-52 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <img src={previewUrl} alt="OCR Target Preview" className="max-h-52 object-contain" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                onClick={handleRunOcr}
                disabled={isProcessing}
                className="h-8 text-xs font-medium flex-1"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-1.5">
                    <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                    Extracting...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <SparklesIcon className="w-3.5 h-3.5" />
                    Extract Text & Blocks
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={isProcessing}
                className="h-8 text-xs text-slate-500"
              >
                Clear
              </Button>
            </div>
            {isProcessing && (
              <span className="text-[11px] text-slate-500 animate-pulse">{progressText}</span>
            )}
          </div>

          {/* OCR Extracted Output Box */}
          <div className="flex flex-col gap-2 md:w-1/2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Extracted Formatted Blocks:
              </span>
              {ocrResult && (
                <span className="text-[11px] text-slate-400">
                  {Math.round(ocrResult.confidence * 100)}% conf • {ocrResult.durationMs}ms
                </span>
              )}
            </div>

            <div className="min-h-[140px] max-h-52 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
              {ocrResult ? ocrResult.rawText : 'Click "Extract Text & Blocks" to parse image.'}
            </div>

            {ocrResult && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onInsertBlocks?.(ocrResult.formattedBlocks)}
                  className="h-7 text-xs"
                >
                  <PlusIcon className="w-3.5 h-3.5 mr-1" />
                  Insert Formatted Blocks
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onInsertText?.(ocrResult.rawText)}
                  className="h-7 text-xs"
                >
                  <CheckIcon className="w-3.5 h-3.5 mr-1" />
                  Insert Raw Text
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
