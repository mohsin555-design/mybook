// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { enterVideoFullscreen } from './videoFullscreen'

it('supports the native iOS video fullscreen method', async () => {
  const video = document.createElement('video')
  const webkitEnterFullscreen = vi.fn()
  Object.assign(video, { webkitEnterFullscreen })
  expect(await enterVideoFullscreen(video)).toBe(true)
  expect(webkitEnterFullscreen).toHaveBeenCalledOnce()
})

it('reports denied or unavailable fullscreen without throwing', async () => {
  expect(await enterVideoFullscreen(null)).toBe(false)
  const iframe = document.createElement('iframe')
  expect(await enterVideoFullscreen(iframe)).toBe(false)
  iframe.requestFullscreen = vi.fn().mockRejectedValue(new Error('Denied'))
  expect(await enterVideoFullscreen(iframe)).toBe(false)
})
