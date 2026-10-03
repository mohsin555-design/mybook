const supportedExtensions = ['.markdown', '.mybook.md', '.html', '.htm', '.docx', '.rtf', '.md', '.txt']

export function isSupportedDocumentImport(file: Pick<File, 'name'>) {
  const name = file.name.toLocaleLowerCase()
  return supportedExtensions.some((extension) => name.endsWith(extension))
}

export function documentImportTitle(filename: string) {
  const extension = supportedExtensions.find((candidate) => filename.toLocaleLowerCase().endsWith(candidate))
  return (extension ? filename.slice(0, -extension.length) : filename).trim() || 'Imported document'
}

const pendingImports = new Map<string, File>()

export function queueDocumentImport(documentId: string, file: File) {
  pendingImports.set(documentId, file)
}

export function takeDocumentImport(documentId: string) {
  const file = pendingImports.get(documentId)
  pendingImports.delete(documentId)
  return file
}

export function clearDocumentImport(documentId: string) {
  pendingImports.delete(documentId)
}

export function plainTextToHtml(text: string) {
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)

  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function normalizeInlineFormatting(html: string) {
  if (typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'text/html')

  doc.body.querySelectorAll('[style]').forEach((element) => {
    const style = element.getAttribute('style')?.toLocaleLowerCase() ?? ''
    const marks = [
      /font-weight\s*:\s*(?:bold|[6-9]00)/i.test(style) ? 'strong' : '',
      /font-style\s*:\s*italic/i.test(style) ? 'em' : '',
      /text-decoration(?:-line)?\s*:[^;]*underline/i.test(style) ? 'u' : '',
      /text-decoration(?:-line)?\s*:[^;]*line-through/i.test(style) ? 's' : '',
    ].filter(Boolean)

    let content: Node = doc.createDocumentFragment()
    while (element.firstChild) content.appendChild(element.firstChild)
    for (const tag of marks.reverse()) {
      const wrapper = doc.createElement(tag)
      wrapper.appendChild(content)
      content = wrapper
    }
    element.appendChild(content)
    element.removeAttribute('style')
  })

  return doc.body.innerHTML
}

export async function convertRtfToHtml(contents: ArrayBuffer) {
  const { RTFJS } = await import('rtf.js')
  const [html] = await new RTFJS.Document(contents, {}).render()
  if (!html) throw new Error('The RTF file did not contain any readable content.')
  return html.outerHTML
}
