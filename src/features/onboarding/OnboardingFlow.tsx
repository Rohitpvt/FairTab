import React, { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { profileService } from "../../infrastructure/firebase/profileService";
import { CURRENCIES } from "../../utils/currencies";
import { Button } from "../../components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Shield, RefreshCw, ChevronRight, ChevronLeft, Check, Smartphone } from "lucide-react";
import { toast } from "sonner";

export const OnboardingFlow: React.FC = () => {
  const { user, profile, refreshProfile, trustedDevice, setTrustedDevicePreference } = useAuth();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || "");
  const [defaultCurrency, setDefaultCurrency] = useState(profile?.defaultCurrency || "INR");
  const [isTrusted, setIsTrusted] = useState(trustedDevice);
  const [isSaving, setIsSaving] = useState(false);

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const handleComplete = async () => {
    if (!user) return;
    if (!displayName.trim()) {
      toast.error("Please enter a display name.");
      setStep(2);
      return;
    }

    setIsSaving(true);
    try {
      // 1. Save trusted-device choice (without reload to prevent interrupting layout)
      await setTrustedDevicePreference(isTrusted, false);

      // 2. Save updates to Firestore profile
      await profileService.updateUserProfile(user.uid, {
        displayName: displayName.trim(),
        defaultCurrency,
        onboardingCompleted: true
      });

      // 3. Trigger profile state update to ready
      await refreshProfile();
      toast.success("Welcome to FairTab! Onboarding completed.");
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      toast.error(errorObj.message || "Failed to save onboarding selections.");
    } finally {
      setIsSaving(false);
    }
  };

  const stepsCount = 5;

  return (
    <div className="flex min-h-screen text-text-primary app-background items-center justify-center p-4">
      <div className="w-full max-w-lg glass-elevated border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative">
        
        {/* Step indicator bar */}
        <div className="flex gap-1.5 mb-6 justify-center">
          {Array.from({ length: stepsCount }).map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 max-w-[40px] rounded-full transition-all duration-300 ${
                idx + 1 <= step ? "bg-accent-cyan" : "bg-white/5"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-5 text-center min-h-[280px]"
          >
            {/* STEP 1: Welcome */}
            {step === 1 && (
              <div className="flex flex-col gap-4 py-4 justify-center items-center flex-grow">
                <div className="p-3 bg-accent-indigo/10 border border-accent-indigo/20 rounded-full text-accent-indigo">
                  <Sparkles className="h-10 w-10 animate-pulse" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-text-primary via-text-secondary to-accent-cyan bg-clip-text text-transparent">
                  Welcome to FairTab
                </h1>
                <p className="text-xs text-text-secondary leading-relaxed max-w-xs">
                  Every expense, fairly shared. Keep track of group tabs, splits, and optimize your repayments completely offline.
                </p>
              </div>
            )}

            {/* STEP 2: Name and Currency */}
            {step === 2 && (
              <div className="flex flex-col gap-4 py-2 text-left flex-grow">
                <h2 className="text-lg font-bold text-text-primary text-center mb-1">
                  Tell us about yourself
                </h2>
                
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="onboard-name" className="text-xs font-semibold text-text-secondary">
                    Your Name
                  </label>
                  <input
                    id="onboard-name"
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="px-3.5 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="onboard-currency" className="text-xs font-semibold text-text-secondary">
                    Default Currency
                  </label>
                  <select
                    id="onboard-currency"
                    value={defaultCurrency}
                    onChange={(e) => setDefaultCurrency(e.target.value)}
                    className="px-3.5 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-secondary focus:outline-none focus:border-accent-cyan cursor-pointer"
                  >
                    {CURRENCIES.map((cur) => (
                      <option key={cur.code} value={cur.code}>
                        {cur.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* STEP 3: Trusted Device choice */}
            {step === 3 && (
              <div className="flex flex-col gap-4 py-2 text-left flex-grow">
                <h2 className="text-lg font-bold text-text-primary text-center mb-1">
                  Trusted Device Choice
                </h2>
                
                <div className="flex items-start gap-3 p-4 bg-surface-primary/30 border border-white/5 rounded-xl mt-2">
                  <input
                    id="onboard-remember"
                    type="checkbox"
                    checked={isTrusted}
                    onChange={(e) => setIsTrusted(e.target.checked)}
                    className="w-5 h-5 bg-surface-primary border border-white/10 rounded focus:ring-accent-cyan accent-accent-cyan mt-0.5 cursor-pointer shrink-0"
                  />
                  <div className="flex flex-col text-xs leading-normal">
                    <label htmlFor="onboard-remember" className="font-semibold text-text-secondary cursor-pointer">
                      Remember FairTab data on this device?
                    </label>
                    <p className="text-text-muted mt-1 leading-relaxed">
                      Enable this only on a private or trusted device. Cached account data may remain available after the browser closes.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xxs text-text-muted mt-2 px-1">
                  <Shield className="h-3.5 w-3.5 text-accent-cyan shrink-0" />
                  <span>Your choice updates auth persistence and offline Firestore structures.</span>
                </div>
              </div>
            )}

            {/* STEP 4: Caching & Sync explanations */}
            {step === 4 && (
              <div className="flex flex-col gap-4 py-2 text-left flex-grow">
                <h2 className="text-lg font-bold text-text-primary text-center mb-1">
                  Offline Caching & Cloud Sync
                </h2>
                
                <div className="flex flex-col gap-3.5 mt-2">
                  <div className="flex gap-3 text-xs leading-normal">
                    <div className="p-2 bg-accent-cyan/10 border border-accent-cyan/20 rounded-lg text-accent-cyan h-fit shrink-0">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-text-primary">Offline-First Engine</h4>
                      <p className="text-text-muted mt-0.5 leading-relaxed">
                        FairTab caches all layouts, routes, and preferences locally. If you chose a trusted device, transactions will also be persisted securely on this browser.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs leading-normal">
                    <div className="p-2 bg-accent-violet/10 border border-accent-violet/20 rounded-lg text-accent-violet h-fit shrink-0">
                      <RefreshCw className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-text-primary">Cloud Synchronization</h4>
                      <p className="text-text-muted mt-0.5 leading-relaxed">
                        Collaborative multi-user synchronization is deferred to future stages. Expenses entered during this phase are simulations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Completion */}
            {step === 5 && (
              <div className="flex flex-col gap-4 py-4 justify-center items-center flex-grow">
                <div className="p-3 bg-accent-cyan/10 border border-accent-cyan/20 rounded-full text-accent-cyan animate-bounce">
                  <Check className="h-10 w-10" />
                </div>
                <h2 className="text-xl font-bold text-text-primary">
                  Ready to start?
                </h2>
                <p className="text-xs text-text-secondary leading-relaxed max-w-xs">
                  Your profile has been created with default ISO configurations and your security preference has been logged. Let's head over to the dashboard.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-3 mt-6 border-t border-white/5 pt-4">
          {step > 1 ? (
            <Button
              onClick={prevStep}
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-text-secondary hover:text-text-primary"
              disabled={isSaving}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < stepsCount ? (
            <Button
              onClick={nextStep}
              variant="secondary"
              size="sm"
              className="flex items-center gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              variant="gradient"
              size="sm"
              isLoading={isSaving}
              loadingText="Initializing..."
            >
              Complete Setup
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;
