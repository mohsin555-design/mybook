import type { Meta, StoryObj } from '@storybook/react'
import { LocalModelStatusCard } from './LocalModelStatusCard'
import { IntelligenceActionToolbar } from './IntelligenceActionToolbar'
import { WritingResultPreview } from './WritingResultPreview'
import { ClassificationDemoCard } from './ClassificationDemoCard'
import { EmbeddingSimilarityDemoCard } from './EmbeddingSimilarityDemoCard'
import { OcrImageToBlocksCard } from './OcrImageToBlocksCard'
import { DiagnosticsPanel } from './DiagnosticsPanel'
import { UnsupportedDeviceState } from './UnsupportedDeviceState'
import { DEFAULT_TEXT_MODEL } from '../../../intelligence/config'

const meta: Meta = {
  title: 'Labs/Intelligence/Components',
  parameters: {
    layout: 'padded',
  },
}

export default meta

export const ModelStatusIdle: StoryObj<typeof LocalModelStatusCard> = {
  render: () => (
    <LocalModelStatusCard
      progressInfo={{ status: 'idle', modelId: DEFAULT_TEXT_MODEL }}
      selectedModelId={DEFAULT_TEXT_MODEL}
      onSelectModel={() => {}}
      onLoadModel={() => {}}
      isOnline={true}
    />
  ),
}

export const ModelStatusDownloading: StoryObj<typeof LocalModelStatusCard> = {
  render: () => (
    <LocalModelStatusCard
      progressInfo={{
        status: 'downloading',
        progress: 68,
        message: 'Downloading model weights (68%)...',
        modelId: DEFAULT_TEXT_MODEL,
      }}
      selectedModelId={DEFAULT_TEXT_MODEL}
      onSelectModel={() => {}}
      onLoadModel={() => {}}
      isOnline={true}
    />
  ),
}

export const ModelStatusReady: StoryObj<typeof LocalModelStatusCard> = {
  render: () => (
    <LocalModelStatusCard
      progressInfo={{
        status: 'ready',
        progress: 100,
        message: 'Ready for local inference',
        modelId: DEFAULT_TEXT_MODEL,
      }}
      selectedModelId={DEFAULT_TEXT_MODEL}
      onSelectModel={() => {}}
      onLoadModel={() => {}}
      isOnline={true}
    />
  ),
}

export const ActionToolbar: StoryObj<typeof IntelligenceActionToolbar> = {
  render: () => (
    <IntelligenceActionToolbar
      onActionClick={() => {}}
      hasSelection={true}
      isLoading={false}
    />
  ),
}

export const ActionToolbarLoading: StoryObj<typeof IntelligenceActionToolbar> = {
  render: () => (
    <IntelligenceActionToolbar
      onActionClick={() => {}}
      hasSelection={true}
      isLoading={true}
      currentAction="summarize"
    />
  ),
}

export const ResultPreview: StoryObj<typeof WritingResultPreview> = {
  render: () => (
    <WritingResultPreview
      result={{
        action: 'improve',
        originalText: 'In order to make things better we gotta test this.',
        transformedText: 'To enhance overall quality and performance, we must rigorously evaluate this workflow.',
        durationMs: 145,
        modelUsed: 'Qwen 2.5 0.5B Instruct',
      }}
      onReplace={() => {}}
      onInsertBelow={() => {}}
      onRetry={() => {}}
      onCancel={() => {}}
    />
  ),
}

export const ClassificationDemo: StoryObj<typeof ClassificationDemoCard> = {
  render: () => <ClassificationDemoCard selectedEditorText="Schedule standup meeting at 10am" />,
}

export const EmbeddingSimilarityDemo: StoryObj<typeof EmbeddingSimilarityDemoCard> = {
  render: () => <EmbeddingSimilarityDemoCard selectedEditorText="WebGPU compute acceleration" />,
}

export const OcrConverterCard: StoryObj<typeof OcrImageToBlocksCard> = {
  render: () => <OcrImageToBlocksCard />,
}

export const DiagnosticsPanelOpen: StoryObj<typeof DiagnosticsPanel> = {
  render: () => (
    <DiagnosticsPanel
      diagnostics={{
        capability: {
          hasWebGpu: true,
          hasWasm: true,
          tier: 'high',
          hardwareConcurrency: 8,
          deviceMemoryGb: 16,
          isOnline: true,
          isSupported: true,
          browserEnv: 'Chromium-based',
          notes: ['WebGPU hardware acceleration is available', 'WebAssembly runtime is available'],
        },
        activeModel: DEFAULT_TEXT_MODEL,
        modelStatus: 'ready',
        modelSizeApprox: '~350 MB',
        lastInferenceDurationMs: 124,
        lastAction: 'improve',
        offlineCached: true,
        errorMessage: null,
        logs: [
          { timestamp: '10:00:01', level: 'info', message: 'Initialized Web Worker' },
          { timestamp: '10:00:02', level: 'info', message: 'Model ready in WebGPU' },
        ],
      }}
    />
  ),
}

export const UnsupportedDevice: StoryObj<typeof UnsupportedDeviceState> = {
  render: () => <UnsupportedDeviceState />,
}
