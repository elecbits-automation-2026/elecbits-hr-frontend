import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Error boundary for the route tree: a render crash in one screen becomes a
 * readable message instead of a blank page. Class component by necessity —
 * boundaries are the one React feature with no hook equivalent.
 */
interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Route crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className='flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center'>
          <h1 className='text-xl font-semibold text-slate-800'>Something went wrong</h1>
          <p className='max-w-md text-sm text-slate-500'>{this.state.error.message}</p>
          <button
            type='button'
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500'
            onClick={() => window.location.assign('/')}
          >
            Back to home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
