import { ArrowRightStartOnRectangleIcon, MoonIcon, SunIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'

import { AppButton } from '../components/common/AppButton'
import { PageHeader } from '../components/common/PageHeader'
import { useDriveBootstrap } from '../hooks/useDriveBootstrap'
import { getDriveFolderStatus, openMyBookFolderInDrive } from '../services/googleDrive'
import { useAuthStore } from '../stores/useAuthStore'
import { db } from '../database/db'
import { processPendingDriveFolderSync } from '../database/repositories'
import { APP_VERSION } from '../config/app'
import { useAppStore } from '../stores/useAppStore'

export function SettingsPage() {
  const { email, logout, reconnect } = useAuthStore()
  const { theme, toggleTheme } = useAppStore()
  const navigate = useNavigate()
  const { isPreparing, statusMessage } = useDriveBootstrap()
  const [storedFolderId, setStoredFolderId] = useState<string | null>(null)
  const [databaseStatus, setDatabaseStatus] = useState<'checking' | 'ready' | 'failed'>('checking')
  const files = useLiveQuery(() => db.files.filter((file) => !file.isDeleted).toArray(), [], []) ?? []
  const syncQueue = useLiveQuery(() => db.syncQueue.toArray(), [], []) ?? []
  const backupStats = {
    total: files.length,
    backedUp: files.filter((file) => file.syncStatus === 'backed-up' && Boolean(file.driveFileId)).length,
    pending: files.filter((file) => file.syncStatus === 'pending' || file.syncStatus === 'backing-up' || file.syncStatus === 'offline').length,
    failed: files.filter((file) => file.syncStatus === 'failed').length,
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      const id = await getDriveFolderStatus()
      if (active) setStoredFolderId(id)
    }
    void load()
    return () => { active = false }
  }, [])
  useEffect(() => {
    void db.open().then(() => setDatabaseStatus('ready')).catch(() => setDatabaseStatus('failed'))
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true, state: null })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4">
      <PageHeader
        title="Preferences"
        description="Manage your MyBook preferences and account session."
      />
      <section aria-labelledby="appearance-heading" className="rounded-2xl bg-muted/70 p-4">
        <h2 id="appearance-heading" className="text-base font-semibold leading-6">Appearance</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Choose how MyBook looks on this device.</p>
        <AppButton className="mt-3" variant="secondary" onPress={toggleTheme}>
          {theme === 'light' ? <MoonIcon aria-hidden="true" className="size-5" /> : <SunIcon aria-hidden="true" className="size-5" />}
          Use {theme === 'light' ? 'dark' : 'light'} theme
        </AppButton>
      </section>
      <section aria-labelledby="account-heading" className="rounded-2xl bg-muted/70 p-4">
        <h2 id="account-heading" className="text-base font-semibold leading-6">Account</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {email ? `Signed in as ${email}.` : 'Your Google session will appear here after sign-in.'}
        </p>
        <AppButton className="mt-4" variant="secondary" onPress={() => void handleLogout()}>
          <ArrowRightStartOnRectangleIcon aria-hidden="true" className="size-5" />
          Log out
        </AppButton>
      </section>
      <section aria-labelledby="drive-heading" className="rounded-2xl bg-muted/70 p-4">
        <h2 id="drive-heading" className="text-base font-semibold leading-6">Google Drive</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {isPreparing
            ? 'Checking your MyBook Drive folder...'
            : storedFolderId
              ? 'MyBook folder is connected.'
              : 'MyBook folder is not connected yet.'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {statusMessage ?? 'MyBook syncs your files across signed-in devices using Drive backups.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <AppButton
            variant="secondary"
            isDisabled={!storedFolderId}
            onPress={() => {
              if (storedFolderId) openMyBookFolderInDrive(storedFolderId)
            }}
          >
            Open MyBook folder in Drive
          </AppButton>
          <AppButton variant="secondary" onPress={() => void reconnect()}>
            Reconnect
          </AppButton>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([['Local files', backupStats.total], ['Synced', backupStats.backedUp], ['Syncing', backupStats.pending], ['Sync paused', backupStats.failed]] as const).map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--app-border)] p-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold">{value}</dd></div>)}
        </dl>
        {backupStats.failed > 0 ? <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><p className="font-medium">Sync paused</p>{files.filter((file) => file.syncStatus === 'failed').map((file) => <p key={file.id} className="mt-1 text-muted-foreground">{file.name}: {file.syncError ?? 'Sync failed.'}</p>)}</div> : null}
      </section>
      <section aria-labelledby="files-heading" className="rounded-2xl bg-muted/70 p-4">
        <h2 id="files-heading" className="text-base font-semibold leading-6">Files</h2>
        <AppButton className="mt-4" variant="secondary" onPress={() => navigate('/trash')}><TrashIcon aria-hidden="true" className="size-5" />Open Trash</AppButton>
      </section>
      <section aria-labelledby="privacy-heading" className="rounded-2xl bg-muted/70 p-4">
        <h2 id="privacy-heading" className="text-base font-semibold leading-6">Privacy and personal use</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">MyBook keeps editable files locally in this browser. Google Drive is used only for the visible MyBook folder and file-level backups you request. Access tokens stay in session storage and are never included in links or logs.</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">This application is provided for personal use. Keep independent copies of important information and review Google permissions before connecting an account.</p>
        <p className="mt-4 text-sm text-muted-foreground">MyBook version {APP_VERSION}</p>
      </section>
      <section aria-labelledby="diagnostics-heading" className="rounded-2xl bg-muted/70 p-4">
        <h2 id="diagnostics-heading" className="text-base font-semibold leading-6">Sync diagnostics</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Technical health information for recovery and troubleshooting. Private document content and access tokens are never shown.</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--app-border)] p-3"><dt className="text-sm text-muted-foreground">Local database</dt><dd className="mt-1 font-medium">{databaseStatus === 'ready' ? 'Available' : databaseStatus === 'failed' ? 'Unavailable' : 'Checking…'}</dd></div>
          <div className="rounded-xl border border-[var(--app-border)] p-3"><dt className="text-sm text-muted-foreground">Queued operations</dt><dd className="mt-1 font-medium">{syncQueue.filter((item) => item.status !== 'completed').length}</dd></div>
          <div className="rounded-xl border border-[var(--app-border)] p-3"><dt className="text-sm text-muted-foreground">Failed operations</dt><dd className="mt-1 font-medium">{syncQueue.filter((item) => item.status === 'failed').length}</dd></div>
        </dl>
        {syncQueue.some((item) => item.status === 'failed') ? <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><p className="font-medium">Some Drive operations need attention.</p>{syncQueue.filter((item) => item.status === 'failed').slice(0, 5).map((item) => <p key={item.id} className="mt-1 text-muted-foreground">{item.entityType} {item.operation}: {item.errorMessage ?? 'Retry required.'}</p>)}</div> : null}
        <AppButton className="mt-4" variant="secondary" onPress={() => void processPendingDriveFolderSync()}>Retry Drive sync</AppButton>
      </section>
    </div>
  )
}
