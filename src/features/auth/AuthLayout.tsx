import React from "react";
import { motion } from "framer-motion";
import { BrandLogo } from "../../components/ui/BrandLogo";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="flex min-h-screen text-text-primary app-background items-center justify-center p-4 selection:bg-accent-cyan/30">
      {/* Background gradients */}
      <div className="absolute top-[10%] left-[10%] w-72 h-72 bg-accent-indigo/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[10%] right-[10%] w-72 h-72 bg-accent-cyan/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md glass-elevated border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative z-10"
      >
        <div className="text-center mb-6">
          {/* Logo container */}
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/[0.04] border border-white/10 shadow-xl mb-3 backdrop-blur-md">
            <BrandLogo size="lg" className="filter drop-shadow-[0_0_12px_rgba(134,59,255,0.5)]" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-transparent">
            {title}
          </h1>
          <p className="text-xs text-text-muted mt-1 leading-normal">
            {subtitle}
          </p>
        </div>

        {children}
      </motion.div>
    </div>
  );
};

export default AuthLayout;
