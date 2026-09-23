import { useState } from 'react'
import {
  WrenchScrewdriverIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import type { DiagnosticsInfo } from '../../../intelligence/types'

export interface DiagnosticsPanelProps {
  diagnostics: DiagnosticsInfo
}

export function DiagnosticsPanel({ diagnostics }: DiagnosticsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { capability, activeModel, modelStatus, modelSizeApprox, lastInferenceDurationMs, offlineCached } = diagnostics

  return (
    <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-3.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <WrenchScrewdriverIcon className="w-4 h-4 text-slate-500" />
          <span className="font-semibold text-xs">Lab Diagnostics & System Capability</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500">
            {capability.hasWebGpu ? 'WebGPU' : 'WASM'} • {capability.tier.toUpperCase()} Tier •{' '}
            {capability.isOnline ? 'Online' : 'Offline'}
          </span>
          {isOpen ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-2 flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
            <div className="flex flex-col gap-0.5 p-2 rounded bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500">WebGPU Acceleration</span>
              <div className="flex items-center gap-1 font-medium">
                {capability.hasWebGpu ? (
                  <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <XCircleIcon className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{capability.hasWebGpu ? 'Available' : 'Unavailable (WASM fallback)'}</span>
              </div>
            </div>

            <div className="flex flex-col gap-0.5 p-2 rounded bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500">WASM Runtime</span>
              <div className="flex items-center gap-1 font-medium">
                {capability.hasWasm ? (
                  <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <XCircleIcon className="w-3.5 h-3.5 text-rose-500" />
                )}
                <span>{capability.hasWasm ? 'Operational' : 'Unavailable'}</span>
              </div>
            </div>

            <div className="flex flex-col gap-0.5 p-2 rounded bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500">Hardware Profile</span>
              <span className="font-medium">
                {capability.hardwareConcurrency} cores
                {capability.deviceMemoryGb ? ` • ~${capability.deviceMemoryGb}GB RAM` : ''}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 p-2 rounded bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500">Device Tier</span>
              <span className="font-medium capitalize text-primary">{capability.tier} capability</span>
            </div>

            <div className="flex flex-col gap-0.5 p-2 rounded bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500">Active Model</span>
              <span className="font-medium truncate" title={activeModel}>
                {activeModel}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 p-2 rounded bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500">Model Download Size</span>
              <span className="font-medium">{modelSizeApprox}</span>
            </div>

            <div className="flex flex-col gap-0.5 p-2 rounded bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500">Model Status</span>
              <span className="font-medium capitalize">{modelStatus}</span>
            </div>

            <div className="flex flex-col gap-0.5 p-2 rounded bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500">Last Latency</span>
              <span className="font-medium">
                {lastInferenceDurationMs !== null ? `${lastInferenceDurationMs}ms` : 'None'}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 p-2 rounded bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500">Connectivity</span>
              <span className="font-medium">{capability.isOnline ? 'Online' : 'Offline'}</span>
            </div>

            <div className="flex flex-col gap-0.5 p-2 rounded bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500">Offline Cache Ready</span>
              <span className="font-medium">{offlineCached ? 'Yes (Cached)' : 'No (Requires init)'}</span>
            </div>
          </div>

          {/* Technical Diagnostics Logs */}
          <div className="flex flex-col gap-1 pt-1">
            <span className="text-[11px] font-medium text-slate-500">Capability Notes & Activity Log:</span>
            <div className="max-h-28 overflow-y-auto p-2 bg-slate-900 text-slate-200 rounded font-mono text-[11px] leading-relaxed">
              {capability.notes.map((note, i) => (
                <div key={i} className="text-emerald-400">
                  [CAPABILITY] {note}
                </div>
              ))}
              {diagnostics.logs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.level === 'error'
                      ? 'text-rose-400'
                      : l.level === 'warn'
                      ? 'text-amber-400'
                      : 'text-slate-300'
                  }
                >
                  [{l.timestamp}] [{l.level.toUpperCase()}] {l.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
