import React from "react";
import { NavLink } from "react-router-dom";
import * as RadixDialog from "@radix-ui/react-dialog";
import {
  Home,
  Compass,
  DollarSign,
  CheckSquare,
  BarChart2,
  Wallet,
  Sparkles,
  Repeat,
  Bell,
  Settings,
  X,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../features/auth/AuthProvider";
import { BrandLogo } from "../ui/BrandLogo";
import { MemberAvatar } from "../ui/Avatar";
import { ThemeToggle } from "../feedback/FeedbackStates";

export interface MobileDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const MENU_ITEMS = [
  { label: "Overview", path: "/overview", icon: Home, description: "Dashboard & stats" },
  { label: "Groups", path: "/groups", icon: Compass, description: "Manage group expenses" },
  { label: "Expenses", path: "/expenses", icon: DollarSign, description: "All recorded transactions" },
  { label: "Settlements", path: "/settlements", icon: CheckSquare, description: "Balances & debt payoff" },
  { label: "Analytics", path: "/analytics", icon: BarChart2, description: "Spending trends & charts" },
  { label: "Budgets", path: "/budgets", icon: Wallet, description: "Category limits & alerts" },
  { label: "Insights", path: "/insights", icon: Sparkles, description: "Smart AI recommendations" },
  { label: "Recurring", path: "/recurring", icon: Repeat, description: "Automated bills & subs" },
  { label: "Notifications", path: "/notifications", icon: Bell, description: "Activity & updates" },
  { label: "Settings", path: "/settings", icon: Settings, description: "Preferences & profile" },
];

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const { user, profile, signOut } = useAuth();
  const name = profile?.displayName || user?.displayName || user?.email || "User";
  const avatarUrl = profile?.photoURL || user?.photoURL || "";

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        {/* Overlay Backdrop */}
        <RadixDialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 transition-opacity duration-200 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />

        {/* Slide-in Mobile Drawer (Left) */}
        <RadixDialog.Content
          className="fixed inset-y-0 left-0 w-[84vw] max-w-[320px] bg-surface-primary/95 border-r border-white/10 shadow-2xl z-50 flex flex-col justify-between focus:outline-none transition-transform duration-300 ease-out data-[state=open]:translate-x-0 data-[state=closed]:-translate-x-full backdrop-blur-xl"
          aria-describedby="mobile-drawer-description"
        >
          <div className="flex flex-col h-full overflow-hidden">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 min-h-[72px] bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <BrandLogo size="md" className="shrink-0 shadow-lg shadow-accent-cyan/20 rounded-xl" />
                <div className="flex flex-col">
                  <RadixDialog.Title className="font-extrabold text-base text-text-primary tracking-tight leading-none">
                    FairTab
                  </RadixDialog.Title>
                  <span className="text-[10px] font-medium text-text-muted mt-0.5">
                    Split Fairly
                  </span>
                </div>
              </div>
              <RadixDialog.Close asChild>
                <button
                  className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-white/5 active:scale-95 transition-all cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center border border-white/5"
                  aria-label="Close navigation menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </RadixDialog.Close>
            </div>

            <p id="mobile-drawer-description" className="sr-only">
              Navigation menu with all FairTab pages and options.
            </p>

            {/* User Profile Banner in Drawer */}
            <div className="px-5 py-3 border-b border-white/5 bg-surface-hover/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <MemberAvatar name={name} avatarUrl={avatarUrl} size="sm" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-text-primary truncate">
                    {name}
                  </span>
                  <span className="text-[10px] text-text-muted truncate">
                    {user?.email || "Signed in"}
                  </span>
                </div>
              </div>
              <ThemeToggle />
            </div>

            {/* Navigation Links (All 10 Sections) */}
            <nav className="flex-1 px-3 py-3 overflow-y-auto flex flex-col gap-1 select-none">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => onOpenChange(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group active:scale-[0.98] ${
                        isActive
                          ? "bg-accent-indigo text-white shadow-md shadow-accent-indigo/25 font-semibold"
                          : "text-text-secondary hover:bg-white/[0.04] hover:text-text-primary"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div
                          className={`p-1.5 rounded-lg transition-colors ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-white/[0.03] text-text-secondary group-hover:text-accent-cyan group-hover:bg-accent-cyan/10"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0 text-left">
                          <span className="leading-snug truncate font-semibold">
                            {item.label}
                          </span>
                          <span
                            className={`text-[10px] truncate ${
                              isActive ? "text-white/80" : "text-text-muted"
                            }`}
                          >
                            {item.description}
                          </span>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity ${
                            isActive ? "opacity-90" : ""
                          }`}
                        />
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Bottom Actions: Sign Out */}
            <div className="p-3 border-t border-white/10 bg-surface-primary/60 pb-safe">
              <button
                onClick={() => {
                  onOpenChange(false);
                  signOut();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-danger hover:bg-danger/10 active:scale-[0.98] transition-all duration-200 cursor-pointer group"
                aria-label="Sign out"
              >
                <div className="p-1.5 rounded-lg bg-danger/10 text-danger group-hover:bg-danger/20 transition-colors">
                  <LogOut className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
                </div>
                <span className="font-semibold">Sign Out</span>
              </button>
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

export default MobileDrawer;
