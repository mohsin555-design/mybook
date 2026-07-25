export function devLog(level: 'warn' | 'error', message: string, error?: unknown) {
  if (!import.meta.env.DEV) return
  const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined
  console[level](detail ? `${message}: ${detail}` : message)
}
