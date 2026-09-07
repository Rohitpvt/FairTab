import React, { useRef, useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Compass, Plus, Bell, Settings } from "lucide-react";

export interface MobileNavigationProps {
  onAddClick: () => void;
}

const TABS = [
  { label: "Home", path: "/overview", icon: Home },
  { label: "Groups", path: "/groups", icon: Compass },
  { label: "Add", path: "#", icon: Plus, isAction: true },
  { label: "Activity", path: "/notifications", icon: Bell },
  { label: "Profile", path: "/settings", icon: Settings },
];

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ onAddClick }) => {
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const [lampLeft, setLampLeft] = useState<number | null>(null);

  // Update tubelight beam position based on active route
  useEffect(() => {
    const activeIndex = TABS.findIndex(
      (tab) => !tab.isAction && location.pathname.startsWith(tab.path)
    );

    if (activeIndex !== -1 && tabRefs.current[activeIndex] && navRef.current) {
      const tabEl = tabRefs.current[activeIndex];
      const navRect = navRef.current.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      const relativeLeft = tabRect.left - navRect.left + tabRect.width / 2;
      setLampLeft(relativeLeft);
    } else {
      // Default position if no exact match (e.g. initial render on overview)
      if (tabRefs.current[0] && navRef.current) {
        const tabEl = tabRefs.current[0];
        const navRect = navRef.current.getBoundingClientRect();
        const tabRect = tabEl.getBoundingClientRect();
        setLampLeft(tabRect.left - navRect.left + tabRect.width / 2);
      }
    }
  }, [location.pathname]);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!navRef.current) return;
    const rect = navRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    navRef.current.style.setProperty("--mouse-x", `${x}px`);
    navRef.current.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 pb-safe z-30 pointer-events-none flex justify-center">
      <nav
        ref={navRef}
        onMouseMove={handleMouseMove}
        className="pointer-events-auto w-full max-w-[420px] rounded-2xl liquid-glass-nav px-2 py-2 flex items-center justify-around shadow-2xl relative overflow-hidden"
      >
        {/* Interactive Glare Layer */}
        <div className="liquid-glare-layer">
          <div className="liquid-glare-spot" />
        </div>

        {/* Tubelight Spotlight Beam Lamp */}
        {lampLeft !== null && (
          <div
            className="tubelight-lamp"
            style={{ left: `${lampLeft}px` }}
          >
            <div className="tubelight-ray" />
          </div>
        )}

        {TABS.map((tab, idx) => {
          const Icon = tab.icon;

          if (tab.isAction) {
            return (
              <button
                key={idx}
                onClick={onAddClick}
                className="relative flex flex-col items-center justify-center p-1 cursor-pointer select-none -translate-y-3.5 z-20 group"
                aria-label="Add new expense"
              >
                <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-accent-indigo via-accent-violet to-accent-cyan flex items-center justify-center text-white shadow-lg shadow-accent-indigo/40 active:scale-85 hover:scale-105 transition-all duration-200 border-2 border-white/40">
                  <Plus className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
                </div>
              </button>
            );
          }

          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              ref={(el) => { tabRefs.current[idx] = el; }}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center py-1 px-2 text-center select-none gap-0.5 min-w-[52px] min-h-[44px] rounded-xl transition-all duration-300 z-10 active:scale-85 ${
                  isActive
                    ? "text-accent-cyan font-bold"
                    : "text-text-muted hover:text-text-primary opacity-60 hover:opacity-100"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-5 w-5 transition-all duration-300 ${
                      isActive ? "scale-110 drop-shadow-[0_0_8px_hsl(var(--accent-cyan)/0.6)] opacity-100" : ""
                    }`}
                  />
                  <span className={`text-[10px] tracking-tight transition-all duration-300 ${isActive ? "font-bold text-text-primary" : "font-medium"}`}>
                    {tab.label}
                  </span>
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
