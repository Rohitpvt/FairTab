import React, { useState } from "react";
import { Dialog } from "../../components/ui/Dialogs";
import { Button } from "../../components/ui/Button";
import { Download, FileSpreadsheet, FileJson } from "lucide-react";
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";
import type { GroupMemberDocument } from "../groups/memberSchema";

interface ExportAnalyticsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  expenses: ExpenseDocument[];
  settlements: SettlementDocument[];
  members: GroupMemberDocument[];
}

export const ExportAnalyticsDialog: React.FC<ExportAnalyticsDialogProps> = ({
  isOpen,
  onOpenChange,
  expenses,
  settlements,
  members,
}) => {
  const [exportType, setExportType] = useState<"expenses" | "settlements">("expenses");
  const [format, setFormat] = useState<"csv" | "json">("csv");

  const getMemberName = (memberId: string) => {
    const found = members.find((m) => m.id === memberId);
    return found ? found.displayName : memberId;
  };

  const getFormattedDate = (ts: { seconds?: number; _seconds?: number } | number | null | undefined) => {
    let seconds = 0;
    if (ts && typeof ts === "object") {
      if (typeof ts.seconds === "number") {
        seconds = ts.seconds;
      } else if (typeof ts._seconds === "number") {
        seconds = ts._seconds;
      }
    } else if (typeof ts === "number") {
      seconds = ts;
    }
    if (!seconds) return "";
    return new Date(seconds * 1000).toISOString().slice(0, 10);
  };

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (exportType === "expenses") {
      const activeExpenses = expenses.filter((e) => e.status !== "voided");
      const exportable = activeExpenses.map((e) => {
        const payerNames = e.payers.map((p) => `${getMemberName(p.memberId)} (${(p.amountMinor / 100).toFixed(2)})`).join("; ");
        const participantNames = e.splits.map((s) => `${getMemberName(s.memberId)} (${(s.amountMinor / 100).toFixed(2)})`).join("; ");
        return {
          title: e.title,
          category: e.category,
          date: getFormattedDate(e.incurredAt),
          currency: e.currency,
          amount: (e.amountMinor / 100).toFixed(2),
          baseCurrencyAmount: (e.baseAmountMinor / 100).toFixed(2),
          splitMethod: e.splitMethod,
          status: e.status,
          payers: payerNames,
          participants: participantNames,
        };
      });

      if (format === "json") {
        const jsonContent = JSON.stringify(exportable, null, 2);
        triggerDownload(jsonContent, "expenses_export.json", "application/json");
      } else {
        const headers = ["Title", "Category", "Date", "Currency", "Amount", "Base Currency Amount", "Split Method", "Status", "Payers", "Participants"];
        const rows = exportable.map((item) => [
          `"${item.title.replace(/"/g, '""')}"`,
          item.category,
          item.date,
          item.currency,
          item.amount,
          item.baseCurrencyAmount,
          item.splitMethod,
          item.status,
          `"${item.payers.replace(/"/g, '""')}"`,
          `"${item.participants.replace(/"/g, '""')}"`,
        ]);
        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        triggerDownload(csvContent, "expenses_export.csv", "text/csv;charset=utf-8;");
      }
    } else {
      const activeSettlements = settlements.filter((s) => s.status !== "voided");
      const exportable = activeSettlements.map((s) => ({
        payerName: getMemberName(s.payerId),
        receiverName: getMemberName(s.receiverId),
        currency: s.currency,
        amount: (s.amountMinor / 100).toFixed(2),
        baseCurrencyAmount: (s.baseAmountMinor / 100).toFixed(2),
        date: getFormattedDate(s.createdAt),
        status: s.status,
      }));

      if (format === "json") {
        const jsonContent = JSON.stringify(exportable, null, 2);
        triggerDownload(jsonContent, "settlements_export.json", "application/json");
      } else {
        const headers = ["Payer Name", "Receiver Name", "Currency", "Amount", "Base Currency Amount", "Date", "Status"];
        const rows = exportable.map((item) => [
          `"${item.payerName.replace(/"/g, '""')}"`,
          `"${item.receiverName.replace(/"/g, '""')}"`,
          item.currency,
          item.amount,
          item.baseCurrencyAmount,
          item.date,
          item.status,
        ]);
        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        triggerDownload(csvContent, "settlements_export.csv", "text/csv;charset=utf-8;");
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Export Group Ledger Data"
      description="Download your shared transactions in CSV or JSON format. Internal tracking codes and operational IDs are automatically stripped."
    >
      <div className="flex flex-col gap-6 py-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Select Ledger Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setExportType("expenses")}
              className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                exportType === "expenses"
                  ? "bg-accent-indigo/25 border-accent-indigo text-text-primary"
                  : "bg-white/5 border-white/10 text-text-muted hover:text-text-primary"
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Expenses Ledger
            </button>
            <button
              onClick={() => setExportType("settlements")}
              className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                exportType === "settlements"
                  ? "bg-accent-indigo/25 border-accent-indigo text-text-primary"
                  : "bg-white/5 border-white/10 text-text-muted hover:text-text-primary"
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Settlements Ledger
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Select Export Format</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setFormat("csv")}
              className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                format === "csv"
                  ? "bg-accent-indigo/25 border-accent-indigo text-text-primary"
                  : "bg-white/5 border-white/10 text-text-muted hover:text-text-primary"
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              CSV Format
            </button>
            <button
              onClick={() => setFormat("json")}
              className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                format === "json"
                  ? "bg-accent-indigo/25 border-accent-indigo text-text-primary"
                  : "bg-white/5 border-white/10 text-text-muted hover:text-text-primary"
              }`}
            >
              <FileJson className="h-4 w-4" />
              JSON Format
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-white/5">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Data
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
