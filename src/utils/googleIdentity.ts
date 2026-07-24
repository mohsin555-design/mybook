const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let gisPromise: Promise<void> | null = null

export function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  if (gisPromise) return gisPromise

  gisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Google Identity Services could not be loaded.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Identity Services could not be loaded.'))
    document.head.appendChild(script)
  })

  return gisPromise
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1]
  if (!payload) throw new Error('The Google sign-in response was invalid.')
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return JSON.parse(atob(padded)) as Record<string, unknown>
}
