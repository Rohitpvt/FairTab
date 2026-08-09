import React from "react";

/**
 * Development-only floating status badge displaying emulator suite connectivity.
 */
export const EmulatorIndicator: React.FC = () => {
  const isDev = import.meta.env.DEV || import.meta.env.MODE === "development";
  const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

  if (!isDev || !useEmulators) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-6 right-6 z-50 px-3 py-1.5 bg-accent-violet text-white text-[10px] font-bold tracking-wider uppercase rounded-full shadow-lg border border-white/20 select-none pointer-events-none opacity-80 flex items-center gap-1.5"
      role="status"
    >
      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
      <span>Firebase Emulators Active</span>
    </div>
  );
};

export default EmulatorIndicator;
