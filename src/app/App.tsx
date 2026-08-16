import { RouterProvider } from 'react-router-dom'
import { useEffect } from 'react'

import { PwaStatus } from '../components/common/PwaStatus'
import { useAuthStore } from '../stores/useAuthStore'
import { router } from './router'

export function App() {
  const initializeSession = useAuthStore((state) => state.initializeSession)

  useEffect(() => {
    void initializeSession()
  }, [initializeSession])

  return <>
    <PwaStatus />
    <RouterProvider router={router} />
  </>
}
