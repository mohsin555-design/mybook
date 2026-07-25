import { RouterProvider } from 'react-router-dom'

import { PwaStatus } from '../components/common/PwaStatus'
import { router } from './router'

export function App() {
  return <>
    <PwaStatus />
    <RouterProvider router={router} />
  </>
}
