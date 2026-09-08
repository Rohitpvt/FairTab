import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Cookie, HardDrive, CheckCircle2 } from "lucide-react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { BrandLogo } from "../../components/ui/BrandLogo";

export const CookiePolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen text-text-primary app-background p-4 sm:p-8 flex justify-center selection:bg-accent-cyan/30">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        {/* Header & Back Navigation */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-cyan rounded-lg p-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Application
          </Link>
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <span className="font-extrabold text-sm tracking-tight text-text-primary">FairTab</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-left">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <Cookie className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Legal & Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            Cookie &amp; Local Storage Policy
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Last Updated: September 8, 2026 • Effective Immediately
          </p>
        </div>

        {/* Content Panels */}
        <div className="flex flex-col gap-6 text-left text-xs sm:text-sm text-text-secondary leading-relaxed">
          {/* Section 1: Overview */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent-cyan" />
              1. What Are Cookies and Local Storage?
            </h2>
            <p>
              Cookies, Web Storage (<code>localStorage</code> and <code>sessionStorage</code>), and client databases (<code>IndexedDB</code>) are standard browser technologies that allow modern web applications to store small amounts of data locally on your device to enable core functionality.
            </p>
          </GlassPanel>

          {/* Section 2: How FairTab Uses Storage */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-accent-indigo" />
              2. Strictly Necessary Storage Only (No Ad Trackers)
            </h2>
            <p>
              Under global standards (including the EU ePrivacy Directive and GDPR Article 5(3)), FairTab utilizes storage <strong>solely for strictly necessary application operations</strong>:
            </p>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-text-primary font-bold">
                    <th className="py-2 pr-4">Storage Key / Engine</th>
                    <th className="py-2 pr-4">Purpose</th>
                    <th className="py-2">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-2.5 pr-4 font-mono text-accent-cyan">fairtab:theme</td>
                    <td className="py-2.5 pr-4">Remembers your Dark / Light theme preference.</td>
                    <td className="py-2.5">Persistent</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-mono text-accent-cyan">fairtab:cookie_consent</td>
                    <td className="py-2.5 pr-4">Remembers that you acknowledged this disclosure notice.</td>
                    <td className="py-2.5">Persistent</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-mono text-accent-cyan">Firebase Auth Token</td>
                    <td className="py-2.5 pr-4">Maintains your authenticated session securely.</td>
                    <td className="py-2.5">Session / Persistent</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-mono text-accent-cyan">IndexedDB (Dexie)</td>
                    <td className="py-2.5 pr-4">Offline outbox queue and local cached group ledgers.</td>
                    <td className="py-2.5">User Controlled</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </GlassPanel>

          {/* Section 3: Third Party Embeds */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary">
              3. Third-Party Tracking Disclosures
            </h2>
            <p>
              FairTab contains <strong>zero</strong> advertising trackers, zero social pixel widgets, and zero third-party surveillance cookies.
            </p>
          </GlassPanel>

          {/* Section 4: Clearing Your Data */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary">
              4. How to Manage and Clear Storage
            </h2>
            <p>
              You can wipe all offline IndexedDB caches directly at any time by clicking <strong>Flush Local Cache</strong> in your <Link to="/settings" className="text-accent-cyan hover:underline font-medium">Settings page</Link>, or by clearing site data in your web browser settings.
            </p>
          </GlassPanel>
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-wrap items-center justify-between text-xs text-text-muted border-t border-white/10 pt-4 mt-2">
          <p>© 2026 FairTab. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-text-primary transition-colors">Terms of Service</Link>
            <Link to="/refund" className="hover:text-text-primary transition-colors">Refund Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicyPage;
