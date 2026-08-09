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
} from "lucide-react";

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse }) => {
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
      className={`hidden md:flex flex-col h-screen sticky top-0 border-r border-white/5 glass-standard z-30 transition-all duration-180 ease-out ${
        isCollapsed ? "w-[80px]" : "w-[256px]"
      }`}
    >
      {/* Brand logo header */}
      <div className="flex items-center justify-between p-5 border-b border-white/5 min-h-[72px]">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-r from-accent-indigo via-accent-violet to-accent-cyan flex items-center justify-center font-black text-sm text-text-primary">
              FT
            </div>
            <span className="font-extrabold text-lg text-text-primary tracking-tight">FairTab</span>
          </div>
        )}
        {isCollapsed && (
          <div className="mx-auto h-7 w-7 rounded-lg bg-gradient-to-r from-accent-indigo via-accent-violet to-accent-cyan flex items-center justify-center font-black text-sm text-text-primary">
            FT
          </div>
        )}
      </div>

      {/* Nav Link Listings */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent-indigo text-text-primary shadow-lg shadow-accent-indigo/10"
                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                } ${isCollapsed ? "justify-center" : ""}`
              }
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse button trigger */}
      <div className="p-4 border-t border-white/5 flex items-center justify-center">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-white/5 text-text-secondary hover:text-text-primary transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
    </aside>
  );
};
