import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { storage } from '@/lib/storage';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ExpoStaffing ErrorBoundary] Caught render exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetStorage = () => {
    try {
      storage.resetToDemo();
      localStorage.removeItem('boothduty_events_v2');
      localStorage.removeItem('booth_duty_store');
    } catch {
      // ignore
    }
    window.location.hash = '#/';
    window.location.reload();
  };

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f1f3f6] text-[#252a2e] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#d8dce0] rounded shadow-modus-3 p-6 sm:p-8 space-y-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-[#fdf3f2] text-[#da3832] rounded border border-[#f5b5b2] shrink-0">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#252a2e] tracking-tight">
                  Application Exception Detected
                </h1>
                <p className="text-xs text-[#46535e] mt-0.5">
                  Expo Staffing caught an unexpected runtime error during render.
                </p>
              </div>
            </div>

            {/* Error detail */}
            <div className="bg-[#f8f9fa] border border-[#d8dce0] rounded p-4 text-xs font-mono text-[#da3832] overflow-x-auto max-h-40">
              <div className="font-bold text-[#da3832] mb-1">
                {this.state.error?.name}: {this.state.error?.message}
              </div>
              {this.state.error?.stack && (
                <pre className="text-[11px] text-[#7c878e] whitespace-pre-wrap">
                  {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                </pre>
              )}
            </div>

            {/* Recovery actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleTryAgain}
                className="focus-ring w-full sm:w-auto flex-1 px-4 py-2.5 bg-[#0063a3] hover:bg-[#005084] text-white text-xs font-bold rounded flex items-center justify-center space-x-2 transition-colors shadow-xs cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="focus-ring w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-[#f1f3f6] text-[#252a2e] border border-[#d8dce0] text-xs font-semibold rounded transition-colors cursor-pointer shadow-xs"
              >
                Reload Window
              </button>
              <button
                type="button"
                onClick={this.handleResetStorage}
                className="focus-ring w-full sm:w-auto px-4 py-2.5 bg-[#fdf3f2] hover:bg-[#fce5e4] border border-[#f5b5b2] text-[#da3832] text-xs font-semibold rounded flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                title="Wipes local state and re-seeds clean demo schedule"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
