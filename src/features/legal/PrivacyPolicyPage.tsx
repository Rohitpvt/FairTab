import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Eye, Database, Globe } from "lucide-react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { BrandLogo } from "../../components/ui/BrandLogo";

export const PrivacyPolicyPage: React.FC = () => {
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
          <div className="flex items-center gap-2 text-accent-cyan mb-2">
            <Shield className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Legal & Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            Privacy Policy
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
              <Eye className="h-4 w-4 text-accent-indigo" />
              1. Our Core Privacy Philosophy
            </h2>
            <p>
              FairTab is built with a strict <strong>Data Minimization</strong> and <strong>Privacy-by-Design</strong> ethos. We believe that managing shared expenses among friends, roommates, and travel groups should never require invasive tracking, ad profiling, or behavioral harvesting.
            </p>
            <p>
              We do <strong>not</strong> sell, rent, monetize, or trade your personal data with third-party advertisers or data brokers under any circumstances.
            </p>
          </GlassPanel>

          {/* Section 2: Data We Collect */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Database className="h-4 w-4 text-accent-cyan" />
              2. Data We Collect & How We Use It
            </h2>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li>
                <strong className="text-text-primary">Account Credentials:</strong> When you register, we collect your display name, email address, and authentication tokens via Firebase Authentication.
              </li>
              <li>
                <strong className="text-text-primary">Ledger Records:</strong> Expense titles, amounts, categories, timestamps, split allocations, settlement payments, and group names you voluntarily enter.
              </li>
              <li>
                <strong className="text-text-primary">Receipt OCR Processing:</strong> When you scan a receipt, the image is processed via OCR for optical character extraction to identify line items. Receipt images are stored in secure cloud storage associated strictly with your group.
              </li>
              <li>
                <strong className="text-text-primary">Offline Cache:</strong> On private/trusted devices, client-side IndexedDB stores copies of your ledger for immediate offline access.
              </li>
            </ul>
          </GlassPanel>

          {/* Section 3: Legal Basis & Global Compliance */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Globe className="h-4 w-4 text-emerald-400" />
              3. Global Rights (GDPR, CCPA/CPRA, and Local Privacy Laws)
            </h2>
            <p>
              Regardless of your jurisdiction, FairTab extends full data sovereignty rights to every user:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li>
                <strong className="text-text-primary">Right of Access & Portability:</strong> You can export a full copy of your entire ledger in canonical JSON and standard CSV formats anytime from the Settings page.
              </li>
              <li>
                <strong className="text-text-primary">Right to Rectification:</strong> You can modify your display name and group transactions at any time.
              </li>
              <li>
                <strong className="text-text-primary">Right to Erasure (Deletion):</strong> You can permanently delete your account directly inside Settings. When deleted, all personal identification is wiped, and ledger entries are permanently anonymized to prevent equation discrepancies for other members.
              </li>
            </ul>
          </GlassPanel>

          {/* Section 4: Security & Encryption */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-400" />
              4. Data Security & Storage
            </h2>
            <p>
              All communication between your browser and FairTab infrastructure is encrypted via HTTPS (TLS 1.3). Firestore security rules enforce strict multi-tenant isolation, ensuring that only authenticated group members can read or append transactions to a shared ledger.
            </p>
          </GlassPanel>

          {/* Section 5: Contact & Disclosures */}
          <GlassPanel variant="standard" className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl">
            <h2 className="text-base font-bold text-text-primary">
              5. Contact & Privacy Inquiries
            </h2>
            <p>
              For any questions regarding this policy or to request data assistance, contact the development team at{" "}
              <span className="text-accent-cyan font-semibold">privacy@fairtab.app</span>.
            </p>
          </GlassPanel>
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-wrap items-center justify-between text-xs text-text-muted border-t border-white/10 pt-4 mt-2">
          <p>© 2026 FairTab. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-text-primary transition-colors">Terms of Service</Link>
            <Link to="/cookies" className="hover:text-text-primary transition-colors">Cookie Policy</Link>
            <Link to="/refund" className="hover:text-text-primary transition-colors">Refund Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
