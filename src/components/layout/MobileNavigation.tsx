import React from "react";
import { NavLink } from "react-router-dom";
import { Home, Compass, Plus, Bell, Settings } from "lucide-react";

export interface MobileNavigationProps {
  onAddClick: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ onAddClick }) => {
  const tabs = [
    { label: "Home", path: "/overview", icon: Home },
    { label: "Groups", path: "/groups", icon: Compass },
    { label: "Add", path: "#", icon: Plus, isAction: true },
    { label: "Activity", path: "/notifications", icon: Bell },
    { label: "Profile", path: "/settings", icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-white/5 glass-standard px-4 py-2 pb-safe flex items-center justify-around z-30">
      {tabs.map((tab, idx) => {
        const Icon = tab.icon;

        if (tab.isAction) {
          return (
            <button
              key={idx}
              onClick={onAddClick}
              className="flex flex-col items-center justify-center p-1 cursor-pointer select-none -translate-y-4"
              aria-label="Add new expense"
            >
              <div className="h-12 w-12 rounded-full bg-gradient-to-r from-accent-indigo via-accent-violet to-accent-cyan flex items-center justify-center text-text-primary shadow-lg shadow-accent-indigo/20 active:scale-95 transition-transform border border-white/10">
                <Plus className="h-6 w-6" />
              </div>
            </button>
          );
        }

        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center p-1 text-center select-none gap-0.5 min-w-[44px] min-h-[44px] ${
                isActive ? "text-accent-cyan" : "text-text-secondary hover:text-text-primary"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
export default MobileNavigation;
