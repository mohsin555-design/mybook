import { EllipsisHorizontalIcon, FolderArrowDownIcon, PencilSquareIcon, StarIcon as StarOutlineIcon, TrashIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid'
import { Dropdown } from '../ui/compat-dropdown'

import type { MyBookFolder } from '../../types/files'

interface FolderActionsMenuProps {
  folderName: string
  folders: MyBookFolder[]
  folderId: string
  currentParentId: string | null
  isFavorite?: boolean
  onRename: () => void
  onMove: (folderId: string | null) => void
  onToggleFavorite?: () => void
  onDelete: () => void
}

export function FolderActionsMenu({ folderName, folders, folderId, currentParentId, isFavorite = false, onRename, onMove, onToggleFavorite, onDelete }: FolderActionsMenuProps) {
  const FavoriteIcon = isFavorite ? StarSolidIcon : StarOutlineIcon
  const descendants = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const folder of folders) {
      if ((folder.parentId === folderId || (folder.parentId && descendants.has(folder.parentId))) && !descendants.has(folder.id)) {
        descendants.add(folder.id)
        changed = true
      }
    }
  }
  const destinations = folders.filter((folder) => folder.id !== folderId && folder.id !== currentParentId && !descendants.has(folder.id))

  return (
    <Dropdown>
      <Dropdown.Trigger aria-label={`Actions for ${folderName}`} className="flex size-9 items-center justify-center rounded-full text-muted-foreground">
        <EllipsisHorizontalIcon aria-hidden="true" className="size-4" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={`Actions for ${folderName}`} onAction={(key) => {
          const action = String(key)
          if (action === 'rename') onRename()
          else if (action === 'favorite') onToggleFavorite?.()
          else if (action === 'delete') onDelete()
          else if (action === 'root') onMove(null)
          else if (action.startsWith('move:')) onMove(action.slice(5))
        }}>
          <Dropdown.Item id="rename"><PencilSquareIcon aria-hidden="true" className="size-5" />Rename</Dropdown.Item>
          {onToggleFavorite ? <Dropdown.Item id="favorite" aria-label={`${isFavorite ? 'Remove from' : 'Add to'} favorites`}><FavoriteIcon aria-hidden="true" className="size-5" />{isFavorite ? 'Remove from favorites' : 'Add to favorites'}</Dropdown.Item> : null}
          {currentParentId ? <Dropdown.Item id="root"><FolderArrowDownIcon aria-hidden="true" className="size-5" />Move to MyBook root</Dropdown.Item> : null}
          {destinations.map((folder) => <Dropdown.Item key={folder.id} id={`move:${folder.id}`}><FolderArrowDownIcon aria-hidden="true" className="size-5" />Move to {folder.name}</Dropdown.Item>)}
          <Dropdown.Item id="delete" variant="danger"><TrashIcon aria-hidden="true" className="size-5" />Delete</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
