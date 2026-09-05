import type { MyBookFile, MyBookFolder } from '../types/files'

export type FavoriteItem = { kind: 'folder'; item: MyBookFolder } | { kind: 'file'; item: MyBookFile }

export function activeFavoriteItems(files: MyBookFile[], folders: MyBookFolder[]) {
  return [
    ...folders.filter((folder) => folder.isFavorite && !folder.isDeleted).map((item): FavoriteItem => ({ kind: 'folder', item })),
    ...files.filter((file) => file.isFavorite && !file.isDeleted).map((item): FavoriteItem => ({ kind: 'file', item })),
  ].sort(compareFavoriteItemsByUpdatedAt)
}

export function compareFavoriteItemsByUpdatedAt(a: FavoriteItem, b: FavoriteItem) {
  const updated = b.item.updatedAt.localeCompare(a.item.updatedAt)
  if (updated !== 0) return updated
  const name = a.item.name.localeCompare(b.item.name, 'en-US', { sensitivity: 'base' })
  if (name !== 0) return name
  return a.item.id.localeCompare(b.item.id)
}
