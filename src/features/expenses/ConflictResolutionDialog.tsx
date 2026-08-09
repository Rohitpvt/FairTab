/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/Button";

interface ConflictResolutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  localData: any;
  serverData: any;
  memberNames: Record<string, string>;
  onResolve: (action: "reapply" | "keep_server") => void;
}

export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  isOpen,
  onClose,
  localData,
  serverData,
  memberNames,
  onResolve,
}) => {
  if (!localData || !serverData) return null;

  const formatCurrency = (minorAmount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(minorAmount / 100);
  };

  const getMemberName = (id: string) => memberNames[id] || id;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background-primary/80 backdrop-blur-sm z-50 transition-opacity" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto bg-surface-primary border border-white/10 rounded-2xl p-6 shadow-2xl z-50 text-left flex flex-col gap-6">
          
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-warning/10 border border-warning/20 rounded-xl text-warning">
                <AlertTriangle className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold text-text-primary">
                  Version Mismatch Conflict Detected
                </Dialog.Title>
                <Dialog.Description className="text-xs text-text-muted mt-0.5">
                  Another group member updated this expense while you were offline.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-white/5 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Side-by-Side Comparison Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Local Version Panel */}
            <div className="glass-elevated border border-accent-indigo/20 rounded-xl p-5 flex flex-col gap-4 bg-accent-indigo/[0.02]">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-sm font-bold text-accent-indigo">Your Local Edit</span>
                <span className="text-[10px] bg-accent-indigo/10 border border-accent-indigo/20 px-1.5 py-0.5 rounded text-accent-cyan font-mono">
                  v{serverData.version} &rarr; Local Draft
                </span>
              </div>

              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Title</span>
                  <span className="text-text-primary font-semibold text-sm">{localData.title}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase font-bold">Category</span>
                    <span className="text-text-primary capitalize">{localData.category}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase font-bold">Total Amount</span>
                    <span className="text-text-primary font-bold">
                      {formatCurrency(localData.amountMinor, localData.currency)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold mb-1">Payers</span>
                  <div className="flex flex-col gap-1">
                    {localData.payers.map((p: any) => (
                      <div key={p.memberId} className="flex justify-between text-text-secondary">
                        <span>{getMemberName(p.memberId)}</span>
                        <span>{formatCurrency(p.amountMinor, localData.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold mb-1">Splits</span>
                  <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                    {localData.splits.map((s: any) => (
                      <div key={s.memberId} className="flex justify-between text-text-secondary">
                        <span>{getMemberName(s.memberId)}</span>
                        <span>{formatCurrency(s.amountMinor, localData.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Server Version Panel */}
            <div className="glass-elevated border border-accent-cyan/20 rounded-xl p-5 flex flex-col gap-4 bg-accent-cyan/[0.01]">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-sm font-bold text-accent-cyan">Current Cloud Version</span>
                <span className="text-[10px] bg-accent-cyan/10 border border-accent-cyan/20 px-1.5 py-0.5 rounded text-accent-cyan font-mono">
                  v{serverData.version} (Authoritative)
                </span>
              </div>

              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Title</span>
                  <span className="text-text-primary font-semibold text-sm">{serverData.title}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase font-bold">Category</span>
                    <span className="text-text-primary capitalize">{serverData.category}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase font-bold">Total Amount</span>
                    <span className="text-text-primary font-bold">
                      {formatCurrency(serverData.amountMinor, serverData.currency)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold mb-1">Payers</span>
                  <div className="flex flex-col gap-1">
                    {serverData.payers.map((p: any) => (
                      <div key={p.memberId} className="flex justify-between text-text-secondary">
                        <span>{getMemberName(p.memberId)}</span>
                        <span>{formatCurrency(p.amountMinor, serverData.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold mb-1">Splits</span>
                  <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                    {serverData.splits.map((s: any) => (
                      <div key={s.memberId} className="flex justify-between text-text-secondary">
                        <span>{getMemberName(s.memberId)}</span>
                        <span>{formatCurrency(s.amountMinor, serverData.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resolutions */}
          <div className="flex flex-col sm:flex-row gap-3 border-t border-white/5 pt-4">
            <Button
              onClick={() => onResolve("reapply")}
              variant="gradient"
              className="flex-1 text-center justify-center"
            >
              Reapply Changes (Merge Manually)
            </Button>
            <Button
              onClick={() => onResolve("keep_server")}
              variant="secondary"
              className="flex-1 text-center justify-center"
            >
              Keep Server Version (Discard Local)
            </Button>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
export default ConflictResolutionDialog;
