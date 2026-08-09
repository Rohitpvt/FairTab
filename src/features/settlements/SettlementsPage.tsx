import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeftRight, Check, HandCoins, History, ArrowLeft, ArrowUpRight, Clock } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Button, GradientButton } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { groupService } from "../../infrastructure/firebase/groupService";
import { expenseService } from "../../infrastructure/firebase/expenseService";
import { settlementService } from "../../infrastructure/firebase/settlementService";
import { syncManager } from "../../infrastructure/offline/syncManager";
import { formatCurrency } from "../../utils/format";
import { DebtSimplificationPanel } from "./components/DebtSimplificationPanel";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";

export const SettlementsPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [members, setMembers] = useState<GroupMemberDocument[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDocument[]>([]);
  const [settlements, setSettlements] = useState<SettlementDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
  });

  useEffect(() => {
    if (!groupId) return;

    const unsubscribeGroup = groupService.watchGroup(groupId, (data) => {
      setGroup(data);
    });

    const unsubscribeMembers = groupService.watchMembers(groupId, (data) => {
      setMembers(data);
    });

    const unsubscribeExpenses = expenseService.watchExpenses(groupId, (data) => {
      setExpenses(data);
    });

    const unsubscribeSettlements = settlementService.watchSettlements(groupId, (data) => {
      setSettlements(data);
      setIsLoading(false);
    });

    const unsubSync = syncManager.registerListener((status) => {
      setSyncStatus(status);
    });

    return () => {
      unsubscribeGroup();
      unsubscribeMembers();
      unsubscribeExpenses();
      unsubscribeSettlements();
      unsubSync();
    };
  }, [groupId]);

  if (isLoading) {
    return (
      <PageContainer title="Reconcile Settlements" description="Preparing debt optimization engine...">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[150px] rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  if (!group) {
    return (
      <PageContainer title="Group Not Found" description="The group you are looking for does not exist.">
        <Button variant="secondary" onClick={() => navigate("/groups")}>
          Back to Groups
        </Button>
      </PageContainer>
    );
  }

  const getMemberName = (id: string) => {
    const m = members.find((member) => member.id === id);
    if (!m) return id;
    return m.displayName + (m.kind === "placeholder" ? " (Placeholder)" : "");
  };


  const isArchived = group.status === "archived";

  return (
    <PageContainer
      title={`${group.name} - Settlements`}
      description="Record, reconcile, and view group debt settlement transfers."
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => navigate(`/groups/${groupId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {!isArchived && (
            <GradientButton
              size="sm"
              className="flex items-center gap-1.5"
              onClick={() => navigate(`/groups/${groupId}/settlements/new`)}
            >
              <HandCoins className="h-4 w-4" />
              Record Repayment
            </GradientButton>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Suggested Settlement Plans Panel */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <DebtSimplificationPanel
            groupId={groupId!}
            expenses={expenses}
            settlements={settlements}
            members={members}
            baseCurrency={group.baseCurrency}
          />
        </div>

        {/* Settlements History Log */}
        <div className="flex flex-col gap-4">
          {syncStatus.pendingCount > 0 && (
            <GlassPanel variant="subtle" className="p-3 flex items-center justify-between border border-warning/20 bg-warning/5 text-warning rounded-xl">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-text-primary">Sync status</span>
                  <p className="text-text-muted mt-0.5">
                    {syncStatus.pendingCount} pending updates.
                  </p>
                </div>
              </div>
            </GlassPanel>
          )}
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <History className="h-5 w-5 text-accent-indigo" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              Settlement History
            </h3>
          </div>

          <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
            {settlements.length === 0 ? (
              <div className="p-6 text-center bg-white/5 border border-white/5 rounded-xl">
                <p className="text-xs text-text-muted">No settlements recorded yet.</p>
              </div>
            ) : (
              settlements.map((set) => (
                <Link
                  key={set.id}
                  to={`/groups/${groupId}/settlements/${set.id}`}
                  className="block group"
                >
                  <GlassPanel
                    variant="subtle"
                    className="p-4 flex items-center justify-between gap-3 text-xs hover:bg-white/10 transition-colors border border-white/5 group-hover:border-white/10"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                        <span className="truncate max-w-[80px] sm:max-w-[120px]">{getMemberName(set.payerId)}</span>
                        <ArrowLeftRight className="h-3 w-3 text-text-muted shrink-0" />
                        <span className="truncate max-w-[80px] sm:max-w-[120px]">{getMemberName(set.receiverId)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
                        <span>
                          {set.currency !== group.baseCurrency
                            ? `${set.amountMinor / 100} ${set.currency}`
                            : "Direct Transfer"}
                        </span>
                        <span>•</span>
                        <span>{new Date(set.createdAt.toDate ? set.createdAt.toDate() : (set.createdAt as unknown as string)).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-3">
                      <div>
                        <span className="font-bold text-text-primary financial-number">
                          {formatCurrency(set.baseAmountMinor, group.baseCurrency)}
                        </span>
                        {set.status === "voided" ? (
                          <div className="text-[10px] text-danger mt-0.5 font-semibold">Voided</div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 text-[10px] text-success/80 mt-0.5">
                            <Check className="h-3 w-3" />
                            <span>Cleared</span>
                          </div>
                        )}
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-text-muted group-hover:text-text-primary transition-colors" />
                    </div>
                  </GlassPanel>
                </Link>
              )))
            }
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default SettlementsPage;
