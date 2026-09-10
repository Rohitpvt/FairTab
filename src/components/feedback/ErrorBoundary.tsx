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
        <Animated404ErrorView
          statusCode="500"
          title={this.props.fallbackTitle || "Failed to Load Section"}
          subtitle="An unexpected error occurred while loading or displaying this page."
          errorMessage={this.state.error?.message || "Unknown client runtime error"}
          showTryAgain={true}
          onTryAgain={() => this.setState({ hasError: false, error: null })}
          homePath="#/overview"
          homeLabel="Return to Dashboard"
          compact={this.props.compact}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
