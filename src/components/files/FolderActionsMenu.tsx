import { EllipsisHorizontalIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Dropdown } from '@heroui/react'

interface FolderActionsMenuProps {
  folderName: string
  onRename: () => void
  onDelete: () => void
}

export function FolderActionsMenu({ folderName, onRename, onDelete }: FolderActionsMenuProps) {
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label={`Actions for ${folderName}`} className="flex size-9 items-center justify-center rounded-full text-muted">
        <EllipsisHorizontalIcon aria-hidden="true" className="size-4" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={`Actions for ${folderName}`} onAction={(key) => key === 'rename' ? onRename() : onDelete()}>
          <Dropdown.Item id="rename"><PencilSquareIcon aria-hidden="true" className="size-5" />Rename</Dropdown.Item>
          <Dropdown.Item id="delete" variant="danger"><TrashIcon aria-hidden="true" className="size-5" />Delete</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
