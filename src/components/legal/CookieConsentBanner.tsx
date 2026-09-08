import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, ShieldCheck, X } from "lucide-react";
import { Button } from "../ui/Button";

const COOKIE_CONSENT_KEY = "fairtab:cookie_consent_v1";

export const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(() => {
    try {
      return !localStorage.getItem(COOKIE_CONSENT_KEY);
    } catch {
      return false;
    }
  });

  const handleAccept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    } catch {
      // ignore
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Privacy and Local Storage Notice"
      role="region"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="glass-elevated border border-white/15 bg-surface-primary/95 backdrop-blur-2xl rounded-2xl p-4 sm:p-5 shadow-2xl text-left flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-text-primary font-bold text-xs">
            <div className="p-1.5 rounded-lg bg-accent-cyan/10 text-accent-cyan">
              <Cookie className="h-4 w-4" />
            </div>
            <span>Privacy &amp; Local Storage</span>
          </div>
          <button
            onClick={handleAccept}
            className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Dismiss privacy notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[11px] text-text-secondary leading-relaxed">
          FairTab uses strictly essential local storage and IndexedDB to keep your offline ledgers synced and remember your theme. We never use advertising trackers or sell your personal data.
        </p>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
          <div className="flex gap-2.5 text-[10px] text-text-muted">
            <Link to="/cookies" className="hover:text-accent-cyan transition-colors underline">
              Cookie Policy
            </Link>
            <span>•</span>
            <Link to="/privacy" className="hover:text-accent-cyan transition-colors underline">
              Privacy Policy
            </Link>
          </div>
          <Button
            size="sm"
            variant="gradient"
            onClick={handleAccept}
            className="text-xs py-1.5 px-3 h-auto min-h-[32px] flex items-center gap-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Got It
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default CookieConsentBanner;
