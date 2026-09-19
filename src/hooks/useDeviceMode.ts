import { useEffect, useState } from 'react'

export interface DeviceMode {
  /** True on mobile/tablet viewports (< 1024px) or coarse touch pointer */
  isTouch: boolean
  /** Viewport width < 768px */
  isMobile: boolean
  /** Viewport width >= 768px and < 1024px */
  isTablet: boolean
  /** Viewport width >= 1024px and not coarse pointer */
  isDesktop: boolean
}

const TABLET_BREAKPOINT = 1024
const MOBILE_BREAKPOINT = 768

function getDeviceMode(): DeviceMode {
  if (typeof window === 'undefined') {
    return { isTouch: false, isMobile: false, isTablet: false, isDesktop: true }
  }
  const rawWidth = typeof window.innerWidth === 'number' ? window.innerWidth : 1280
  // If in jsdom/headless testing with 0 width, default to standard desktop width (1280)
  const width = rawWidth > 0 ? rawWidth : 1280
  const isMobile = width < MOBILE_BREAKPOINT
  const isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT
  const hasTouchPointer =
    typeof window.matchMedia === 'function'
      ? (window.matchMedia('(pointer: coarse)')?.matches ?? false)
      : false
  const isTouch = (rawWidth > 0 && width < TABLET_BREAKPOINT) || hasTouchPointer
  return {
    isTouch,
    isMobile,
    isTablet,
    isDesktop: !isTouch,
  }
}

export function useDeviceMode(): DeviceMode {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>(getDeviceMode)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const update = () => {
      setDeviceMode(getDeviceMode())
    }

    const hasMatchMedia = typeof window.matchMedia === 'function'
    const tabletQuery = hasMatchMedia ? window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`) : null
    const mobileQuery = hasMatchMedia ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`) : null
    const pointerQuery = hasMatchMedia ? window.matchMedia('(pointer: coarse)') : null

    tabletQuery?.addEventListener?.('change', update)
    mobileQuery?.addEventListener?.('change', update)
    pointerQuery?.addEventListener?.('change', update)
    window.addEventListener?.('resize', update)

    update()

    return () => {
      tabletQuery?.removeEventListener?.('change', update)
      mobileQuery?.removeEventListener?.('change', update)
      pointerQuery?.removeEventListener?.('change', update)
      window.removeEventListener?.('resize', update)
    }
  }, [])

  return deviceMode
}
