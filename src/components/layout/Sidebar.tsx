import React from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Compass,
  DollarSign,
  CheckSquare,
  BarChart2,
  Repeat,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Sparkles,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../features/auth/AuthProvider";
import { BrandLogo } from "../ui/BrandLogo";

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse }) => {
  const { signOut } = useAuth();

  const menuItems = [
    { label: "Overview", path: "/overview", icon: Home },
    { label: "Groups", path: "/groups", icon: Compass },
    { label: "Expenses", path: "/expenses", icon: DollarSign },
    { label: "Settlements", path: "/settlements", icon: CheckSquare },
    { label: "Analytics", path: "/analytics", icon: BarChart2 },
    { label: "Budgets", path: "/budgets", icon: Wallet },
    { label: "Insights", path: "/insights", icon: Sparkles },
    { label: "Recurring", path: "/recurring", icon: Repeat },
    { label: "Notifications", path: "/notifications", icon: Bell },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col h-screen sticky top-0 border-r border-border-color glass-standard z-30 transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-[width] ${
        isCollapsed ? "w-[76px]" : "w-[256px]"
      }`}
    >
      {/* Brand logo header */}
      <div className="flex items-center px-4 py-4 border-b border-border-color/60 min-h-[72px] overflow-hidden">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center p-1.5 shrink-0 shadow-lg shadow-accent-indigo/10 backdrop-blur-md">
            <BrandLogo size="sm" className="h-full w-full object-contain filter drop-shadow-[0_0_8px_rgba(134,59,255,0.4)]" />
          </div>
          <div
            className={`flex flex-col overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
              isCollapsed ? "max-w-0 opacity-0 pointer-events-none" : "max-w-[160px] opacity-100"
            }`}
          >
            <span className="font-extrabold text-base text-text-primary tracking-tight leading-none">
              FairTab
            </span>
            <span className="text-[10px] font-medium text-text-muted mt-0.5">
              Split Fairly
            </span>
          </div>
        </div>
      </div>

      {/* Nav Link Listings */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                  isActive
                    ? "bg-accent-indigo text-white shadow-sm shadow-accent-indigo/30 font-semibold"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary active:scale-[0.98]"
                } ${isCollapsed ? "justify-center" : "gap-3"}`
              }
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <span
                className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
                  isCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Actions: Sign Out & Collapse Trigger */}
      <div className="p-3 border-t border-border-color/60 flex flex-col gap-1 bg-surface-primary/30">
        {/* Sign Out Button */}
        <button
          onClick={() => signOut()}
          className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-danger hover:bg-danger/10 active:scale-[0.98] transition-all duration-200 cursor-pointer group ${
            isCollapsed ? "justify-center" : "gap-3"
          }`}
          title={isCollapsed ? "Sign Out" : undefined}
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
          <span
            className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
              isCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"
            }`}
          >
            Sign Out
          </span>
        </button>

        {/* Collapse button trigger */}
        <button
          onClick={onToggleCollapse}
          className={`flex items-center px-3 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text-primary hover:bg-white/5 active:scale-[0.98] transition-all duration-200 cursor-pointer ${
            isCollapsed ? "justify-center" : "gap-3"
          }`}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-300" />
          ) : (
            <ChevronLeft className="h-4 w-4 shrink-0 transition-transform duration-300" />
          )}
          <span
            className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
              isCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"
            }`}
          >
            Collapse
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

