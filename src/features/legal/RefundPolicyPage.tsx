import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCcw, DollarSign, ShieldCheck } from "lucide-react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { BrandLogo } from "../../components/ui/BrandLogo";

export const RefundPolicyPage: React.FC = () => {
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
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <RefreshCcw className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Legal & Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            Refund &amp; Cancellation Policy
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Last Updated: September 8, 2026 • Effective Immediately
          </p>
        </div>

        {/* Content Panels */}
        <div className="flex flex-col gap-6 text-left text-xs sm:text-sm text-text-secondary leading-relaxed">
          {/* Section 1: Service Structure */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent-cyan" />
              1. Platform Nature &amp; Free Tier
            </h2>
            <p>
              FairTab provides free, open-access collaborative ledger calculation and receipt scanning features. We do not charge subscription fees or transaction charges for standard split recording and balance calculation.
            </p>
          </GlassPanel>

          {/* Section 2: P2P Expense Reimbursements */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl border-white/10">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-400" />
              2. Member-to-Member Settlement Disputes &amp; Off-Platform Payments
            </h2>
            <p className="font-medium text-text-primary">
              All financial settlements logged in FairTab occur directly between individual users outside the application (via cash, UPI, bank transfer, or third-party payment apps).
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li>
                <strong>No In-App Payment Custody:</strong> FairTab does not receive, intermediate, hold, or reverse any peer-to-peer repayments.
              </li>
              <li>
                <strong>P2P Refund Requests:</strong> If you accidentally send funds to a group member via external payment methods, you must resolve the reimbursement or refund directly with that individual.
              </li>
              <li>
                <strong>Ledger Adjustments:</strong> If an expense or settlement was recorded in error, members can edit or void the transaction directly in FairTab to correct the mathematical balance equations immediately.
              </li>
            </ul>
          </GlassPanel>

          {/* Section 3: Future Paid Upgrades */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary">
              3. Commercial Services &amp; Enterprise Tiers
            </h2>
            <p>
              Should FairTab introduce optional commercial cloud storage or enterprise add-ons in the future, all paid services will be accompanied by explicit refund terms complying with statutory 14-day consumer withdrawal rights (such as the EU Consumer Rights Directive).
            </p>
          </GlassPanel>
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-wrap items-center justify-between text-xs text-text-muted border-t border-white/10 pt-4 mt-2">
          <p>© 2026 FairTab. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-text-primary transition-colors">Terms of Service</Link>
            <Link to="/cookies" className="hover:text-text-primary transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicyPage;
