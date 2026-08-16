import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Keep a quiet record for developers; the user never sees this text.
    if (typeof console !== 'undefined') {
      console.error('A screen ran into a problem:', error);
    }
  }

  handleGoHome = () => {
    this.setState({ hasError: false });
    try {
      window.location.hash = '#/';
    } catch (e) {
      // Ignore navigation failures.
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Something went wrong on this screen
          </h1>
          <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">
            Sorry about that. Nothing you saved is lost. Let\u2019s take you back to the
            start.
          </p>
          <button
            type="button"
            onClick={this.handleGoHome}
            className="mt-6 inline-flex items-center rounded-lg bg-sky-600 px-5 py-3 text-base font-semibold text-white shadow hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            Go back to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
