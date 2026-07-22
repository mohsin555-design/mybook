import {
  BookOpenIcon,
  ExclamationCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { Spinner } from '@heroui/react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { AppButton } from '../components/common/AppButton'
import { useAuthStore } from '../stores/useAuthStore'

interface LoginLocationState {
  from?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { clearError, error, isLoading, login } = useAuthStore()
  const destination = (location.state as LoginLocationState | null)?.from ?? '/home'

  useEffect(() => {
    clearError()
  }, [clearError])

  const handleLogin = async () => {
    const succeeded = await login()
    if (succeeded) navigate(destination, { replace: true })
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

        {error ? (
          <div role="alert" className="mt-6 flex gap-2 rounded-xl border border-danger/40 bg-danger-soft p-3 text-sm leading-5 text-danger-soft-foreground">
            <ExclamationCircleIcon aria-hidden="true" className="size-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <AppButton
          fullWidth
          className="mt-7"
          variant="primary"
          isDisabled={isLoading}
          onPress={handleLogin}
          aria-label="Continue with Google"
        >
          {isLoading ? <Spinner size="sm" aria-hidden="true" /> : null}
          {isLoading ? 'Signing in...' : 'Continue with Google'}
        </AppButton>

        <p aria-live="polite" className="sr-only">
          {isLoading ? 'Signing in to MyBook' : error ?? ''}
        </p>

        <div className="mt-6 flex items-start gap-3 border-t border-[var(--app-border)] pt-5">
          <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
          <p className="text-sm leading-6 text-muted">
            Your files will be stored in your own Google Drive. MyBook will only
            request access needed to manage files you create here.
          </p>
        </div>
      </section>
    </main>
  )
}
