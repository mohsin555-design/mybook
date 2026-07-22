import { useParams } from 'react-router-dom'

import { EditorWorkspace } from '../components/document-editor/EditorWorkspace'

export function SpreadsheetEditorPage() {
  const { spreadsheetId } = useParams()
  return spreadsheetId ? <EditorWorkspace fileId={spreadsheetId} type="spreadsheet" /> : null
}
