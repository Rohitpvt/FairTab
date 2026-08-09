import React, { useEffect, useState, useRef } from "react";
import { Search, Compass, DollarSign, Home, BarChart2, Bell, Settings, Wallet } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export interface CommandPaletteProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (route: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onOpenChange,
  onNavigate,
}) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = [
    { label: "Go to Dashboard", route: "/overview", icon: Home },
    { label: "Go to Groups", route: "/groups", icon: Compass },
    { label: "Go to Expenses", route: "/expenses", icon: DollarSign },
    { label: "Go to Settlements", route: "/settlements", icon: DollarSign },
    { label: "Go to Analytics", route: "/analytics", icon: BarChart2 },
    { label: "Go to Budgets", route: "/budgets", icon: Wallet },
    { label: "Go to Notifications", route: "/notifications", icon: Bell },
    { label: "Go to Settings", route: "/settings", icon: Settings },
  ];

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  // Handle Ctrl+K shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!isOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpenChange]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setQuery("");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[activeIndex]) {
        onNavigate(filteredItems[activeIndex].route);
        onOpenChange(false);
      }
    }
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" />
        
        {/* Command dialog container */}
        <DialogPrimitive.Content
          className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[90vw] max-w-lg glass-elevated rounded-xl border border-white/10 shadow-2xl focus:outline-none z-50 overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header search bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
            <Search className="h-5 w-5 text-text-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search shortcuts (Ctrl + K)..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-none text-sm text-text-primary placeholder-text-muted focus:outline-none w-full"
            />
          </div>

          {/* Shortcut lists */}
          <div className="p-2 max-h-[300px] overflow-y-auto">
            {filteredItems.length > 0 ? (
              filteredItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={item.route}
                    onClick={() => {
                      onNavigate(item.route);
                      onOpenChange(false);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-colors text-left cursor-pointer ${
                      isActive ? "bg-accent-indigo text-text-primary" : "text-text-secondary hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4.5 w-4.5 ${isActive ? "text-text-primary" : "text-text-muted"}`} />
                      <span>{item.label}</span>
                    </div>
                    <span className={`text-[10px] uppercase font-semibold tracking-wider ${isActive ? "text-white/70" : "text-text-muted"}`}>
                      Go
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-text-muted">No shortcuts found matching your query</div>
            )}
          </div>

          {/* Footer guides */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 bg-black/20 text-[10px] text-text-muted font-medium">
            <div className="flex items-center gap-1.5">
              <span>Navigate:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-sans">↑↓</kbd>
              <span>Select:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-sans">Enter</kbd>
            </div>
            <div>
              <span>Close:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-sans">Esc</kbd>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
