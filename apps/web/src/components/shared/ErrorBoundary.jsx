import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (typeof window !== 'undefined' && window.console) {
      console.error('[ErrorBoundary]', error, info?.componentStack);
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoBack = () => {
    this.setState({ hasError: false, error: null });
    window.history.back();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#F5F8FB] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-[#E2E4E8] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-[32px] text-[#CC3333]">error</span>
          </div>
          <h1 className="text-xl font-bold text-[#1A1A2E] mb-2">Something went wrong</h1>
          <p className="text-sm text-[#666] mb-6">
            An unexpected error occurred while rendering this page.
            Your data has not been affected.
          </p>
          {this.state.error?.message && (
            <details className="mb-6 text-left">
              <summary className="text-xs text-[#999] cursor-pointer hover:text-[#666]">
                Technical details
              </summary>
              <pre className="mt-2 p-3 bg-[#F4F5F7] rounded-md text-[11px] text-[#666] overflow-auto max-h-32 font-mono">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="px-5 py-2.5 text-sm font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors"
            >
              Reload Page
            </button>
            <button
              onClick={this.handleGoBack}
              className="px-5 py-2.5 text-sm font-medium border border-[#E2E4E8] text-[#333] rounded-md hover:bg-[#F4F5F7] transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }
}
