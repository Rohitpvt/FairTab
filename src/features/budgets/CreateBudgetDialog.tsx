import React, { useState } from "react";
import { Dialog } from "../../components/ui/Dialogs";
import { Button } from "../../components/ui/Button";
import type { ExpenseCategory } from "@fairtab/domain";
import type { GroupMemberDocument } from "../groups/memberSchema";

interface CreateBudgetDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  members: GroupMemberDocument[];
  onSubmit: (data: {
    name: string;
    scope: "overall" | "category" | "member";
    category?: ExpenseCategory;
    memberId?: string;
    period: "weekly" | "monthly" | "custom";
    timeZone: string;
    startDate: string;
    endDate?: string | null;
    amountMinor: number;
  }) => void;
  currency: string;
}

const CATEGORIES: ExpenseCategory[] = [
  "food", "transport", "shopping", "housing", "utilities",
  "entertainment", "health", "travel", "education", "other",
];

export const CreateBudgetDialog: React.FC<CreateBudgetDialogProps> = ({
  isOpen,
  onOpenChange,
  members,
  onSubmit,
  currency,
}) => {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"overall" | "category" | "member">("overall");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [memberId, setMemberId] = useState("");
  const [period, setPeriod] = useState<"weekly" | "monthly" | "custom">("monthly");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [timeZone] = useState("UTC"); // Force UTC for simpler calendar operations initially

  const activeMembers = members.filter((m) => m.status === "active");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || !startDate) return;

    const amountNum = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountNum) || amountNum <= 0) return;

    onSubmit({
      name,
      scope,
      ...(scope === "category" ? { category } : {}),
      ...(scope === "member" ? { memberId } : {}),
      period,
      timeZone,
      startDate,
      endDate: period === "custom" && endDate ? endDate : null,
      amountMinor: amountNum,
    });

    // Reset Form
    setName("");
    setScope("overall");
    setAmount("");
    onOpenChange(false);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Create New Budget"
      description="Define group expenditure limits or individual share budgets to prevent overruns."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="budget-name" className="text-xs font-bold text-text-secondary uppercase tracking-wider">Budget Name</label>
          <input
            id="budget-name"
            type="text"
            required
            placeholder="e.g. Monthly Grocery Cap"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-indigo"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="budget-scope" className="text-xs font-bold text-text-secondary uppercase tracking-wider">Budget Scope</label>
            <select
              id="budget-scope"
              value={scope}
              onChange={(e) => {
                const val = e.target.value as "overall" | "category" | "member";
                setScope(val);
                if (val === "member" && activeMembers.length > 0 && !memberId) {
                  setMemberId(activeMembers[0].id);
                }
              }}
              className="bg-background-dark border border-white/10 rounded-lg p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-indigo"
            >
              <option value="overall">Overall Group</option>
              <option value="category">Category-Specific</option>
              <option value="member">Personal / Member</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="budget-amount" className="text-xs font-bold text-text-secondary uppercase tracking-wider">Limit ({currency})</label>
            <input
              id="budget-amount"
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-indigo"
            />
          </div>
        </div>

        {scope === "category" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="budget-category" className="text-xs font-bold text-text-secondary uppercase tracking-wider">Select Category</label>
            <select
              id="budget-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="bg-background-dark border border-white/10 rounded-lg p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-indigo"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        {scope === "member" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="budget-member" className="text-xs font-bold text-text-secondary uppercase tracking-wider">Select Member</label>
            <select
              id="budget-member"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="bg-background-dark border border-white/10 rounded-lg p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-indigo"
            >
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="budget-period" className="text-xs font-bold text-text-secondary uppercase tracking-wider">Period</label>
            <select
              id="budget-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as "weekly" | "monthly" | "custom")}
              className="bg-background-dark border border-white/10 rounded-lg p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-indigo"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom Period</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="budget-start-date" className="text-xs font-bold text-text-secondary uppercase tracking-wider">Start Date</label>
            <input
              id="budget-start-date"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-indigo"
            />
          </div>
        </div>

        {period === "custom" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="budget-end-date" className="text-xs font-bold text-text-secondary uppercase tracking-wider">End Date</label>
            <input
              id="budget-end-date"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-indigo"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-white/5">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Create Budget
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
