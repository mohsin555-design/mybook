type BookmarkMetadata = { title: string; description: string; image: string; siteName?: string }
const requests = new Map<string, Promise<BookmarkMetadata | null>>()

export function getBookmarkMetadata(url: string) {
  let request = requests.get(url)
  if (!request) {
    request = fetch(`/api/bookmark-metadata?url=${encodeURIComponent(url)}`)
      .then(async (response) => {
        if (!response.ok) return null
        const data = await response.json() as BookmarkMetadata
        if (typeof data.title !== 'string' || typeof data.description !== 'string' || typeof data.image !== 'string') return null
        return data
      })
      .catch(() => null)
    requests.set(url, request)
    if (requests.size > 100) requests.delete(requests.keys().next().value!)
  }
  return request
}
