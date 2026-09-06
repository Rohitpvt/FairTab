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

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty("--mouse-x", `${x}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 pb-safe z-30 pointer-events-none flex justify-center">
      <nav
        onMouseMove={handleMouseMove}
        className="pointer-events-auto w-full max-w-[420px] rounded-full liquid-glass-nav px-3 py-2 flex items-center justify-around shadow-2xl relative"
      >
        {/* Interactive Glare Layer */}
        <div className="liquid-glare-layer">
          <div className="liquid-glare-spot" />
        </div>

        {tabs.map((tab, idx) => {
          const Icon = tab.icon;

          if (tab.isAction) {
            return (
              <button
                key={idx}
                onClick={onAddClick}
                className="relative flex flex-col items-center justify-center p-1 cursor-pointer select-none -translate-y-4 z-10"
                aria-label="Add new expense"
              >
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-accent-indigo via-accent-violet to-accent-cyan flex items-center justify-center text-white shadow-lg shadow-accent-indigo/30 active:scale-90 transition-transform duration-200 border-2 border-white/30">
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
                `relative flex flex-col items-center justify-center p-1.5 text-center select-none gap-0.5 min-w-[48px] min-h-[44px] rounded-full transition-all duration-300 z-10 active:scale-90 ${
                  isActive
                    ? "text-accent-cyan font-bold"
                    : "text-text-secondary hover:text-text-primary"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute inset-0 bg-white/10 dark:bg-white/[0.08] rounded-full -z-10 shadow-inner border border-white/10" />
                  )}
                  <Icon className={`h-5 w-5 transition-transform duration-300 ${isActive ? "scale-110" : ""}`} />
                  <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
export default MobileNavigation;
