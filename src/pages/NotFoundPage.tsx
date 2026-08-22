import { useNavigate } from 'react-router-dom'

import { AppButton } from '../components/common/AppButton'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <AppButton variant="primary" onPress={() => navigate('/home')}>
        Go home
      </AppButton>
    </main>
  )
}
