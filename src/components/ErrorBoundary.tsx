import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  info: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ error, info })
    // eslint-disable-next-line no-console
    console.error('[App ErrorBoundary]', error, info.componentStack)
    if (window.braintwo?.logs?.error) {
      void window.braintwo.logs.error('renderer:ErrorBoundary', error, 'React rendering crash captured by ErrorBoundary', {
        componentStack: info.componentStack
      })
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center bg-bt-bg p-8 font-sans text-bt-text">
          <div className="max-w-2xl rounded-[14px] border border-bt-red/40 bg-bt-surf p-8">
            <div className="mb-3 text-[11px] uppercase tracking-eyebrow text-bt-red">
              Error en la UI
            </div>
            <h1 className="mb-3 font-display text-3xl">Algo se rompió al renderizar</h1>
            <p className="mb-4 text-sm text-bt-muted">
              Abrí DevTools (Ctrl+Shift+I) para ver el stack completo. Lo de abajo
              es lo que JavaScript pudo capturar.
            </p>
            <pre className="overflow-auto rounded-md border border-bt-border bg-bt-bg p-4 text-xs text-bt-amber">
              {this.state.error.message}
              {this.state.info?.componentStack ? (
                <>
                  {'\n\n'}
                  {this.state.info.componentStack}
                </>
              ) : null}
            </pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
