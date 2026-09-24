// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { IntelligenceActionToolbar } from './IntelligenceActionToolbar'
import { WritingResultPreview } from './WritingResultPreview'
import { LocalModelStatusCard } from './LocalModelStatusCard'
import { DiagnosticsPanel } from './DiagnosticsPanel'
import { UnsupportedDeviceState } from './UnsupportedDeviceState'
import { DEFAULT_TEXT_MODEL } from '../../../intelligence/config'

afterEach(() => {
  cleanup()
})

describe('IntelligenceActionToolbar', () => {
  it('renders all writing actions', () => {
    const handleActionClick = vi.fn()
    const { unmount } = render(
      <IntelligenceActionToolbar
        onActionClick={handleActionClick}
        hasSelection={true}
        isLoading={false}
      />
    )

    expect(screen.getByText('Writing Actions')).toBeInTheDocument()
    expect(screen.getByText('Improve Writing')).toBeInTheDocument()
    expect(screen.getByText('Summarize')).toBeInTheDocument()
    expect(screen.getByText('Rewrite')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Improve Writing'))
    expect(handleActionClick).toHaveBeenCalledWith('improve')
    unmount()
  })

  it('disables buttons during loading and prevents click', () => {
    const handleActionClick = vi.fn()
    const { unmount } = render(
      <IntelligenceActionToolbar
        onActionClick={handleActionClick}
        isLoading={true}
        currentAction="summarize"
      />
    )

    fireEvent.click(screen.getByText('Improve Writing'))
    expect(handleActionClick).not.toHaveBeenCalled()
    unmount()
  })
})

describe('WritingResultPreview', () => {
  it('renders transformed text and triggers replace / insert actions', () => {
    const handleReplace = vi.fn()
    const handleInsert = vi.fn()
    const handleCancel = vi.fn()
    const handleRetry = vi.fn()

    const result = {
      action: 'improve' as const,
      originalText: 'Original',
      transformedText: 'Improved version of the text',
      durationMs: 120,
      modelUsed: 'Qwen 2.5 0.5B Instruct',
    }

    const { unmount } = render(
      <WritingResultPreview
        result={result}
        onReplace={handleReplace}
        onInsertBelow={handleInsert}
        onRetry={handleRetry}
        onCancel={handleCancel}
      />
    )

    expect(screen.getByText('Improved version of the text')).toBeInTheDocument()
    expect(screen.getByText(/120ms/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Replace Selection'))
    expect(handleReplace).toHaveBeenCalledWith('Improved version of the text')

    fireEvent.click(screen.getByText('Insert Below'))
    expect(handleInsert).toHaveBeenCalledWith('Improved version of the text')

    fireEvent.click(screen.getByText('Retry'))
    expect(handleRetry).toHaveBeenCalled()

    fireEvent.click(screen.getByText('Dismiss'))
    expect(handleCancel).toHaveBeenCalled()
    unmount()
  })
})

describe('LocalModelStatusCard', () => {
  it('renders idle status and triggers load model', () => {
    const handleLoad = vi.fn()
    const handleSelect = vi.fn()

    const { unmount } = render(
      <LocalModelStatusCard
        progressInfo={{ status: 'idle', modelId: DEFAULT_TEXT_MODEL }}
        selectedModelId={DEFAULT_TEXT_MODEL}
        onSelectModel={handleSelect}
        onLoadModel={handleLoad}
        isOnline={true}
        isCached={false}
      />
    )

    expect(screen.getByText('Local Writing Model')).toBeInTheDocument()
    expect(screen.getByText(/Runs locally on this device/)).toBeInTheDocument()

    const loadButton = screen.getByRole('button', { name: /Download & Load Model/i })
    fireEvent.click(loadButton)
    expect(handleLoad).toHaveBeenCalled()
    unmount()
  })

  it('renders cached status with 0 MB download indicator when model is cached', () => {
    const handleLoad = vi.fn()
    const handleSelect = vi.fn()

    const { unmount } = render(
      <LocalModelStatusCard
        progressInfo={{ status: 'idle', modelId: DEFAULT_TEXT_MODEL }}
        selectedModelId={DEFAULT_TEXT_MODEL}
        onSelectModel={handleSelect}
        onLoadModel={handleLoad}
        isOnline={true}
        isCached={true}
      />
    )

    expect(screen.getByText(/Cached on device \(0 MB download\)/i)).toBeInTheDocument()
    const loadCacheButton = screen.getByRole('button', { name: /Load from Local Cache/i })
    fireEvent.click(loadCacheButton)
    expect(handleLoad).toHaveBeenCalled()
    unmount()
  })
})

describe('DiagnosticsPanel', () => {
  it('renders collapsed by default and expands upon click', () => {
    const diagnostics = {
      capability: {
        hasWebGpu: true,
        hasWasm: true,
        tier: 'high' as const,
        hardwareConcurrency: 8,
        isOnline: true,
        isSupported: true,
        browserEnv: 'Browser',
        notes: ['WebGPU is active'],
      },
      activeModel: DEFAULT_TEXT_MODEL,
      modelStatus: 'ready' as const,
      modelSizeApprox: '~350 MB',
      lastInferenceDurationMs: 80,
      lastAction: 'improve',
      offlineCached: true,
      errorMessage: null,
      logs: [],
    }

    const { unmount } = render(<DiagnosticsPanel diagnostics={diagnostics} />)

    expect(screen.getByText(/Lab Diagnostics & System Capability/)).toBeInTheDocument()
    expect(screen.queryByText(/WebGPU Acceleration/)).not.toBeInTheDocument()

    // Expand panel
    fireEvent.click(screen.getByRole('button', { name: /Lab Diagnostics/i }))
    expect(screen.getByText('WebGPU Acceleration')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
    unmount()
  })
})

describe('UnsupportedDeviceState', () => {
  it('renders unsupported explanation', () => {
    const { unmount } = render(<UnsupportedDeviceState reason="Custom unsupported reason" />)
    expect(screen.getByText('Local Inference Not Supported')).toBeInTheDocument()
    expect(screen.getByText('Custom unsupported reason')).toBeInTheDocument()
    unmount()
  })
})
