import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Menu as MenuIcon,
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
  LogOut,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";

export const MobileMenuDrawer: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const menuItems = [
    { label: "Home", path: "/overview", icon: Home },
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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="relative flex flex-col items-center justify-center py-1 px-2 text-center select-none gap-0.5 min-w-[52px] min-h-[44px] rounded-xl transition-all duration-300 z-10 active:scale-85 text-text-muted hover:text-text-primary opacity-60 hover:opacity-100 cursor-pointer focus:outline-none"
          aria-label="Open mobile navigation menu"
        >
          <MenuIcon className="h-5 w-5 transition-all duration-300" />
          <span className="text-[10px] tracking-tight font-medium">
            Menu
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="end"
          sideOffset={16}
          className="w-64 glass-elevated border border-white/15 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 data-[side=top]:slide-in-from-bottom-2 focus:outline-none mb-2"
        >
          <div className="px-3 py-1.5 text-[11px] font-bold text-text-muted uppercase tracking-wider">
            Navigation Menu
          </div>

          <DropdownMenu.Separator className="h-px bg-white/10 my-1" />

          <div className="flex flex-col gap-0.5 max-h-[60vh] overflow-y-auto pr-0.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <DropdownMenu.Item
                  key={item.path}
                  onSelect={() => navigate(item.path)}
                  className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl cursor-pointer transition-colors focus:outline-none select-none ${
                    isActive
                      ? "bg-accent-indigo text-white font-semibold shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:bg-white/10 focus:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </DropdownMenu.Item>
              );
            })}
          </div>

          <DropdownMenu.Separator className="h-px bg-white/10 my-1" />

          <DropdownMenu.Item
            onSelect={() => signOut()}
            className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10 rounded-xl cursor-pointer transition-colors focus:bg-danger/10 focus:outline-none select-none"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign Out</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export default MobileMenuDrawer;
