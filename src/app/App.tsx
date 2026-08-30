import { RouterProvider } from 'react-router-dom'
import { useEffect } from 'react'

import { PwaStatus } from '../components/common/PwaStatus'
import { Toaster } from '../components/ui/toast'
import { TooltipProvider } from '../components/ui/tooltip'
import { useAuthStore } from '../stores/useAuthStore'
import { router } from './router'

export function App() {
  const initializeSession = useAuthStore((state) => state.initializeSession)

  useEffect(() => {
    void initializeSession()
  }, [initializeSession])

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <TooltipProvider>
      <PwaStatus />
      <div className="min-h-0 flex-1 overflow-hidden">
        <RouterProvider router={router} />
      </div>
      <Toaster />
      </TooltipProvider>
    </div>
  )
}
