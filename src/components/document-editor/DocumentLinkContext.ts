import { createContext, createElement, useContext, type ReactNode } from 'react'

import type { MyBookFile } from '../../types/files'

interface DocumentLinkContextValue {
  currentFileId: string
  files: MyBookFile[]
  openDocument: (id: string) => void
}

const DocumentLinkContext = createContext<DocumentLinkContextValue | null>(null)

export function DocumentLinkProvider({ children, currentFileId, files, openDocument }: DocumentLinkContextValue & { children: ReactNode }) {
  return createElement(DocumentLinkContext.Provider, { value: { currentFileId, files, openDocument } }, children)
}

export function useDocumentLinkContext() {
  return useContext(DocumentLinkContext)
}
