import { Component, type ErrorInfo, type ReactNode } from "react";
import { Animated404ErrorView } from "./Animated404ErrorView";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorKey: number;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorKey: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in component tree:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorKey: prev.errorKey + 1,
    }));
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Animated404ErrorView
          statusCode="500"
          title={this.props.fallbackTitle || "Failed to Load Section"}
          subtitle="An unexpected error occurred while loading or displaying this page."
          errorMessage={this.state.error?.message || "Unknown client runtime error"}
          showTryAgain={true}
          onTryAgain={this.handleReset}
          homePath="#/overview"
          homeLabel="Return to Dashboard"
          compact={this.props.compact}
        />
      );
    }

    return <div key={this.state.errorKey} className="contents">{this.props.children}</div>;
  }
}

export default ErrorBoundary;
