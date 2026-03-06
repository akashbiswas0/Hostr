"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;

  label?: string;

  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {

    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: "" });

  render() {
    const { hasError, message } = this.state;
    const { children, label, fallback } = this.props;

    if (!hasError) return children;
    if (fallback) return fallback;

    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-red-950/10 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-950/40 border border-red-700/30">
          <AlertTriangle size={22} className="text-red-400" />
        </div>
        <div>
          <p className="font-semibold text-white">
            {label ? `${label} failed to load` : "Something went wrong"}
          </p>
          {message && (
            <p className="mt-1 max-w-xs text-xs text-red-400/70 font-mono break-all">
              {message}
            </p>
          )}
        </div>
        <button
          onClick={this.reset}
          className="rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300 hover:bg-red-900/50 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }
}
