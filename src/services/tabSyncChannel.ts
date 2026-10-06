export interface TabDocUpdateMessage {
  type: 'doc-update'
  fileId: string
  content: string
  title?: string
  senderId: string
}

type TabSyncListener = (message: TabDocUpdateMessage) => void

const TAB_ID = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tab-${Math.random()}`
const listeners = new Set<TabSyncListener>()

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (channel) return channel
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel('mybook-live-doc-sync')
      channel.onmessage = (event: MessageEvent<TabDocUpdateMessage>) => {
        if (!event.data || event.data.senderId === TAB_ID) return
        listeners.forEach((listener) => {
          try {
            listener(event.data)
          } catch {
            // Ignore listener errors
          }
        })
      }
    } catch {
      channel = null
    }
  }
  return channel
}

export function broadcastDocUpdate(fileId: string, content: string, title?: string) {
  const ch = getChannel()
  if (!ch) return
  const message: TabDocUpdateMessage = {
    type: 'doc-update',
    fileId,
    content,
    title,
    senderId: TAB_ID,
  }
  try {
    ch.postMessage(message)
  } catch {
    // Channel closed or failed
  }
}

export function subscribeToTabDocUpdates(listener: TabSyncListener) {
  getChannel()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getTabId() {
  return TAB_ID
}
