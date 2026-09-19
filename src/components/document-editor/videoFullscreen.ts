/** Expand the existing player, preserving playback and the current seek position. */
export async function enterVideoFullscreen(element: HTMLVideoElement | HTMLIFrameElement | null): Promise<boolean> {
  if (!element) return false
  const player = element as typeof element & {
    webkitEnterFullscreen?: () => void
    webkitRequestFullscreen?: () => void | Promise<void>
  }
  try {
    if (player.requestFullscreen) await player.requestFullscreen()
    else if (player.webkitEnterFullscreen) player.webkitEnterFullscreen()
    else if (player.webkitRequestFullscreen) await player.webkitRequestFullscreen()
    else return false
    return true
  } catch {
    return false
  }
}
