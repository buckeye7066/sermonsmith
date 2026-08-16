import React from 'react'
import { Link } from 'react-router-dom'

export default class FriendlyErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined') {
      console.error('SermonSmith screen error', error, info)
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <section className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-900/60 dark:bg-slate-900 sm:p-8">
        <p className="mb-3 inline-flex rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-900 dark:bg-rose-900/40 dark:text-rose-100">
          Something went wrong
        </p>
        <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">This screen did not open the way it should.</h1>
        <p className="mt-4 text-lg leading-8 text-slate-700 dark:text-slate-200">
          Try going back to Home. If this keeps happening, close the app and open it again.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl bg-amber-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          onClick={() => this.setState({ hasError: false })}
        >
          Back to Home
        </Link>
      </section>
    )
  }
}
