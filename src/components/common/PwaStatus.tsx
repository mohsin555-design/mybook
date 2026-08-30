import { ArrowDownTrayIcon, ArrowPathIcon, SignalIcon } from '@heroicons/react/24/outline'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuthStore } from '../../stores/useAuthStore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { AppButton } from './AppButton'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALL_HELP_STORAGE_PREFIX = 'mybook-install-help-seen:'

export function PwaStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const { email, isAuthenticated } = useAuthStore()
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW: (_swUrl, swRegistration) => {
      setRegistration(swRegistration ?? null)
    },
  })
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isSafari = isIos && /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  const installHelpStorageKey = useMemo(
    () => email ? `${INSTALL_HELP_STORAGE_PREFIX}${email.trim().toLowerCase()}` : null,
    [email],
  )
  const canOfferInstall = Boolean(installPrompt) || (isSafari && !isStandalone)

  useEffect(() => {
    const onlineHandler = () => setOnline(true)
    const offlineHandler = () => setOnline(false)
    const installHandler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent) }
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    window.addEventListener('beforeinstallprompt', installHandler)
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler); window.removeEventListener('beforeinstallprompt', installHandler) }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !installHelpStorageKey || isStandalone || !canOfferInstall) {
      setShowInstallHelp(false)
      return
    }

    setShowInstallHelp(localStorage.getItem(installHelpStorageKey) !== 'true')
  }, [canOfferInstall, installHelpStorageKey, isAuthenticated, isStandalone])

  const dismissInstallHelp = () => {
    if (installHelpStorageKey) localStorage.setItem(installHelpStorageKey, 'true')
    setShowInstallHelp(false)
  }

  const install = async () => {
    if (!installPrompt) return
    dismissInstallHelp()
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const checkForUpdates = useCallback(() => {
    if (!registration) return
    void registration.update().catch(() => undefined)
  }, [registration])

  useEffect(() => {
    if (!registration) return

    checkForUpdates()
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') checkForUpdates()
    }
    const pageShowHandler = () => checkForUpdates()
    const focusHandler = () => checkForUpdates()
    const interval = window.setInterval(checkForUpdates, isIos ? 30 * 60 * 1000 : 60 * 60 * 1000)

    document.addEventListener('visibilitychange', visibilityHandler)
    window.addEventListener('pageshow', pageShowHandler)
    window.addEventListener('focus', focusHandler)
    return () => {
      document.removeEventListener('visibilitychange', visibilityHandler)
      window.removeEventListener('pageshow', pageShowHandler)
      window.removeEventListener('focus', focusHandler)
      window.clearInterval(interval)
    }
  }, [checkForUpdates, isIos, registration])

  return <>
    {!online ? <div role="status" className="shrink-0 border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-center text-sm text-yellow-800"><SignalIcon className="mr-1 inline size-4" />Offline mode: saved local files remain available. Drive sync will resume when you reconnect.</div> : null}
    {needRefresh ? <div role="status" className="shrink-0 border-b border-accent/30 bg-primary/10 px-4 py-2 text-center text-sm"><ArrowPathIcon aria-hidden="true" className="mr-1 inline size-4" />Update available. <button type="button" className="min-h-11 rounded-lg px-2 font-semibold underline" onClick={() => void updateServiceWorker(true)}>Update MyBook</button></div> : null}

    <Dialog
      open={showInstallHelp}
      onOpenChange={(isOpen) => {
        if (!isOpen) dismissInstallHelp()
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ArrowDownTrayIcon aria-hidden="true" className="size-6" />
          </div>
          <DialogTitle>Install MyBook</DialogTitle>
          <div className="text-sm leading-6 text-muted-foreground">
            {isSafari ? (
              <ol className="list-decimal space-y-2 pl-5">
                <li>Tap Safari&apos;s Share button.</li>
                <li>Choose <span className="font-medium text-foreground">Add to Home Screen</span>.</li>
                <li>Tap <span className="font-medium text-foreground">Add</span>.</li>
              </ol>
            ) : (
                <p>Install MyBook for faster access and reliable offline use.</p>
              )}
          </div>
        </DialogHeader>
        <DialogFooter>
          <AppButton variant="secondary" onPress={dismissInstallHelp}>
            {installPrompt ? 'Not now' : 'Got it'}
          </AppButton>
          {installPrompt ? <AppButton variant="primary" onPress={() => void install()}>Install</AppButton> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={needRefresh}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ArrowPathIcon aria-hidden="true" className="size-6" />
          </div>
          <DialogTitle>Update available</DialogTitle>
          <DialogDescription>
            A newer version of MyBook is ready. Update now to use the latest fixes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <AppButton variant="primary" onPress={() => void updateServiceWorker(true)}>Update MyBook</AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
