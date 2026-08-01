import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { fileRepository } from '../../database/repositories'
import type { FileType } from '../../types/files'
import { MobileBottomSheet } from '../common/MobileBottomSheet'

interface CreateItemDrawerProps {
  folderId: string | null
  onCreateFolder: () => void
}

export function CreateItemDrawer({ folderId, onCreateFolder }: CreateItemDrawerProps) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  const createFile = async (type: FileType) => {
    setIsOpen(false)
    const result = await fileRepository.create(type, folderId)
    if (result.data) navigate(`/${type}/${result.data.id}`)
  }

  const createFolder = () => {
    setIsOpen(false)
    onCreateFolder()
  }

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      trigger={<img src="/icons/pencil-to-square.svg" alt="" aria-hidden="true" className="size-4" />}
      triggerLabel="Create new"
      triggerClassName="fixed bottom-[calc(7.4rem+env(safe-area-inset-bottom))] right-4 z-20 flex !size-10 !min-h-10 !min-w-10 items-center justify-center !rounded-full bg-accent p-0 text-accent-foreground shadow-[0_8px_20px_rgba(17,24,39,0.2)] lg:bottom-8 lg:right-8"
      title="Create new"
    >
      <div role="menu" aria-label="Create options" className="space-y-1 pb-[env(safe-area-inset-bottom)]">
        <CreateOption iconSrc="/icons/file.svg" label="New document" onSelect={() => void createFile('document')} />
        <CreateOption iconSrc="/icons/sheet.svg" label="New spreadsheet" onSelect={() => void createFile('spreadsheet')} />
        <CreateOption iconSrc="/icons/folder.svg" label="New folder" onSelect={createFolder} />
      </div>
    </MobileBottomSheet>
  )
}

interface CreateOptionProps {
  iconSrc: string
  label: string
  onSelect: () => void
}

function CreateOption({ iconSrc, label, onSelect }: CreateOptionProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-default"
    >
      <img src={iconSrc} alt="" aria-hidden="true" className="size-5" />
      {label}
    </button>
  )
}
