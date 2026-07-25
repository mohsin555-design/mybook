import { ArrowDownTrayIcon, ArrowPathIcon, SignalIcon, WifiIcon } from '@heroicons/react/24/outline'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect, useState } from 'react'

import { AppButton } from './AppButton'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

  useEffect(() => {
    const onlineHandler = () => setOnline(true)
    const offlineHandler = () => setOnline(false)
    const installHandler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent) }
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    window.addEventListener('beforeinstallprompt', installHandler)
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler); window.removeEventListener('beforeinstallprompt', installHandler) }
  }, [])

  const install = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    setInstallPrompt(null)
  }

  return <>
    {!online ? <div role="status" className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm text-warning-800"><SignalIcon className="mr-1 inline size-4" />Offline mode: saved local files remain available. Drive sync will resume when you reconnect.</div> : null}
    {needRefresh ? <div role="status" className="border-b border-accent/30 bg-accent/10 px-4 py-2 text-center text-sm"><ArrowPathIcon aria-hidden="true" className="mr-1 inline size-4" />Update available. <button type="button" className="min-h-11 rounded-lg px-2 font-semibold underline" onClick={() => void updateServiceWorker(true)}>Update MyBook</button></div> : null}
    {installPrompt ? <div className="border-b border-[var(--app-border)] bg-background px-4 py-2 text-center text-sm"><ArrowDownTrayIcon aria-hidden="true" className="mr-1 inline size-4" />Install MyBook for faster offline access. <button type="button" className="min-h-11 rounded-lg px-2 font-semibold underline" onClick={() => void install()}>Install</button></div> : null}
    {isIos && !isStandalone ? <div className="border-b border-[var(--app-border)] bg-background px-4 py-2 text-center text-sm"><WifiIcon className="mr-1 inline size-4" />On iPhone: tap Share, then “Add to Home Screen”. <AppButton className="ml-2 inline-flex" variant="secondary" onPress={() => setShowIosHelp((value) => !value)}>How to install</AppButton>{showIosHelp ? <span className="ml-2 text-muted">Use Safari’s Share button, choose Add to Home Screen, then Add.</span> : null}</div> : null}
  </>
}
