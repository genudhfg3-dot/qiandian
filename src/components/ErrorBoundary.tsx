import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  info: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info })
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-start justify-center bg-cream p-6">
          <div className="w-full max-w-2xl rounded-[8px] border border-hairline bg-surface p-5 shadow-md">
            <div className="mb-2 text-[12px] font-medium uppercase tracking-wide text-terracotta">页面渲染出错</div>
            <div className="mb-3 font-serif text-[18px] font-medium text-ink">{this.state.error.message || String(this.state.error)}</div>
            <pre className="mb-3 max-h-[300px] overflow-auto rounded-[4px] border border-hairline bg-cream-soft/60 p-3 text-[11px] leading-[1.55] text-soft-ink">{this.state.error.stack}</pre>
            {this.state.info?.componentStack ? (
              <pre className="mb-3 max-h-[220px] overflow-auto rounded-[4px] border border-hairline bg-cream-soft/40 p-3 text-[11px] leading-[1.55] text-faint">{this.state.info.componentStack}</pre>
            ) : null}
            <button type="button" onClick={this.handleReload} className="inline-flex items-center gap-1 rounded-[4px] bg-ink px-3 py-1.5 text-[13px] font-medium text-cream hover:opacity-90">重新载入</button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
