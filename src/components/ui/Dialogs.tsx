import React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export interface DialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className = "",
}) => {
  return (
    <RadixDialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        {/* Overlay backdrop */}
        <RadixDialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-150 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        
        {/* Central desktop dialog overlay */}
        <RadixDialog.Content
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-lg glass-elevated p-6 rounded-xl border border-white/10 shadow-2xl focus:outline-none z-50 transition-all duration-180 ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 ${className}`}
          onCloseAutoFocus={(e) => {
            const dashboardTrigger = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "New Expense");
            const mobileTrigger = document.querySelector('button[aria-label="Add new expense"]') as HTMLButtonElement;
            
            if (dashboardTrigger && document.body.contains(dashboardTrigger)) {
              (dashboardTrigger as HTMLButtonElement).focus();
              e.preventDefault();
            } else if (mobileTrigger && document.body.contains(mobileTrigger)) {
              mobileTrigger.focus();
              e.preventDefault();
            }
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <RadixDialog.Title className="text-base font-bold text-text-primary">
                  {title}
                </RadixDialog.Title>
                {description && (
                  <RadixDialog.Description className="text-xs text-text-muted mt-1 leading-normal">
                    {description}
                  </RadixDialog.Description>
                )}
              </div>
              <RadixDialog.Close asChild>
                <button
                  className="p-1 rounded-full text-text-secondary hover:bg-white/5 hover:text-text-primary transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </RadixDialog.Close>
            </div>

            <div className="text-sm text-text-secondary max-h-[60vh] overflow-y-auto pr-1">
              {children}
            </div>

            {footer && (
              <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-white/5">
                {footer}
              </div>
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

export const Modal = Dialog;

export const BottomSheet: React.FC<DialogProps> = ({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className = "",
}) => {
  return (
    <RadixDialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        {/* Overlay backdrop */}
        <RadixDialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        
        {/* Bottom sheet optimized for mobile viewports */}
        <RadixDialog.Content
          className={`fixed bottom-0 left-0 right-0 w-full max-h-[85vh] glass-elevated p-6 rounded-t-2xl border-t border-white/10 shadow-2xl focus:outline-none z-50 transition-transform duration-200 ease-out transform translate-y-0 data-[state=closed]:translate-y-full ${className}`}
        >
          <div className="flex flex-col gap-4">
            {/* Visual handle for swiping/pulling */}
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-2 shrink-0" />
            
            <div className="flex items-start justify-between">
              <div>
                <RadixDialog.Title className="text-base font-bold text-text-primary">
                  {title}
                </RadixDialog.Title>
                {description && (
                  <RadixDialog.Description className="text-xs text-text-muted mt-1 leading-normal">
                    {description}
                  </RadixDialog.Description>
                )}
              </div>
              <RadixDialog.Close asChild>
                <button
                  className="p-1 rounded-full text-text-secondary hover:bg-white/5 hover:text-text-primary transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                  aria-label="Close bottom sheet"
                >
                  <X className="h-4 w-4" />
                </button>
              </RadixDialog.Close>
            </div>

            <div className="text-sm text-text-secondary overflow-y-auto pr-1">
              {children}
            </div>

            {footer && (
              <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-white/5 pb-safe">
                {footer}
              </div>
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
