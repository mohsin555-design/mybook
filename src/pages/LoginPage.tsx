import {
  BookOpenIcon,
  ExclamationCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { authApiUrl, getAuthConfigError, isBackendAuthEnabled, useAuthStore } from '../stores/useAuthStore'
import { loadGoogleIdentity } from '../utils/googleIdentity'
import { getSafeReturnPath } from '../utils/navigation'

interface LoginLocationState {
  from?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const { clearError, error, isLoading, completeLogin } = useAuthStore()
  const destination = getSafeReturnPath((location.state as LoginLocationState | null)?.from)
  const queryError = new URLSearchParams(location.search).get('error')
  const configError = getAuthConfigError()

  useEffect(() => {
    clearError()
  }, [clearError])

  useEffect(() => {
    let active = true
    const render = async () => {
      try {
        if (configError || isBackendAuthEnabled) return
        await loadGoogleIdentity()
        const google = window.google
        if (!active || !google?.accounts?.id || !googleButtonRef.current) return

        google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '',
          callback: (response) => {
            if (!response.credential) {
              return
            }
            void completeLogin(response.credential, '').then((succeeded) => {
              if (succeeded) navigate(destination, { replace: true })
            })
          },
        })

        googleButtonRef.current.innerHTML = ''
        google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'signin_with',
          shape: 'rectangular',
          width: 280,
        })
      } catch {
        // The visible error state already explains missing config or auth issues.
      }
    }

    void render()
    return () => {
      active = false
    }
  }, [completeLogin, configError, destination, navigate])

  const startBackendLogin = () => {
    window.location.assign(`${authApiUrl('/google/start')}?returnTo=${encodeURIComponent(destination)}`)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))] text-foreground sm:px-6">
      <section className="w-full max-w-sm" aria-labelledby="login-title">
        <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
          <BookOpenIcon aria-hidden="true" className="size-7" />
        </div>
        <h1 id="login-title" className="text-2xl font-semibold leading-8">
          MyBook
        </h1>
        <p className="mt-2 text-base leading-7 text-muted">
          Your private documents and spreadsheets, backed up to your Drive.
        </p>

        {error || queryError ? (
          <div role="alert" className="mt-6 flex gap-2 rounded-xl border border-danger/40 bg-danger-soft p-3 text-sm leading-5 text-danger-soft-foreground">
            <ExclamationCircleIcon aria-hidden="true" className="size-5 shrink-0" />
            <span>{error ?? queryError}</span>
          </div>
        ) : null}

        <div className="mt-7 flex justify-center">
          {isBackendAuthEnabled ? (
            <button
              type="button"
              onClick={startBackendLogin}
              className="min-h-11 rounded-[var(--radius-control)] bg-accent px-5 text-base font-semibold text-accent-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Continue with Google
            </button>
          ) : (
            <div ref={googleButtonRef} />
          )}
        </div>

        {isLoading ? <p className="mt-3 text-center text-sm text-muted">Signing in...</p> : null}
        {configError ? <p role="alert" className="mt-3 text-center text-sm text-warning-soft-foreground">Google sign-in is not configured.</p> : null}

        <p aria-live="polite" className="sr-only">
          {isLoading ? 'Signing in to MyBook' : error ?? queryError ?? ''}
        </p>

        <div className="mt-6 flex items-start gap-3 border-t border-[var(--app-border)] pt-5">
          <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
          <p className="text-sm leading-6 text-muted">
            Your files will be stored in your own Google Drive. MyBook will only
            request access needed to manage files you create here.
          </p>
        </div>
        {configError ? (
          <p role="alert" className="mt-4 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-warning-soft-foreground">
            {configError}
          </p>
        ) : null}
      </section>
    </main>
  )
}
