import React from 'react';

/**
 * ErrorBoundary
 *
 * Catches any render error anywhere below it in the tree and shows a calm,
 * plain-language message with a large, obvious button back to Home.
 *
 * A non-technical user must NEVER see a raw error message or a stack trace,
 * so we deliberately do not render error.message or error.stack. We log the
 * technical details to the console (for developers) but only show friendly
 * words on screen.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleGoHome = this.handleGoHome.bind(this);
  }

  static getDerivedStateFromError() {
    // Flip into the friendly fallback view. We intentionally do not keep the
    // raw error in state for display -- users should never see it.
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Developers can inspect the real error in the console. The user won't.
    // eslint-disable-next-line no-console
    console.error('A screen failed to render:', error, info);
  }

  handleGoHome() {
    // Reset the boundary and send the user back to the safe Home screen.
    // Use a hard navigation so we always land on a fresh, known-good page,
    // even if the router itself is what failed.
    try {
      this.setState({ hasError: false });
    } catch {
      // ignore
    }
    try {
      window.location.assign('/');
    } catch {
      // As a last resort, reload the page.
      try {
        window.location.reload();
      } catch {
        // Nothing else we can safely do.
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-screen flex items-center justify-center p-6 bg-white dark:bg-slate-900"
        >
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Something went wrong on this screen
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 mb-8">
              Sorry about that. Nothing you did is broken. Let&apos;s take you back to the
              Home screen so you can pick up where you left off.
            </p>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="inline-flex items-center justify-center px-6 py-3 text-lg font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-colors"
            >
              Go back to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
