import React, { useState } from "react";
import { RefreshCw, Home, ArrowLeft, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import bgGif from "../../assets/404-bg.gif";

export interface Animated404ErrorViewProps {
  statusCode?: string | number;
  title?: string;
  subtitle?: string;
  errorMessage?: string;
  showTryAgain?: boolean;
  onTryAgain?: () => void;
  homePath?: string;
  homeLabel?: string;
  showBackButton?: boolean;
  compact?: boolean;
}

export const Animated404ErrorView: React.FC<Animated404ErrorViewProps> = ({
  statusCode = "404",
  title = "Look like you're lost",
  subtitle = "The page you are looking for is not available or failed to load!",
  errorMessage,
  showTryAgain = true,
  onTryAgain,
  homePath = "#/overview",
  homeLabel = "Return to Dashboard",
  showBackButton = true,
  compact = false,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const handleTryAgain = async () => {
    setIsRetrying(true);
    try {
      if (onTryAgain) {
        await Promise.resolve(onTryAgain());
      } else {
        // Fallback: Reload the current window / hash route
        window.location.reload();
      }
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setTimeout(() => setIsRetrying(false), 600);
    }
  };

  const handleGoHome = () => {
    if (homePath.startsWith("#")) {
      window.location.hash = homePath;
      // If we are already on that hash or need state reset
      if (window.location.hash === homePath) {
        window.location.reload();
      }
    } else {
      window.location.href = homePath;
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      handleGoHome();
    }
  };

  return (
    <section
      role="region"
      aria-label="Error page"
      className={`w-full flex items-center justify-center p-3 sm:p-6 transition-all duration-300 animate-fade-in ${
        compact ? "min-h-[420px]" : "min-h-[75vh]"
      }`}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-white text-slate-800 rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden relative selection:bg-emerald-500 selection:text-white">
        {/* Animated 404 / Error Canvas Background */}
        <div
          className="relative w-full flex items-start justify-center overflow-hidden"
          style={{
            backgroundImage: `url(${bgGif})`,
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "contain",
            height: compact ? "240px" : "320px",
            minHeight: "220px",
          }}
        >
          {/* Subtle gradient overlay to soften top border */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-white pointer-events-none" />

          {/* Centered Large 404 / Error Code Header */}
          <h1 className="relative z-10 text-6xl xs:text-7xl sm:text-8xl font-black text-slate-800/90 tracking-wider select-none pt-4 sm:pt-6 font-serif drop-shadow-sm">
            {statusCode}
          </h1>
        </div>

        {/* Content Box */}
        <div className="relative z-20 px-4 sm:px-8 pb-8 pt-0 -mt-6 sm:-mt-8 text-center bg-white">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mb-2 font-serif">
            {title}
          </h2>

          <p className="text-xs sm:text-sm md:text-base text-slate-600 max-w-md mx-auto leading-relaxed mb-6 font-sans">
            {subtitle}
          </p>

          {/* Optional Error Trace Box */}
          {errorMessage && (
            <div className="max-w-lg mx-auto mb-6 text-left">
              <button
                type="button"
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
              >
                <span className="flex items-center gap-1.5 text-danger">
                  <AlertCircle className="h-4 w-4" />
                  Technical Details
                </span>
                {showErrorDetails ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </button>

              {showErrorDetails && (
                <div className="mt-2 p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] sm:text-xs overflow-x-auto shadow-inner max-h-36 border border-slate-800">
                  <pre className="whitespace-pre-wrap break-words">{errorMessage}</pre>
                </div>
              )}
            </div>
          )}

          {/* Interactive Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto pt-1">
            {showTryAgain && (
              <button
                type="button"
                onClick={handleTryAgain}
                disabled={isRetrying}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#39ac31] hover:bg-[#32962b] text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-75 cursor-pointer min-h-[44px]"
              >
                <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Retrying..." : "Try Again"}
              </button>
            )}

            <button
              type="button"
              onClick={handleGoHome}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer min-h-[44px]"
            >
              <Home className="h-4 w-4" />
              {homeLabel}
            </button>

            {showBackButton && (
              <button
                type="button"
                onClick={handleGoBack}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer min-h-[44px]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Animated404ErrorView;
