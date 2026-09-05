import { DocumentDuplicateIcon, EllipsisHorizontalIcon, FolderArrowDownIcon, PencilSquareIcon, StarIcon as StarOutlineIcon, TrashIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid'
import { Dropdown } from '../ui/compat-dropdown'

import type { MyBookFolder } from '../../types/files'

interface FileActionsMenuProps {
  fileName: string
  folders: MyBookFolder[]
  currentFolderId: string | null
  isFavorite?: boolean
  onRename: () => void
  onDuplicate: () => void
  onMove: (folderId: string | null) => void
  onToggleFavorite?: () => void
  onDelete: () => void
}

export function FileActionsMenu({ fileName, folders, currentFolderId, isFavorite = false, onRename, onDuplicate, onMove, onToggleFavorite, onDelete }: FileActionsMenuProps) {
  const FavoriteIcon = isFavorite ? StarSolidIcon : StarOutlineIcon

  return (
    <Dropdown>
      <Dropdown.Trigger aria-label={`More actions for ${fileName}`} className="flex size-9 items-center justify-center rounded-full text-muted-foreground"><EllipsisHorizontalIcon aria-hidden="true" className="size-4" /></Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={`Actions for ${fileName}`} onAction={(key) => {
          const action = String(key)
          if (action === 'rename') onRename()
          else if (action === 'duplicate') onDuplicate()
          else if (action === 'favorite') onToggleFavorite?.()
          else if (action === 'delete') onDelete()
          else if (action === 'root') onMove(null)
          else if (action.startsWith('move:')) onMove(action.slice(5))
        }}>
          <Dropdown.Item id="rename"><PencilSquareIcon aria-hidden="true" className="size-5" />Rename</Dropdown.Item>
          <Dropdown.Item id="duplicate"><DocumentDuplicateIcon aria-hidden="true" className="size-5" />Duplicate</Dropdown.Item>
          {onToggleFavorite ? <Dropdown.Item id="favorite" aria-label={`${isFavorite ? 'Remove from' : 'Add to'} favorites`}><FavoriteIcon aria-hidden="true" className="size-5" />{isFavorite ? 'Remove from favorites' : 'Add to favorites'}</Dropdown.Item> : null}
          {currentFolderId ? <Dropdown.Item id="root"><FolderArrowDownIcon aria-hidden="true" className="size-5" />Move to MyBook root</Dropdown.Item> : null}
          {folders.filter((folder) => folder.id !== currentFolderId).map((folder) => <Dropdown.Item key={folder.id} id={`move:${folder.id}`}><FolderArrowDownIcon aria-hidden="true" className="size-5" />Move to {folder.name}</Dropdown.Item>)}
          <Dropdown.Item id="delete" variant="danger"><TrashIcon aria-hidden="true" className="size-5" />Move to Trash</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
