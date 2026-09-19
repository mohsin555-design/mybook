import {
  Csv02Icon,
  Doc02Icon,
  File02Icon,
  FileAudioIcon,
  FileCodeIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  FileZipIcon,
  Pdf02Icon,
  Txt02Icon,
} from '@hugeicons/core-free-icons'

export interface FileTypeDetails {
  extension: string
  label: string
  icon: typeof File02Icon
  sizeFormatted?: string
}

export function formatFileSize(bytes: number | undefined): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function extractFileExtension(fileNameOrUrl: string): string {
  if (!fileNameOrUrl) return ''
  try {
    // Strip query strings or hash
    const noQuery = fileNameOrUrl.split('?')[0] ?? ''
    const cleanPath = noQuery.split('#')[0] ?? ''
    const lastSlash = cleanPath.lastIndexOf('/')
    const name = lastSlash >= 0 ? cleanPath.substring(lastSlash + 1) : cleanPath
    const lastDot = name.lastIndexOf('.')
    if (lastDot > 0 && lastDot < name.length - 1) {
      return name.substring(lastDot + 1).toLowerCase()
    }
  } catch {
    // ignore
  }
  return ''
}

export function getFileTypeDetails(
  fileName: string,
  mimeType = '',
  size = 0
): FileTypeDetails {
  const ext = extractFileExtension(fileName)
  const mime = (mimeType || '').toLowerCase()
  const sizeFormatted = formatFileSize(size)

  // PDF
  if (ext === 'pdf' || mime === 'application/pdf') {
    return {
      extension: 'PDF',
      label: 'PDF Document',
      icon: Pdf02Icon,
      sizeFormatted,
    }
  }

  // Word Document
  if (
    ext === 'doc' ||
    ext === 'docx' ||
    mime.includes('wordprocessingml') ||
    mime.includes('msword')
  ) {
    return {
      extension: ext ? ext.toUpperCase() : 'DOCX',
      label: 'Word Document',
      icon: Doc02Icon,
      sizeFormatted,
    }
  }

  // Excel / Spreadsheet
  if (
    ext === 'xls' ||
    ext === 'xlsx' ||
    ext === 'xlsm' ||
    mime.includes('spreadsheetml') ||
    mime.includes('ms-excel')
  ) {
    return {
      extension: ext ? ext.toUpperCase() : 'XLSX',
      label: 'Spreadsheet',
      icon: FileSpreadsheetIcon,
      sizeFormatted,
    }
  }

  // CSV
  if (ext === 'csv' || mime === 'text/csv') {
    return {
      extension: 'CSV',
      label: 'CSV Spreadsheet',
      icon: Csv02Icon,
      sizeFormatted,
    }
  }

  // Markdown
  if (ext === 'md' || ext === 'markdown' || ext === 'mdown' || ext === 'mkd') {
    return {
      extension: 'MD',
      label: 'Markdown Document',
      icon: FileTextIcon,
      sizeFormatted,
    }
  }

  // Text
  if (ext === 'txt' || ext === 'rtf' || ext === 'log' || mime.startsWith('text/plain')) {
    return {
      extension: ext ? ext.toUpperCase() : 'TXT',
      label: 'Text Document',
      icon: Txt02Icon,
      sizeFormatted,
    }
  }

  // Archive
  if (
    ext === 'zip' ||
    ext === 'rar' ||
    ext === '7z' ||
    ext === 'tar' ||
    ext === 'gz' ||
    ext === 'bz2' ||
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('archive')
  ) {
    return {
      extension: ext ? ext.toUpperCase() : 'ZIP',
      label: 'Archive',
      icon: FileZipIcon,
      sizeFormatted,
    }
  }

  // Code
  if (
    [
      'js',
      'jsx',
      'ts',
      'tsx',
      'json',
      'html',
      'htm',
      'css',
      'scss',
      'sass',
      'less',
      'py',
      'c',
      'cpp',
      'h',
      'hpp',
      'cs',
      'java',
      'kt',
      'rs',
      'go',
      'php',
      'rb',
      'swift',
      'sql',
      'sh',
      'bash',
      'yaml',
      'yml',
      'xml',
    ].includes(ext) ||
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    mime.includes('json') ||
    mime.includes('xml')
  ) {
    return {
      extension: ext ? ext.toUpperCase() : 'CODE',
      label: 'Code File',
      icon: FileCodeIcon,
      sizeFormatted,
    }
  }

  // Image
  if (
    ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif'].includes(ext) ||
    mime.startsWith('image/')
  ) {
    return {
      extension: ext ? ext.toUpperCase() : 'IMAGE',
      label: 'Image File',
      icon: FileImageIcon,
      sizeFormatted,
    }
  }

  // Audio
  if (
    ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'weba', 'opus'].includes(ext) ||
    mime.startsWith('audio/')
  ) {
    return {
      extension: ext ? ext.toUpperCase() : 'AUDIO',
      label: 'Audio File',
      icon: FileAudioIcon,
      sizeFormatted,
    }
  }

  // Video
  if (
    ['mp4', 'webm', 'mov', 'mkv', 'avi', 'flv', 'wmv'].includes(ext) ||
    mime.startsWith('video/')
  ) {
    return {
      extension: ext ? ext.toUpperCase() : 'VIDEO',
      label: 'Video File',
      icon: FileVideoIcon,
      sizeFormatted,
    }
  }

  // Generic fallback
  return {
    extension: ext ? ext.toUpperCase() : 'FILE',
    label: ext ? `${ext.toUpperCase()} File` : 'File',
    icon: File02Icon,
    sizeFormatted,
  }
}
