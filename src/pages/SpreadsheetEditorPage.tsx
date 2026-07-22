import { useParams } from 'react-router-dom'

import { UniverSpreadsheetEditor } from '../components/spreadsheet-editor/UniverSpreadsheetEditor'

export function SpreadsheetEditorPage() {
  const { spreadsheetId } = useParams()
  return spreadsheetId ? <UniverSpreadsheetEditor fileId={spreadsheetId} /> : null
}
