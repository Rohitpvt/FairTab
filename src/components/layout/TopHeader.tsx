import React from "react";
import { Search } from "lucide-react";
import { SyncIndicator, ThemeToggle } from "../feedback/FeedbackStates";
import { MemberAvatar } from "../ui/Avatar";
import { useAuth } from "../../features/auth/AuthProvider";

export interface TopHeaderProps {
  title: string;
  onSearchClick: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ title, onSearchClick }) => {
  const { user, profile } = useAuth();
  const name = profile?.displayName || user?.displayName || user?.email || "User";
  const avatarUrl = profile?.photoURL || user?.photoURL || "";

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty("--mouse-x", `${x}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <header
      onMouseMove={handleMouseMove}
      className="sticky top-0 right-0 left-0 border-b border-white/10 liquid-glass-nav min-h-[72px] flex items-center justify-between px-4 md:px-8 z-20 transition-all duration-300"
    >
      {/* Interactive Glare Layer */}
      <div className="liquid-glare-layer">
        <div className="liquid-glare-spot" />
      </div>

      {/* Page / Context title */}
      <div className="flex items-center gap-3 relative z-10">
        <h2 className="text-sm sm:text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-accent-indigo via-accent-violet to-accent-cyan uppercase tracking-wider md:hidden">
          FairTab
        </h2>
        <span className="h-4 w-px bg-white/10 md:hidden" />
        <h3 className="text-sm sm:text-base font-semibold text-text-primary capitalize tracking-tight">
          {title}
        </h3>
      </div>

      {/* Utilities: Search, Sync, Theme, Profile */}
      <div className="flex items-center gap-2 sm:gap-3 relative z-10">
        {/* Search launcher */}
        <button
          onClick={onSearchClick}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 text-text-muted hover:text-text-primary text-xs transition-all duration-200 border border-white/10 cursor-pointer min-h-[38px] min-w-[38px] md:min-w-[190px] shadow-sm"
          aria-label="Open command search"
        >
          <Search className="h-4 w-4 shrink-0 text-accent-cyan" />
          <span className="hidden md:inline font-medium text-text-secondary">Search shortcuts...</span>
          <kbd className="hidden lg:inline-flex items-center justify-center h-5 px-1.5 rounded-md bg-white/5 border border-white/10 font-sans text-[10px] text-text-muted ml-auto font-medium">
            Ctrl K
          </kbd>
        </button>

        {/* Divider */}
        <div className="hidden sm:block w-px h-5 bg-white/10 mx-0.5" />

        {/* Sync Indicator */}
        <div className="px-1.5 py-1 rounded-full bg-white/[0.02]">
          <SyncIndicator syncStatus="synced" />
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 pl-1">
          <MemberAvatar name={name} avatarUrl={avatarUrl} size="sm" />
          <span className="text-xs font-semibold text-text-secondary hidden lg:inline max-w-[120px] truncate">
            {name}
          </span>
        </div>
      </div>
    </header>
  );
};
export default TopHeader;
