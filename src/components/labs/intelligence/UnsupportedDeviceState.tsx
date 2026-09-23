import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export interface UnsupportedDeviceStateProps {
  reason?: string
}

export function UnsupportedDeviceState({
  reason = 'Your browser environment does not support WebAssembly or WebGPU hardware execution.',
}: UnsupportedDeviceStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl text-center max-w-lg mx-auto my-8">
      <ExclamationTriangleIcon className="w-10 h-10 text-amber-600 dark:text-amber-400 mb-3" />
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
        Local Inference Not Supported
      </h3>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
        {reason}
      </p>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-left w-full">
        <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
          Minimum System Requirements:
        </span>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Modern browser (Chrome 113+, Edge 113+, Firefox 120+, Safari 17.4+)</li>
          <li>WebAssembly runtime enabled</li>
          <li>WebGPU for hardware acceleration (optional, recommended)</li>
        </ul>
      </div>
    </div>
  )
}
