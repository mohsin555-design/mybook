import {
  ArrowPathIcon,
  EllipsisHorizontalIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { useState } from 'react'

import { AppButton } from '../components/common/AppButton'
import { ConfirmationModal } from '../components/common/ConfirmationModal'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorState } from '../components/common/ErrorState'
import { IconButton } from '../components/common/IconButton'
import { LoadingState } from '../components/common/LoadingState'
import { MobileBottomSheet } from '../components/common/MobileBottomSheet'
import { PageHeader } from '../components/common/PageHeader'
import { SearchInput } from '../components/common/SearchInput'
import { SyncStatusBadge } from '../components/common/SyncStatusBadge'
import { FileCard } from '../components/files/FileCard'
import { FolderCard } from '../components/files/FolderCard'

export function DesignSystemPage() {
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <PageHeader
        eyebrow="Temporary review page"
        title="MyBook design system"
        description="Reusable patterns for a quiet, reading-focused workspace."
        actions={<AppButton variant="primary"><PlusIcon className="size-5" />New file</AppButton>}
      />

      {message ? <p role="status" className="rounded-xl bg-success-soft px-4 py-3 text-base text-success-soft-foreground">{message}</p> : null}

      <PreviewSection title="Actions">
        <div className="flex flex-wrap gap-2">
          <AppButton variant="primary">Primary</AppButton>
          <AppButton variant="secondary">Secondary</AppButton>
          <AppButton variant="ghost">Ghost</AppButton>
          <IconButton label="More file actions" variant="ghost"><EllipsisHorizontalIcon className="size-6" /></IconButton>
        </div>
      </PreviewSection>

      <PreviewSection title="Search and status">
        <SearchInput label="Search files" placeholder="Search files and folders" value={query} onChange={setQuery} />
        <div className="flex flex-wrap gap-2">
          <SyncStatusBadge status="backed-up" />
          <SyncStatusBadge status="backing-up" />
          <SyncStatusBadge status="failed" />
        </div>
      </PreviewSection>

      <PreviewSection title="Files and folders">
        <div className="grid gap-3 sm:grid-cols-2">
          <FolderCard name="Project notes" itemCount={8} />
          <FolderCard name="Reading list" itemCount={1} />
          <FileCard name="Product brief" meta="Edited 12 minutes ago" action={<IconButton label="More actions for Product brief" variant="ghost"><EllipsisHorizontalIcon className="size-5" /></IconButton>} />
          <FileCard name="Research notes" meta="Document · 3 pages" />
        </div>
      </PreviewSection>

      <PreviewSection title="Feedback states">
        <EmptyState title="No notes yet" description="Create a note to capture your first idea." action={<AppButton variant="primary">Create note</AppButton>} />
        <LoadingState rows={2} />
        <ErrorState message="We could not load your recent files." action={<AppButton variant="secondary"><ArrowPathIcon className="size-5" />Try again</AppButton>} />
      </PreviewSection>

      <PreviewSection title="Overlays">
        <div className="flex flex-wrap gap-2">
          <ConfirmationModal
            trigger={<AppButton variant="danger"><TrashIcon className="size-5" />Delete file</AppButton>}
            title="Delete this file?"
            description="This action cannot be undone. The file will be permanently removed."
            confirmLabel="Delete"
            onConfirm={() => setMessage('File deleted in preview')}
          />
          <MobileBottomSheet
            trigger="Open bottom sheet"
            triggerClassName="button button--secondary px-4"
            title="File actions"
            footer={<AppButton fullWidth variant="primary">Done</AppButton>}
          >
            <p>Move, rename, share, or archive this file. This sheet is optimized for comfortable one-handed use.</p>
          </MobileBottomSheet>
        </div>
      </PreviewSection>
    </div>
  )
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`section-${title.toLowerCase().replaceAll(' ', '-')}`} className="space-y-4 border-t border-[var(--app-border)] pt-6">
      <h2 id={`section-${title.toLowerCase().replaceAll(' ', '-')}`} className="text-lg font-semibold leading-7">{title}</h2>
      {children}
    </section>
  )
}
