/**
 * Zero-dependency standard ZIP archive builder (Store / uncompressed mode).
 * Compatible with macOS Finder, Windows Explorer, iOS Files, and Linux unzip.
 */

// CRC-32 Lookup Table
const crc32Table = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  }
  crc32Table[i] = c
}

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] ?? 0
    const tableIndex = (crc ^ byte) & 0xff
    const tableVal = crc32Table[tableIndex] ?? 0
    crc = (crc >>> 8) ^ tableVal
  }
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  path: string
  data: Uint8Array | string
}

function dosDateTime(date = new Date()): { dosTime: number; dosDate: number } {
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((Math.floor(date.getSeconds() / 2)) & 0x1f)
  const dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0xf) << 5) |
    (date.getDate() & 0x1f)
  return { dosTime, dosDate }
}

export async function createZipArchive(entries: ZipEntry[]): Promise<Blob> {
  const textEncoder = new TextEncoder()
  const localHeadersAndData: Uint8Array[] = []
  const centralDirectoryEntries: Uint8Array[] = []
  let offset = 0
  const { dosTime, dosDate } = dosDateTime()

  for (const entry of entries) {
    const rawData = typeof entry.data === 'string' ? textEncoder.encode(entry.data) : entry.data
    const pathBytes = textEncoder.encode(entry.path.replace(/\\/g, '/').replace(/^\/+/, ''))
    const crc = computeCrc32(rawData)
    const size = rawData.length

    // Local file header (30 bytes + name length)
    const localHeader = new Uint8Array(30 + pathBytes.length)
    const localView = new DataView(localHeader.buffer)
    localView.setUint32(0, 0x04034b50, true) // Local header signature
    localView.setUint16(4, 20, true) // Version needed to extract (2.0)
    localView.setUint16(6, 0x0800, true) // General purpose bit flag (UTF-8)
    localView.setUint16(8, 0, true) // Compression method: 0 (stored)
    localView.setUint16(10, dosTime, true) // Last mod file time
    localView.setUint16(12, dosDate, true) // Last mod file date
    localView.setUint32(14, crc, true) // CRC-32
    localView.setUint32(18, size, true) // Compressed size
    localView.setUint32(22, size, true) // Uncompressed size
    localView.setUint16(26, pathBytes.length, true) // File name length
    localView.setUint16(28, 0, true) // Extra field length
    localHeader.set(pathBytes, 30)

    localHeadersAndData.push(localHeader, rawData)

    // Central directory header (46 bytes + name length)
    const cdHeader = new Uint8Array(46 + pathBytes.length)
    const cdView = new DataView(cdHeader.buffer)
    cdView.setUint32(0, 0x02014b50, true) // Central directory signature
    cdView.setUint16(4, 20, true) // Version made by
    cdView.setUint16(6, 20, true) // Version needed to extract
    cdView.setUint16(8, 0x0800, true) // General purpose bit flag (UTF-8)
    cdView.setUint16(10, 0, true) // Compression method (stored)
    cdView.setUint16(12, dosTime, true)
    cdView.setUint16(14, dosDate, true)
    cdView.setUint32(16, crc, true)
    cdView.setUint32(20, size, true)
    cdView.setUint32(24, size, true)
    cdView.setUint16(28, pathBytes.length, true)
    cdView.setUint16(30, 0, true) // Extra field length
    cdView.setUint16(32, 0, true) // File comment length
    cdView.setUint16(34, 0, true) // Disk number start
    cdView.setUint16(36, 0, true) // Internal file attributes
    cdView.setUint32(38, 0, true) // External file attributes
    cdView.setUint32(42, offset, true) // Relative offset of local header
    cdHeader.set(pathBytes, 46)

    centralDirectoryEntries.push(cdHeader)
    offset += localHeader.length + rawData.length
  }

  const centralDirectoryOffset = offset
  const centralDirectorySize = centralDirectoryEntries.reduce((acc, cur) => acc + cur.length, 0)

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  eocdView.setUint32(0, 0x06054b50, true) // EOCD signature
  eocdView.setUint16(4, 0, true) // Disk number
  eocdView.setUint16(6, 0, true) // Disk where central directory starts
  eocdView.setUint16(8, entries.length, true) // Number of central directory records on this disk
  eocdView.setUint16(10, entries.length, true) // Total number of central directory records
  eocdView.setUint32(12, centralDirectorySize, true) // Size of central directory
  eocdView.setUint32(16, centralDirectoryOffset, true) // Offset of start of central directory
  eocdView.setUint16(20, 0, true) // Comment length

  return new Blob([...localHeadersAndData, ...centralDirectoryEntries, eocd], {
    type: 'application/zip',
  })
}
