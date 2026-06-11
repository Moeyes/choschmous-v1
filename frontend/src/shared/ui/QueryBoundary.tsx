'use client';

import React, { Component, ReactNode, Suspense } from 'react';
import { Button } from './button';
import { PageLoadingState } from './page/PageLoadingState';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-12 bg-destructive/5 border border-destructive/10 rounded-lg gap-4 text-center">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <span className="text-lg font-black uppercase tracking-tight">Something went wrong</span>
          </div>
          <p className="text-sm font-medium text-muted-foreground max-w-md">
            {this.state.error?.message || 'An error occurred while loading data.'}
          </p>
          <Button 
            variant="default" 
            size="lg" 
            onClick={this.resetError}
            className="mt-2 h-11 px-8 gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Retry Connection
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface QueryBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
}

export function QueryBoundary({ 
  children, 
  fallback = <PageLoadingState />, 
  errorFallback 
}: QueryBoundaryProps) {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
