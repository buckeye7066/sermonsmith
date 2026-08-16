import { Component } from 'react'
import { Link } from 'react-router-dom'

export default class ScreenErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) {
      console.error(error)
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-stone-50 px-4 py-10 text-stone-950 dark:bg-stone-950 dark:text-stone-50">
        <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-white p-8 shadow-sm dark:border-amber-800 dark:bg-stone-900">
          <p className="text-sm font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Something went wrong</p>
          <h1 className="mt-2 text-3xl font-black">This screen did not open correctly.</h1>
          <p className="mt-4 leading-7 text-stone-700 dark:text-stone-200">
            Try going back to Home and choosing where you want to begin again.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-stone-950 px-6 py-3 font-bold text-white focus:outline-none focus:ring-4 focus:ring-amber-300 dark:bg-white dark:text-stone-950"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }
}
