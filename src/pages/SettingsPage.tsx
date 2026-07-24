import { ArrowRightStartOnRectangleIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppButton } from '../components/common/AppButton'
import { PageHeader } from '../components/common/PageHeader'
import { useDriveBootstrap } from '../hooks/useDriveBootstrap'
import { getDriveFolderStatus, openMyBookFolderInDrive } from '../services/googleDrive'
import { useAuthStore } from '../stores/useAuthStore'

export function SettingsPage() {
  const { email, logout, reconnect } = useAuthStore()
  const navigate = useNavigate()
  const { isPreparing, statusMessage, folderId } = useDriveBootstrap()
  const [storedFolderId, setStoredFolderId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      const id = await getDriveFolderStatus()
      if (active) setStoredFolderId(id)
    }
    void load()
    return () => { active = false }
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your MyBook preferences and account session."
      />
      <section aria-labelledby="account-heading" className="border-t border-[var(--app-border)] pt-6">
        <h2 id="account-heading" className="text-lg font-semibold leading-7">Account</h2>
        <p className="mt-1 text-base leading-7 text-muted">
          {email ? `Signed in as ${email}.` : 'Your Google session will appear here after sign-in.'}
        </p>
        <AppButton className="mt-4" variant="secondary" onPress={() => void logout()}>
          <ArrowRightStartOnRectangleIcon aria-hidden="true" className="size-5" />
          Log out
        </AppButton>
      </section>
      <section aria-labelledby="drive-heading" className="border-t border-[var(--app-border)] pt-6">
        <h2 id="drive-heading" className="text-lg font-semibold leading-7">Google Drive</h2>
        <p className="mt-1 text-base leading-7 text-muted">
          {isPreparing
            ? 'Checking your MyBook Drive folder...'
            : storedFolderId
              ? 'MyBook folder is connected.'
              : 'MyBook folder is not connected yet.'}
        </p>
        <p className="mt-1 text-sm text-muted">
          {statusMessage ?? 'MyBook stores the folder ID locally and backfills existing folders into Drive after login.'}
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
      </section>
      <section aria-labelledby="files-heading" className="border-t border-[var(--app-border)] pt-6">
        <h2 id="files-heading" className="text-lg font-semibold leading-7">Files</h2>
        <AppButton className="mt-4" variant="secondary" onPress={() => navigate('/trash')}><TrashIcon aria-hidden="true" className="size-5" />Open Trash</AppButton>
      </section>
    </div>
  )
}
