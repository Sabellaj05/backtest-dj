import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('QuantFlow ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: 'var(--bg, #000000)',
            color: 'var(--fg, #ffffff)',
            fontFamily: 'DM Sans, system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              border: '1px solid var(--line-2, #36312d)',
              backgroundColor: 'var(--surface, #0d0b0a)',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            <p
              style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--accent, #c5ac98)',
                margin: 0,
              }}
            >
              QuantFlow Runtime Diagnostic
            </p>
            <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '8px 0' }}>
              The interface encountered an error
            </h1>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--fg-2, #aaa39d)',
                margin: '0 0 16px 0',
                lineHeight: 1.5,
              }}
            >
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: 'var(--accent, #c5ac98)',
                color: 'var(--on-accent, #000000)',
                border: 'none',
                borderRadius: '5px',
                padding: '8px 14px',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Reload application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
