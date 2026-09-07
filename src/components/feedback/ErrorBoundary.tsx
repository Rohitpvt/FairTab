import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "../ui/Button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
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
    console.error("Uncaught error in component tree:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
          <div className="h-14 w-14 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger mb-4 shadow-lg shadow-danger/10">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-text-primary mb-2">
            {this.props.fallbackTitle || "Something went wrong displaying this page"}
          </h2>
          <p className="text-xs text-text-muted leading-relaxed mb-6">
            An unexpected error occurred while processing this section:
            <br />
            <span className="font-mono text-[11px] text-danger/80 bg-danger/5 px-2 py-1 rounded mt-2 inline-block max-w-full truncate">
              {this.state.error?.message || "Unknown error"}
            </span>
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              className="flex items-center gap-1.5 text-xs"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
            <Button
              variant="gradient"
              size="sm"
              className="flex items-center gap-1.5 text-xs"
              onClick={() => {
                window.location.hash = "#/overview";
                window.location.reload();
              }}
            >
              <Home className="h-3.5 w-3.5" />
              Go to Overview
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
