import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isQuotaError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      isQuotaError: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || 'An unexpected error occurred.';
    let display = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed && typeof parsed.error === 'string') {
        display = `${parsed.error}${parsed.path ? ` (${parsed.operationType ?? 'op'} on ${parsed.path})` : ''}`;
      }
    } catch {
      // keep raw message
    }

    return {
      hasError: true,
      errorMessage: display,
      isQuotaError: raw.toLowerCase().includes('quota exceeded'),
    };
  }

  componentDidCatch(error: Error) {
    console.error('Workspace ErrorBoundary caught:', error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h1 className="text-lg font-semibold text-slate-900">
              {this.state.isQuotaError ? 'Firestore Daily Quota Reached' : 'Something went wrong'}
            </h1>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            {this.state.isQuotaError
              ? 'Your free-tier Firestore daily quota has been reached. Quota resets tomorrow, or you can upgrade in the Firebase console.'
              : 'The workspace encountered a data synchronization error. Reload to reconnect cleanly.'}
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 break-words mb-6">
            {this.state.errorMessage}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            Reload Workspace
          </button>
        </div>
      </div>
    );
  }
}
