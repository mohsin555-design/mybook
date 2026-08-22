import { ArrowUturnLeftIcon, FolderArrowDownIcon } from '@heroicons/react/24/outline'
import { Dropdown } from '../ui/compat-dropdown'

import type { MyBookFolder } from '../../types/files'

interface MoveFileMenuProps {
  fileName: string
  folders: MyBookFolder[]
  currentFolderId: string | null
  onMove: (folderId: string | null) => void
}

export function MoveFileMenu({ fileName, folders, currentFolderId, onMove }: MoveFileMenuProps) {
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label={`Move ${fileName}`} className="flex size-11 items-center justify-center rounded-[10px]">
        <FolderArrowDownIcon aria-hidden="true" className="size-5" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={`Move ${fileName} to`} onAction={(key) => onMove(key === 'root' ? null : String(key))}>
          {currentFolderId !== null ? (
            <Dropdown.Item id="root"><ArrowUturnLeftIcon aria-hidden="true" className="size-5" />MyBook root</Dropdown.Item>
          ) : null}
          {folders.filter((folder) => folder.id !== currentFolderId).map((folder) => (
            <Dropdown.Item key={folder.id} id={folder.id}>{folder.name}</Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
