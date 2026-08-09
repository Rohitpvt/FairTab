import React from "react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Users } from "lucide-react";
import type { MemberContribution } from "@fairtab/domain";

interface MemberContributionPanelProps {
  contributions: MemberContribution[];
  formatAmount: (minor: number) => string;
}

export const MemberContributionPanel: React.FC<MemberContributionPanelProps> = ({
  contributions,
  formatAmount,
}) => {
  const maxPaid = Math.max(...contributions.map((c) => c.paidMinor), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-accent-violet" />
        <h3 className="text-base font-bold text-text-primary uppercase tracking-wider">
          Member Contributions
        </h3>
      </div>

      <GlassPanel variant="standard" className="flex flex-col gap-4">
        <div className="flex flex-col gap-4" role="list">
          {contributions.map((item, idx) => {
            const paidPercent = maxPaid > 0 ? (item.paidMinor / maxPaid) * 100 : 0;
            const isCreditor = item.netMinor >= 0;

            return (
              <div key={idx} role="listitem" className="flex flex-col gap-1.5 border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-text-primary truncate">{item.displayName}</span>
                  <div className="flex items-center gap-2">
                    <span className={isCreditor ? "text-success" : "text-danger"}>
                      {isCreditor ? "Owed " : "Owes "}
                      {formatAmount(Math.abs(item.netMinor))}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 text-[10px] text-text-muted gap-2">
                  <div>
                    <span>Paid: {formatAmount(item.paidMinor)}</span>
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden mt-1">
                      <div
                        style={{ width: `${paidPercent}%` }}
                        className="h-full bg-accent-indigo"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col justify-end text-right sm:text-right mt-1 sm:mt-0">
                    <span>Owed Share: {formatAmount(item.owedMinor)}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {contributions.length === 0 && (
            <div className="text-xs text-text-muted text-center py-4">No active members found.</div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
};
