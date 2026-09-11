import React, { useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { NavLink } from "react-router-dom";
import {
  DollarSign,
  CheckSquare,
  BarChart2,
  Wallet,
  Repeat,
  Calculator,
  X,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../features/auth/AuthProvider";
import { BrandLogo } from "../ui/BrandLogo";
import { QuickCalculator } from "./QuickCalculator";
import { triggerHaptic } from "../../utils/haptics";

export interface MobileDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onOpenChange }) => {
  const { signOut } = useAuth();
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const menuItems = [
    {
      label: "Expenses",
      path: "/expenses",
      icon: DollarSign,
      description: "Full transaction ledger & filters",
      badgeColor: "text-accent-indigo",
    },
    {
      label: "Settlements",
      path: "/settlements",
      icon: CheckSquare,
      description: "Balances & debt payoff",
      badgeColor: "text-accent-cyan",
    },
    {
      label: "Analytics & Insights",
      path: "/analytics",
      icon: BarChart2,
      description: "Spending trends, AI insights & ledgers",
      badgeColor: "text-accent-violet",
    },
    {
      label: "Budgets",
      path: "/budgets",
      icon: Wallet,
      description: "Category limits & alerts",
      badgeColor: "text-amber-400",
    },
    {
      label: "Recurring",
      path: "/recurring",
      icon: Repeat,
      description: "Subscriptions & scheduled bills",
      badgeColor: "text-sky-400",
    },
  ];

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        {/* Backdrop Overlay */}
        <RadixDialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 transition-all duration-300" />

        {/* Bottom Sheet / Drawer Content */}
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed bottom-0 left-0 right-0 max-h-[85vh] z-50 overflow-hidden rounded-t-3xl border-t border-white/15 bg-surface-primary/95 backdrop-blur-2xl text-text-primary shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300 flex flex-col"
        >
          {/* Grab Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Drawer Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <BrandLogo size="sm" className="shrink-0 rounded-xl" />
              <div>
                <RadixDialog.Title className="text-base font-bold text-text-primary">
                  More Features
                </RadixDialog.Title>
                <p className="text-[11px] text-text-muted">Quick access to all FairTab tools</p>
              </div>
            </div>
            <RadixDialog.Close asChild>
              <button
                className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </RadixDialog.Close>
          </div>

          {/* Navigation Links Grid / List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1.5 pb-safe">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    triggerHaptic("selection");
                    onOpenChange(false);
                  }}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all duration-200 group cursor-pointer border ${
                      isActive
                        ? "bg-accent-indigo/15 border-accent-indigo/30 text-white shadow-sm"
                        : "border-white/5 hover:bg-white/[0.04] text-text-secondary hover:text-text-primary active:scale-[0.98]"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div
                        className={`p-2 rounded-xl transition-colors ${
                          isActive ? "bg-accent-indigo text-white shadow-sm shadow-accent-indigo/40" : "bg-white/5 group-hover:bg-white/10"
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${isActive ? "text-white" : item.badgeColor}`} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className="block text-sm font-semibold text-text-primary">
                          {item.label}
                        </span>
                        <span className="block text-xs text-text-muted truncate">
                          {item.description}
                        </span>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity ${
                          isActive ? "opacity-90 text-accent-cyan" : ""
                        }`}
                      />
                    </>
                  )}
                </NavLink>
              );
            })}

            {/* Quick Calculator Item */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                onOpenChange(false);
                setIsCalculatorOpen(true);
              }}
              className="flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all duration-200 group cursor-pointer border border-amber-400/15 bg-amber-400/[0.04] hover:bg-amber-400/[0.08] text-text-secondary hover:text-text-primary active:scale-[0.98] w-full text-left"
              aria-label="Open Quick Calculator"
            >
              <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400 group-hover:bg-amber-400/20 transition-colors">
                <Calculator className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="block text-sm font-semibold text-text-primary">
                    Quick Calculator
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Split & Tip
                  </span>
                </div>
                <span className="block text-xs text-text-muted truncate">
                  Fast bill math, tip presets & split shortcuts
                </span>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity text-amber-400" />
            </button>

            {/* Legal Links in Mobile Drawer */}
            <div className="flex items-center justify-center gap-3 pt-2 text-[11px] text-text-muted">
              <a
                href="#/privacy"
                onClick={() => onOpenChange(false)}
                className="hover:text-text-primary transition-colors py-1"
              >
                Privacy
              </a>
              <span>•</span>
              <a
                href="#/terms"
                onClick={() => onOpenChange(false)}
                className="hover:text-text-primary transition-colors py-1"
              >
                Terms
              </a>
              <span>•</span>
              <a
                href="#/cookies"
                onClick={() => onOpenChange(false)}
                className="hover:text-text-primary transition-colors py-1"
              >
                Cookies
              </a>
              <span>•</span>
              <a
                href="#/refund"
                onClick={() => onOpenChange(false)}
                className="hover:text-text-primary transition-colors py-1"
              >
                Refunds
              </a>
            </div>

            {/* Bottom Actions: Sign Out */}
            <div className="pt-2 mt-1 border-t border-white/10">
              <button
                onClick={() => {
                  onOpenChange(false);
                  signOut();
                }}
                className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-danger hover:bg-danger/10 active:scale-[0.98] transition-all duration-200 cursor-pointer group border border-danger/15 bg-danger/5"
                aria-label="Sign out"
              >
                <div className="p-2 rounded-xl bg-danger/10 text-danger group-hover:bg-danger/20 transition-colors">
                  <LogOut className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
                </div>
                <div className="flex-1 text-left">
                  <span className="block text-sm font-bold text-danger">Sign Out</span>
                  <span className="block text-xs text-danger/70">Log out of your FairTab account</span>
                </div>
              </button>
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>

      {/* Quick Calculator Modal */}
      <QuickCalculator
        isOpen={isCalculatorOpen}
        onOpenChange={setIsCalculatorOpen}
      />
    </RadixDialog.Root>
  );
};

export default MobileDrawer;
