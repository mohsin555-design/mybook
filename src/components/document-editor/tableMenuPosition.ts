export function tableMenuTop(anchorTop: number, anchorBottom: number, menuHeight: number, gap = 8, minTop = gap) {
  const below = anchorBottom + gap
  const hasRoomBelow = below + menuHeight <= window.innerHeight - gap
  if (hasRoomBelow) return below
  const above = anchorTop - menuHeight - gap
  if (above >= minTop) return above
  return Math.max(minTop, window.innerHeight - menuHeight - gap)
}

export function rowGripMenuTop(gripTop: number, gripBottom: number, menuHeight: number, gap = 8, minTop = gap) {
  if (typeof window === 'undefined') return gripTop
  if (gripTop + menuHeight <= window.innerHeight - gap) {
    return Math.max(minTop, gripTop)
  }
  if (gripBottom - menuHeight >= minTop) {
    return gripBottom - menuHeight
  }
  return Math.max(minTop, window.innerHeight - menuHeight - gap)
}