import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportException } from '../lib/analytics';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportException(error, 'react_error_boundary');
    void errorInfo;
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-sm">
            <h2 className="mb-4 text-2xl font-bold text-rose-500">Something went wrong</h2>
            <p className="mb-6 text-sm text-slate-400">
              An unexpected error occurred while rendering this page.
            </p>
            {this.state.error && (
              <pre className="mb-6 max-h-40 overflow-auto rounded-lg bg-slate-950 p-4 text-left text-xs font-mono text-slate-500">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-500 hover:shadow-cyan-500/30 active:scale-[0.98]"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
