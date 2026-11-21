import { Component, type ReactNode } from "react"

type State = { hasError: boolean }

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  State
> {
  override state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-sm font-medium">
              {browser.i18n.getMessage("errorBoundaryTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {browser.i18n.getMessage("errorBoundaryBody")}
            </p>
          </div>
        )
      )
    }
    return this.props.children
  }
}