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

  return <>
    <TooltipProvider>
      <PwaStatus />
      <RouterProvider router={router} />
      <Toaster />
    </TooltipProvider>
  </>
}
