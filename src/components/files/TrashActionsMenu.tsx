import { ArrowUturnLeftIcon, EllipsisHorizontalIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Dropdown } from '../ui/compat-dropdown'

export function TrashActionsMenu({ fileName, itemKind = 'file', onRestore, onDelete }: { fileName: string; itemKind?: 'file' | 'folder'; onRestore: () => void; onDelete: () => void }) {
  return <Dropdown><Dropdown.Trigger aria-label={`More actions for ${fileName}`} className="flex size-11 items-center justify-center rounded-[10px]"><EllipsisHorizontalIcon aria-hidden="true" className="size-6" /></Dropdown.Trigger><Dropdown.Popover placement="bottom end"><Dropdown.Menu aria-label={`Trash actions for ${fileName}`} onAction={(key) => key === 'restore' ? onRestore() : onDelete()}><Dropdown.Item id="restore" aria-label={`Restore ${itemKind} ${fileName}`}><ArrowUturnLeftIcon aria-hidden="true" className="size-5" />Restore</Dropdown.Item><Dropdown.Item id="delete" variant="danger" aria-label={`Delete ${itemKind} ${fileName} permanently`}><TrashIcon aria-hidden="true" className="size-5" />Delete permanently</Dropdown.Item></Dropdown.Menu></Dropdown.Popover></Dropdown>
}
