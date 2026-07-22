import { ArrowRightStartOnRectangleIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

import { AppButton } from '../components/common/AppButton'
import { PageHeader } from '../components/common/PageHeader'
import { useAuthStore } from '../stores/useAuthStore'

export function SettingsPage() {
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your MyBook preferences and account session."
      />
      <section aria-labelledby="account-heading" className="border-t border-[var(--app-border)] pt-6">
        <h2 id="account-heading" className="text-lg font-semibold leading-7">Account</h2>
        <p className="mt-1 text-base leading-7 text-muted">You are signed in with a mock account for development.</p>
        <AppButton className="mt-4" variant="secondary" onPress={logout}>
          <ArrowRightStartOnRectangleIcon aria-hidden="true" className="size-5" />
          Log out
        </AppButton>
      </section>
      <section aria-labelledby="files-heading" className="border-t border-[var(--app-border)] pt-6">
        <h2 id="files-heading" className="text-lg font-semibold leading-7">Files</h2>
        <AppButton className="mt-4" variant="secondary" onPress={() => navigate('/trash')}><TrashIcon aria-hidden="true" className="size-5" />Open Trash</AppButton>
      </section>
    </div>
  )
}
