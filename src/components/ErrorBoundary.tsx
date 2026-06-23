import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  telemetryId: string;
}

/**
 * App-wide error boundary. Catches render exceptions and shows a detailed
 * fallback UI including a telemetry correlation id that can be matched to
 * traces/logs in Grafana / OTel.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    telemetryId: "",
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    const telemetryId =
      (globalThis.crypto as Crypto | undefined)?.randomUUID?.() ??
      `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return { hasError: true, error, telemetryId };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Emit to console with the same id we show the user, so support can grep.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", {
      telemetryId: this.state.telemetryId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, errorInfo, telemetryId } = this.state;

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          padding: "2rem",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          background: "#0b0b12",
          color: "#f4f4f5",
          overflow: "auto",
        }}
      >
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            Something went wrong rendering the app
          </h1>
          <p style={{ opacity: 0.8, marginBottom: "1rem" }}>
            Share the telemetry id below when reporting this issue.
          </p>

          <div
            style={{
              background: "#16161f",
              border: "1px solid #2a2a35",
              borderRadius: 8,
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
            }}
          >
            <strong>Telemetry ID:</strong>{" "}
            <code data-testid="telemetry-id">{telemetryId}</code>
          </div>

          <details open style={{ marginBottom: "1rem" }}>
            <summary style={{ cursor: "pointer", marginBottom: "0.5rem" }}>
              Error
            </summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                background: "#16161f",
                padding: "1rem",
                borderRadius: 8,
                border: "1px solid #2a2a35",
              }}
            >
              {error?.name}: {error?.message}
              {"\n\n"}
              {error?.stack}
            </pre>
          </details>

          {errorInfo && (
            <details>
              <summary style={{ cursor: "pointer", marginBottom: "0.5rem" }}>
                Component stack
              </summary>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  background: "#16161f",
                  padding: "1rem",
                  borderRadius: 8,
                  border: "1px solid #2a2a35",
                }}
              >
                {errorInfo.componentStack}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleReload}
            style={{
              marginTop: "1.5rem",
              padding: "0.6rem 1rem",
              borderRadius: 8,
              border: "1px solid #4f46e5",
              background: "#4f46e5",
              color: "white",
              cursor: "pointer",
            }}
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
