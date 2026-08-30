import {
  BookOpenIcon,
  ExclamationCircleIcon,
  FolderOpenIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { authApiUrl, getAuthConfigError, isBackendAuthEnabled, useAuthStore } from '../stores/useAuthStore'
import {
  canPickDeviceDirectory,
  initializeLocalWorkspace,
  pickLocalWorkspaceDirectory,
  type LocalWorkspaceStoragePreference,
  type PickedLocalWorkspaceDirectory,
} from '../services/localWorkspace'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { loadGoogleIdentity } from '../utils/googleIdentity'
import { getSafeReturnPath } from '../utils/navigation'

interface LoginLocationState {
  from?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const [isLocalSetupOpen, setIsLocalSetupOpen] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('My Workspace')
  const [storagePreference, setStoragePreference] = useState<LocalWorkspaceStoragePreference>('private')
  const [selectedDirectory, setSelectedDirectory] = useState<PickedLocalWorkspaceDirectory | null>(null)
  const [localSetupError, setLocalSetupError] = useState<string | null>(null)
  const [isPickingDirectory, setIsPickingDirectory] = useState(false)
  const [isCreatingLocalWorkspace, setIsCreatingLocalWorkspace] = useState(false)
  const { clearError, error, isLoading, completeLogin } = useAuthStore()
  const { createLocalWorkspace, selectGoogleWorkspace } = useWorkspaceStore()
  const destination = getSafeReturnPath((location.state as LoginLocationState | null)?.from)
  const queryError = new URLSearchParams(location.search).get('error')
  const configError = getAuthConfigError()
  const supportsDeviceFolder = useMemo(() => canPickDeviceDirectory(), [])

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
              if (succeeded) {
                selectGoogleWorkspace()
                navigate(destination, { replace: true })
              }
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
  }, [completeLogin, configError, destination, navigate, selectGoogleWorkspace])

  const startBackendLogin = () => {
    selectGoogleWorkspace()
    window.location.assign(`${authApiUrl('/google/start')}?returnTo=${encodeURIComponent(destination)}`)
  }

  useEffect(() => {
    setStoragePreference(supportsDeviceFolder ? 'file-system' : 'private')
  }, [supportsDeviceFolder])

  const openLocalSetup = () => {
    setLocalSetupError(null)
    setIsLocalSetupOpen(true)
  }

  const browseLocalFolder = async () => {
    setStoragePreference('file-system')
    setLocalSetupError(null)
    setIsPickingDirectory(true)
    try {
      const directory = await pickLocalWorkspaceDirectory()
      if (!directory) {
        setLocalSetupError('Choose a folder to create a device-folder workspace.')
        return
      }
      setSelectedDirectory(directory)
    } finally {
      setIsPickingDirectory(false)
    }
  }

  const startLocalWorkspace = async () => {
    const name = workspaceName.trim() || 'My Workspace'
    if (storagePreference === 'file-system' && !selectedDirectory) {
      setLocalSetupError('Choose a folder before creating this workspace, or use private app storage.')
      return
    }
    setIsCreatingLocalWorkspace(true)
    setLocalSetupError(null)
    const result = await initializeLocalWorkspace({
      name,
      storagePreference,
      allowPrivateFallback: storagePreference !== 'file-system',
      directoryHandle: selectedDirectory?.handle,
    })
    if ('cancelled' in result && result.cancelled) {
      setLocalSetupError('Choose a folder to create a device-folder workspace, or switch to private app storage.')
      setIsCreatingLocalWorkspace(false)
      return
    }
    createLocalWorkspace()
    navigate('/home', { replace: true })
  }

  return (
    <main className="flex h-full min-h-0 items-center justify-center overflow-y-auto overscroll-contain bg-background px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))] text-foreground sm:px-6">
      <section className="w-full max-w-sm" aria-labelledby="login-title">
        <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BookOpenIcon aria-hidden="true" className="size-7" />
        </div>
        <h1 id="login-title" className="text-2xl font-semibold leading-8">
          MyBook
        </h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          Your private documents and spreadsheets, on this device or backed up to your Drive.
        </p>

        {error || queryError ? (
          <div role="alert" className="mt-6 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm leading-5 text-destructive">
            <ExclamationCircleIcon aria-hidden="true" className="size-5 shrink-0" />
            <span>{error ?? queryError}</span>
          </div>
        ) : null}

        <div className="mt-7 grid gap-3">
          <button
            type="button"
            onClick={openLocalSetup}
            className="min-h-11 rounded-[var(--radius-control)] bg-foreground px-5 text-base font-semibold text-background transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Create Local Workspace
          </button>
          {isBackendAuthEnabled ? (
            <button
              type="button"
              onClick={startBackendLogin}
              className="min-h-11 rounded-[var(--radius-control)] bg-primary px-5 text-base font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Continue with Google
            </button>
          ) : (
            <div className="flex justify-center" ref={googleButtonRef} />
          )}
        </div>

        {isLoading ? <p className="mt-3 text-center text-sm text-muted-foreground">Signing in...</p> : null}
        {configError ? <p role="alert" className="mt-3 text-center text-sm text-yellow-700">Google sign-in is not configured.</p> : null}

        <p aria-live="polite" className="sr-only">
          {isLoading ? 'Signing in to MyBook' : error ?? queryError ?? ''}
        </p>

        <div className="mt-6 flex items-start gap-3 border-t border-[var(--app-border)] pt-5">
          <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <p className="text-sm leading-6 text-muted-foreground">
            Local workspaces stay on this device. Google workspaces use your own Drive and only
            request access needed to manage files you create here.
          </p>
        </div>
        {configError ? (
          <p role="alert" className="mt-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700">
            {configError}
          </p>
        ) : null}
      </section>

      {isLocalSetupOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 px-3 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] sm:items-center sm:justify-center sm:p-6" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="local-workspace-title"
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--app-border)] bg-background p-5 shadow-xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FolderOpenIcon aria-hidden="true" className="size-6" />
              </div>
              <div>
                <h2 id="local-workspace-title" className="text-lg font-semibold leading-7">
                  Create local workspace
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Choose where this device should keep your Writin files.
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Local workspaces are tied to this browser unless you choose the same device folder again on a supported browser. Use Google Drive when you need the same files everywhere.
                </p>
              </div>
            </div>

            <label htmlFor="workspace-name" className="mt-5 block text-sm font-medium text-foreground">
              Workspace name
            </label>
            <input
              id="workspace-name"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              className="mt-2 h-11 w-full rounded-[var(--radius-control)] border border-[var(--app-border)] bg-background px-3 text-base outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              placeholder="My Workspace"
            />

            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-foreground">Storage location</legend>
              <div className="mt-2 grid gap-3">
                <label
                  className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition ${supportsDeviceFolder ? 'border-[var(--app-border)] hover:border-[var(--accent)]/60' : 'cursor-not-allowed border-[var(--app-border)] bg-muted/40 opacity-70'} ${storagePreference === 'file-system' ? 'ring-2 ring-[var(--accent)]/30' : ''}`}
                >
                  <input
                    type="radio"
                    name="local-storage"
                    value="file-system"
                    checked={storagePreference === 'file-system'}
                    disabled={!supportsDeviceFolder}
                    onChange={() => setStoragePreference('file-system')}
                    className="mt-1 size-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">Choose a folder on this device</span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      Best for macOS, Windows, and supported Android browsers. Files stay visible outside the app.
                    </span>
                    {!supportsDeviceFolder ? (
                      <span className="mt-1 block text-xs font-medium text-muted-foreground">
                        Folder selection is not available in this browser.
                      </span>
                    ) : null}
                    {supportsDeviceFolder ? (
                      <span className="mt-4 block border-t border-[var(--app-border)] pt-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault()
                            void browseLocalFolder()
                          }}
                          disabled={isPickingDirectory || isCreatingLocalWorkspace}
                          className="min-h-10 rounded-[var(--radius-control)] border border-[var(--app-border)] px-3 text-sm font-semibold transition hover:bg-muted disabled:opacity-60"
                        >
                          {isPickingDirectory ? 'Opening...' : selectedDirectory ? 'Change folder' : 'Browse folder'}
                        </button>
                        <span className="mt-2 block text-xs font-medium text-muted-foreground">
                          {selectedDirectory ? `Selected folder: ${selectedDirectory.name}` : 'No folder selected yet.'}
                        </span>
                      </span>
                    ) : null}
                  </span>
                </label>

                <label className={`flex cursor-pointer gap-3 rounded-lg border border-[var(--app-border)] p-4 transition hover:border-[var(--accent)]/60 ${storagePreference === 'private' ? 'ring-2 ring-[var(--accent)]/30' : ''}`}>
                  <input
                    type="radio"
                    name="local-storage"
                    value="private"
                    checked={storagePreference === 'private'}
                    onChange={() => setStoragePreference('private')}
                    className="mt-1 size-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">Use private app storage</span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      Works across devices including iPhone and iPad. Export backups or connect Drive to protect local-only work.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            {localSetupError ? (
              <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {localSetupError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsLocalSetupOpen(false)}
                disabled={isCreatingLocalWorkspace}
                className="min-h-11 rounded-[var(--radius-control)] border border-[var(--app-border)] px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void startLocalWorkspace()}
                disabled={isCreatingLocalWorkspace}
                className="min-h-11 rounded-[var(--radius-control)] bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-60"
              >
                {isCreatingLocalWorkspace ? 'Creating...' : 'Create Workspace'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
