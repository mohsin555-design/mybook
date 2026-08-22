import { Navigate, useSearchParams } from 'react-router-dom'

import { getSafeReturnPath } from '../utils/navigation'

export function LegacyGoogleAuthStartRedirect() {
  const [searchParams] = useSearchParams()
  const returnTo = getSafeReturnPath(searchParams.get('returnTo'))

  return <Navigate to="/login" replace state={{ from: returnTo }} />
}
