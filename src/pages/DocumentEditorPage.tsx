import { useParams } from 'react-router-dom'

import { EditorWorkspace } from '../components/document-editor/EditorWorkspace'

export function DocumentEditorPage() {
  const { documentId } = useParams()
  return documentId ? <EditorWorkspace fileId={documentId} type="document" /> : null
}
