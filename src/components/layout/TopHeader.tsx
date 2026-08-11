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
  const { user } = useAuth();
  const name = user?.displayName || user?.email || "User";
  const avatarUrl = user?.photoURL || "";

  return (
    <header className="sticky top-0 right-0 left-0 border-b border-white/5 glass-standard min-h-[72px] flex items-center justify-between px-4 md:px-8 z-20">
      {/* Page / Context title */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm sm:text-base font-bold text-text-primary uppercase tracking-wider md:hidden">
          FairTab
        </h2>
        <span className="h-4 w-px bg-white/10 md:hidden" />
        <h3 className="text-sm sm:text-base font-semibold text-text-secondary capitalize">
          {title}
        </h3>
      </div>

      {/* Utilities: Search, Sync, Theme, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Search launcher */}
        <button
          onClick={onSearchClick}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-subtle hover:bg-surface-hover text-text-muted hover:text-text-primary text-xs transition-colors border border-white/5 cursor-pointer min-h-[36px] min-w-[36px] md:min-w-[180px]"
          aria-label="Open command search"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden md:inline font-medium">Search shortcuts...</span>
          <kbd className="hidden lg:inline-flex items-center justify-center h-5 px-1.5 rounded bg-white/5 border border-white/10 font-sans text-[10px] text-text-muted ml-auto font-medium">
            Ctrl K
          </kbd>
        </button>

        {/* Sync Indicator */}
        <SyncIndicator syncStatus="synced" />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2">
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
