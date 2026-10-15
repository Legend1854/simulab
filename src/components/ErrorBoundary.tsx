import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Clears SimuLab's browser storage; offered as a recovery action. */
  onResetData: () => void;
}

interface State {
  error: Error | null;
}

/** Last line of defence: an unexpected rendering error shows recovery actions instead of a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Development aid only. No personal data is held in error messages.
    console.error('SimuLab error boundary caught an error', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="shell" id="main">
        <div className="sheet sheet-section stack" role="alert">
          <h1>Something went wrong</h1>
          <p>SimuLab hit an unexpected error and stopped this page to avoid showing incorrect results.</p>
          <p className="muted small">Details: {this.state.error.message}</p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload the page
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                this.props.onResetData();
                window.location.hash = '#/';
                window.location.reload();
              }}
            >
              Clear SimuLab data and reload
            </button>
          </div>
          <p className="muted small">Clearing data removes the saved configuration and all simulation sessions stored in this browser.</p>
        </div>
      </main>
    );
  }
}
