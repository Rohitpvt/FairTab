import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, AlertTriangle, CheckCircle, Scale, ShieldAlert } from "lucide-react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { BrandLogo } from "../../components/ui/BrandLogo";

export const TermsPage: React.FC = () => {
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
          <div className="flex items-center gap-2 text-accent-indigo mb-2">
            <FileText className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Legal & Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            Terms of Service
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Last Updated: September 8, 2026 • Effective Immediately
          </p>
        </div>

        {/* Content Panels */}
        <div className="flex flex-col gap-6 text-left text-xs sm:text-sm text-text-secondary leading-relaxed">
          {/* Section 1: Acceptance */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing, registering for, or using the FairTab web application and progressive web app (the &ldquo;Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </GlassPanel>

          {/* Section 2: Mathematical Utility Disclaimer */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl border-warning/20 bg-warning/[0.02]">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2 text-warning">
              <ShieldAlert className="h-4 w-4" />
              2. Mathematical Calculation Utility &amp; Financial Disclaimer
            </h2>
            <p className="text-text-primary font-medium">
              FairTab is strictly a collaborative bookkeeping, expense recording, and mathematical debt simplification tool.
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li>
                <strong>Not a Bank or Money Transmitter:</strong> FairTab is not a financial institution, bank, escrow agent, money service business, or licensed payment gateway.
              </li>
              <li>
                <strong>No Holding of Funds:</strong> FairTab does not process, hold, transmit, custody, or handle real monetary funds between users.
              </li>
              <li>
                <strong>Settlement Verifications:</strong> When users mark a settlement as &ldquo;Cleared&rdquo;, this is a digital bookkeeping confirmation that an off-platform payment (e.g., cash, UPI, bank wire, peer-to-peer transfer) has occurred between the respective parties.
              </li>
            </ul>
          </GlassPanel>

          {/* Section 3: User Responsibilities & Acceptable Use */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Scale className="h-4 w-4 text-accent-cyan" />
              3. Acceptable Use &amp; Group Conduct
            </h2>
            <p>You agree that you will not use FairTab to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li>Enter fraudulent, defamatory, or unlawful expense claims against other individuals.</li>
              <li>Attempt to compromise or probe group ledger data for groups where you are not an authorized member.</li>
              <li>Upload malicious code or exploit offline mutation sync queues.</li>
            </ul>
          </GlassPanel>

          {/* Section 4: Limitation of Liability */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-danger" />
              4. Limitation of Liability &amp; &ldquo;As-Is&rdquo; Provision
            </h2>
            <p>
              The Service is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of any kind, whether express or implied. In no event shall FairTab, its creators, or contributors be liable for any indirect, incidental, consequential, or punitive damages arising out of ledger entry errors, disputes between group members, or offline data synchronization conflicts.
            </p>
          </GlassPanel>

          {/* Section 5: Termination & Updates */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary">
              5. Termination &amp; Governing Terms
            </h2>
            <p>
              You may terminate your agreement with FairTab at any time by deleting your account inside Settings. We reserve the right to modify these Terms, with updates posted directly on this page.
            </p>
          </GlassPanel>
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-wrap items-center justify-between text-xs text-text-muted border-t border-white/10 pt-4 mt-2">
          <p>© 2026 FairTab. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-text-primary transition-colors">Privacy Policy</Link>
            <Link to="/cookies" className="hover:text-text-primary transition-colors">Cookie Policy</Link>
            <Link to="/refund" className="hover:text-text-primary transition-colors">Refund Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
