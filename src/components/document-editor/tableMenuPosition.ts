export function tableMenuTop(anchorTop: number, anchorBottom: number, menuHeight: number, gap = 8, minTop = gap) {
  const below = anchorBottom + gap
  const hasRoomBelow = below + menuHeight <= window.innerHeight - gap
  if (hasRoomBelow) return below
  const above = anchorTop - menuHeight - gap
  if (above >= minTop) return above
  return Math.max(minTop, window.innerHeight - menuHeight - gap)
}