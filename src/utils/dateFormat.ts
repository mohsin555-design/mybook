const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

const shortTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
})

export function formatUpdatedAt(value: string, now = new Date()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  const elapsedMs = now.getTime() - date.getTime()
  const elapsedMinutes = Math.floor(elapsedMs / 60_000)
  const elapsedHours = Math.floor(elapsedMs / 3_600_000)

  if (elapsedMs >= 0 && elapsedMinutes < 1) return 'just now'
  if (elapsedMs >= 0 && elapsedMinutes < 60) return `${elapsedMinutes} ${elapsedMinutes === 1 ? 'min' : 'mins'} ago`
  if (elapsedMs >= 0 && elapsedHours < 6) return `${elapsedHours} ${elapsedHours === 1 ? 'hr' : 'hrs'} ago`
  if (isSameUtcDate(date, now)) {
    return `today, ${shortTimeFormatter.format(date)}`
  }
  if (isYesterdayUtc(date, now)) {
    return `yesterday, ${shortTimeFormatter.format(date)}`
  }

  return `${shortDateFormatter.format(date)}, ${shortTimeFormatter.format(date)}`
}

function isSameUtcDate(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
}

function isYesterdayUtc(date: Date, now: Date) {
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  return date.getUTCFullYear() === yesterday.getUTCFullYear() &&
    date.getUTCMonth() === yesterday.getUTCMonth() &&
    date.getUTCDate() === yesterday.getUTCDate()
}
