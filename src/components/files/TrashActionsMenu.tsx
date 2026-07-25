import { ArrowUturnLeftIcon, EllipsisHorizontalIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Dropdown } from '@heroui/react'

export function TrashActionsMenu({ fileName, onRestore, onDelete }: { fileName: string; onRestore: () => void; onDelete: () => void }) {
  return <Dropdown><Dropdown.Trigger aria-label={`More actions for ${fileName}`} className="flex size-11 items-center justify-center rounded-[10px]"><EllipsisHorizontalIcon aria-hidden="true" className="size-6" /></Dropdown.Trigger><Dropdown.Popover placement="bottom end"><Dropdown.Menu aria-label={`Trash actions for ${fileName}`} onAction={(key) => key === 'restore' ? onRestore() : onDelete()}><Dropdown.Item id="restore"><ArrowUturnLeftIcon aria-hidden="true" className="size-5" />Restore</Dropdown.Item><Dropdown.Item id="delete" variant="danger"><TrashIcon aria-hidden="true" className="size-5" />Delete permanently</Dropdown.Item></Dropdown.Menu></Dropdown.Popover></Dropdown>
}
