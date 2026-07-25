import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'

import { AppButton } from './AppButton'
import { ErrorState } from './ErrorState'
import { devLog } from '../../utils/safeLog'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    devLog('error', `Unhandled application error${info.componentStack ? ' in a component' : ''}`, error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="mx-auto flex min-h-dvh max-w-2xl items-center px-4 py-8"><ErrorState title="MyBook could not display this screen" message="Your local files are still stored in the browser. Reload the app, and if the problem continues, use Settings to review sync diagnostics." action={<AppButton variant="primary" onPress={() => window.location.reload()}>Reload MyBook</AppButton>} /></main>
  }
}
