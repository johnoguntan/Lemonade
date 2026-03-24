"use client"

import React from "react"

type ErrorBoundaryProps = {
  children: React.ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto my-4 w-full max-w-3xl rounded-xl border border-[var(--accent-color)]/30 bg-destructive/10 p-4 text-destructive shadow-sm">
          <div className="rounded-lg bg-background/80 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <p className="text-sm font-medium">Something went wrong in this section.</p>
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-3 inline-flex items-center rounded-md bg-[var(--accent-color)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
