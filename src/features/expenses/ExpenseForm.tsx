/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useId } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import {
  DollarSign,
  Calendar,
  Tag,
  FileText,
  Users,
  Percent,
  Hash,
  ArrowLeftRight,
} from "lucide-react";
import { CURRENCIES, formatMinorUnit } from "@fairtab/domain";
import type {
  ExpenseCategory,
  SplitMethod,
  ExpensePayer,
  ExpenseSplit,
} from "@fairtab/domain";
import type { GroupMemberDocument } from "../groups/memberSchema";

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "food", label: "Food & Drinks" },
  { value: "transport", label: "Transport" },
  { value: "shopping", label: "Shopping" },
  { value: "housing", label: "Housing" },
  { value: "utilities", label: "Utilities" },
  { value: "entertainment", label: "Entertainment" },
  { value: "health", label: "Health" },
  { value: "travel", label: "Travel" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
];

const SPLIT_METHODS: { value: SplitMethod; label: string; icon: React.ReactNode }[] = [
  { value: "equal", label: "Equal", icon: <Users className="h-3.5 w-3.5" /> },
  { value: "exact", label: "Exact", icon: <DollarSign className="h-3.5 w-3.5" /> },
  { value: "percentage", label: "Percentage", icon: <Percent className="h-3.5 w-3.5" /> },
  { value: "shares", label: "Shares", icon: <Hash className="h-3.5 w-3.5" /> },
];

export interface ExpenseFormData {
  title: string;
  category: ExpenseCategory;
  currency: string;
  amountMinor: number;
  incurredAtSeconds: number;
  notes: string;
  fxNumerator: number;
  fxDenominator: number;
  splitMethod: SplitMethod;
  payers: ExpensePayer[];
  splits: ExpenseSplit[];
  participantIds: string[];
}

interface ExpenseFormProps {
  members: GroupMemberDocument[];
  baseCurrency: string;
  initialData?: Partial<ExpenseFormData>;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  submitLabel: string;
  isSubmitting: boolean;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  members,
  baseCurrency,
  initialData,
  onSubmit,
  submitLabel,
  isSubmitting,
}) => {
  const navigate = useNavigate();
  const formId = useId();

  const activeMembers = members.filter((m) => m.status === "active");

  // Form state
  const [title, setTitle] = useState(initialData?.title || "");
  const [category, setCategory] = useState<ExpenseCategory>(initialData?.category || "food");
  const [currency, setCurrency] = useState(initialData?.currency || baseCurrency);
  const [amountStr, setAmountStr] = useState(
    initialData?.amountMinor ? (initialData.amountMinor / 100).toFixed(2) : ""
  );
  const [incurredDate, setIncurredDate] = useState(
    initialData?.incurredAtSeconds
      ? new Date(initialData.incurredAtSeconds * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(initialData?.splitMethod || "equal");

  // FX
  const isForeignCurrency = currency !== baseCurrency;
  const [fxRate, setFxRate] = useState(
    initialData?.fxNumerator && initialData?.fxDenominator
      ? (initialData.fxNumerator / initialData.fxDenominator).toFixed(4)
      : "1.0000"
  );

  // Participants (subset)
  const [participantIds, setParticipantIds] = useState<string[]>(
    initialData?.participantIds || activeMembers.map((m) => m.id)
  );

  // Payer selection (single payer by default)
  const [payerId, setPayerId] = useState<string>(
    initialData?.payers?.[0]?.memberId || activeMembers[0]?.id || ""
  );

  // Sync active members once they load from Firestore
  useEffect(() => {
    if (activeMembers.length > 0 && participantIds.length === 0 && !initialData?.participantIds) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setParticipantIds(activeMembers.map((m) => m.id));
    }
    if (activeMembers.length > 0 && !payerId && !initialData?.payers?.[0]?.memberId) {
      setPayerId(activeMembers[0].id);
    }
  }, [activeMembers, initialData, participantIds.length, payerId]);

  // Split-specific values
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [shareValues, setShareValues] = useState<Record<string, string>>({});

  const [formError, setFormError] = useState("");

  const amountMinor = useMemo(() => {
    const parsed = parseFloat(amountStr);
    if (isNaN(parsed) || parsed < 0) return 0;
    return Math.round(parsed * 100);
  }, [amountStr]);

  const participantMembers = useMemo(
    () => activeMembers.filter((m) => participantIds.includes(m.id)),
    [activeMembers, participantIds]
  );

  const toggleParticipant = (memberId: string) => {
    setParticipantIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  // Compute splits based on method
  const computeSplits = (): ExpenseSplit[] => {
    const count = participantMembers.length;
    if (count === 0 || amountMinor === 0) return [];

    const fxNum = parseFloat(fxRate) || 1;

    if (splitMethod === "equal") {
      const base = Math.floor(amountMinor / count);
      const remainder = amountMinor - base * count;
      // Sort by memberId for deterministic residual distribution
      const sorted = [...participantMembers].sort((a, b) => a.id.localeCompare(b.id));
      return sorted.map((m, i) => ({
        memberId: m.id,
        amountMinor: base + (i < remainder ? 1 : 0),
        baseAmountMinor: Math.round((base + (i < remainder ? 1 : 0)) * fxNum),
      }));
    }

    if (splitMethod === "exact") {
      return participantMembers.map((m) => {
        const val = parseFloat(exactAmounts[m.id] || "0");
        const minor = Math.round(val * 100);
        return {
          memberId: m.id,
          amountMinor: minor,
          baseAmountMinor: Math.round(minor * fxNum),
        };
      });
    }

    if (splitMethod === "percentage") {
      return participantMembers.map((m) => {
        const pct = parseFloat(percentages[m.id] || "0");
        const minor = Math.round((amountMinor * pct) / 100);
        return {
          memberId: m.id,
          amountMinor: minor,
          baseAmountMinor: Math.round(minor * fxNum),
          percentageBps: Math.round(pct * 100),
        };
      });
    }

    if (splitMethod === "shares") {
      const totalShares = participantMembers.reduce(
        (sum, m) => sum + (parseInt(shareValues[m.id] || "1", 10) || 1),
        0
      );
      return participantMembers.map((m) => {
        const sh = parseInt(shareValues[m.id] || "1", 10) || 1;
        const minor = Math.round((amountMinor * sh) / totalShares);
        return {
          memberId: m.id,
          amountMinor: minor,
          baseAmountMinor: Math.round(minor * fxNum),
          shares: sh,
        };
      });
    }

    return [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (amountMinor <= 0) {
      setFormError("Amount must be greater than zero.");
      return;
    }
    if (participantMembers.length === 0) {
      setFormError("At least one participant is required.");
      return;
    }

    const splits = computeSplits();
    const splitSum = splits.reduce((s, sp) => s + sp.amountMinor, 0);

    if (splitMethod !== "equal" && splitSum !== amountMinor) {
      setFormError(
        `Split amounts (${formatMinorUnit(splitSum, currency)}) do not match the total (${formatMinorUnit(amountMinor, currency)}).`
      );
      return;
    }

    const fxNum = isForeignCurrency ? Math.round(parseFloat(fxRate) * 10000) : 1;
    const fxDen = isForeignCurrency ? 10000 : 1;

    const data: ExpenseFormData = {
      title: title.trim(),
      category,
      currency,
      amountMinor,
      incurredAtSeconds: (() => {
        const [y, m, d] = incurredDate.split("-").map(Number);
        return Date.UTC(y, m - 1, d) / 1000;
      })(),
      notes: notes.trim(),
      fxNumerator: fxNum,
      fxDenominator: fxDen,
      splitMethod,
      payers: [
        {
          memberId: payerId,
          amountMinor,
          baseAmountMinor: isForeignCurrency ? Math.round(amountMinor * (fxNum / fxDen)) : amountMinor,
        },
      ],
      splits,
      participantIds,
    };

    try {
      await onSubmit(data);
    } catch (err: any) {
      setFormError(err.message || "Failed to submit expense.");
    }
  };

  const inputClass =
    "w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan transition-colors";
  const labelClass = "text-xs font-semibold text-text-secondary mb-1.5 flex items-center gap-1.5";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" id={formId}>
      {/* Title */}
      <div>
        <label className={labelClass}>
          <FileText className="h-3.5 w-3.5" /> Title
        </label>
        <input
          id="exp-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Dinner at Olive Garden"
          className={inputClass}
          maxLength={100}
          required
        />
      </div>

      {/* Amount + Currency Row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            <DollarSign className="h-3.5 w-3.5" /> Amount
          </label>
          <input
            id="exp-amount"
            type="number"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0.01"
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <select
            id="exp-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={inputClass}
          >
            {Object.keys(CURRENCIES).map((code) => (
              <option key={code} value={code}>
                {code} ({CURRENCIES[code].symbol})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* FX Rate (conditional) */}
      {isForeignCurrency && (
        <div className="glass-subtle border border-accent-indigo/20 rounded-xl p-4">
          <label className={labelClass}>
            <ArrowLeftRight className="h-3.5 w-3.5" /> Exchange Rate (1 {currency} = ? {baseCurrency})
          </label>
          <input
            type="number"
            value={fxRate}
            onChange={(e) => setFxRate(e.target.value)}
            step="0.0001"
            min="0.0001"
            className={inputClass}
          />
          <p className="text-[10px] text-text-muted mt-1">
            {amountMinor > 0 &&
              `≈ ${formatMinorUnit(Math.round(amountMinor * parseFloat(fxRate || "1")), baseCurrency)} in ${baseCurrency}`}
          </p>
        </div>
      )}

      {/* Category + Date Row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            <Tag className="h-3.5 w-3.5" /> Category
          </label>
          <select
            id="exp-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>
            <Calendar className="h-3.5 w-3.5" /> Date
          </label>
          <input
            id="exp-date"
            type="date"
            value={incurredDate}
            onChange={(e) => setIncurredDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes (optional)</label>
        <textarea
          id="exp-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional details..."
          rows={2}
          className={inputClass + " resize-none"}
          maxLength={500}
        />
      </div>

      {/* Paid By */}
      <div>
        <label className={labelClass}>
          <DollarSign className="h-3.5 w-3.5" /> Paid by
        </label>
        <select
          id="exp-payer"
          value={payerId}
          onChange={(e) => setPayerId(e.target.value)}
          className={inputClass}
        >
          {activeMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Split Method Selector */}
      <div>
        <label className={labelClass}>Split Method</label>
        <div className="grid grid-cols-4 gap-2">
          {SPLIT_METHODS.map((sm) => (
            <button
              key={sm.value}
              type="button"
              onClick={() => setSplitMethod(sm.value)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                splitMethod === sm.value
                  ? "bg-accent-indigo/20 border-accent-indigo/40 text-accent-cyan"
                  : "bg-white/[0.02] border-white/5 text-text-muted hover:bg-white/[0.04]"
              }`}
            >
              {sm.icon}
              {sm.label}
            </button>
          ))}
        </div>
      </div>

      {/* Participant Selection */}
      <div>
        <label className={labelClass}>
          <Users className="h-3.5 w-3.5" /> Participants
        </label>
        <div className="flex flex-wrap gap-2">
          {activeMembers.map((m) => {
            const isSelected = participantIds.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleParticipant(m.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  isSelected
                    ? "bg-accent-cyan/15 border-accent-cyan/30 text-accent-cyan"
                    : "bg-white/[0.02] border-white/10 text-text-muted hover:bg-white/[0.04] line-through opacity-50"
                }`}
              >
                {m.displayName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Split Detail Editor */}
      {splitMethod !== "equal" && participantMembers.length > 0 && amountMinor > 0 && (
        <div className="glass-subtle border border-white/10 rounded-xl p-4 flex flex-col gap-3">
          <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
            {splitMethod === "exact" && "Enter exact amounts"}
            {splitMethod === "percentage" && "Enter percentages"}
            {splitMethod === "shares" && "Enter share values"}
          </h4>

          {participantMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-text-primary font-medium min-w-[100px]">
                {m.displayName}
              </span>
              {splitMethod === "exact" && (
                <input
                  type="number"
                  value={exactAmounts[m.id] || ""}
                  onChange={(e) =>
                    setExactAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))
                  }
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className={inputClass + " max-w-[140px] text-right"}
                />
              )}
              {splitMethod === "percentage" && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={percentages[m.id] || ""}
                    onChange={(e) =>
                      setPercentages((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    placeholder="0"
                    step="0.01"
                    min="0"
                    max="100"
                    className={inputClass + " max-w-[100px] text-right"}
                  />
                  <span className="text-text-muted text-xs">%</span>
                </div>
              )}
              {splitMethod === "shares" && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={shareValues[m.id] || "1"}
                    onChange={(e) =>
                      setShareValues((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    placeholder="1"
                    step="1"
                    min="1"
                    className={inputClass + " max-w-[80px] text-right"}
                  />
                  <span className="text-text-muted text-xs">shares</span>
                </div>
              )}
            </div>
          ))}

          {/* Validation summary */}
          {splitMethod === "exact" && (
            <div className="text-[10px] text-text-muted border-t border-white/5 pt-2 flex justify-between">
              <span>
                Sum:{" "}
                {formatMinorUnit(
                  participantMembers.reduce(
                    (s, m) => s + Math.round(parseFloat(exactAmounts[m.id] || "0") * 100),
                    0
                  ),
                  currency
                )}
              </span>
              <span>Target: {formatMinorUnit(amountMinor, currency)}</span>
            </div>
          )}
          {splitMethod === "percentage" && (
            <div className="text-[10px] text-text-muted border-t border-white/5 pt-2 flex justify-between">
              <span>
                Sum:{" "}
                {participantMembers
                  .reduce((s, m) => s + parseFloat(percentages[m.id] || "0"), 0)
                  .toFixed(2)}
                %
              </span>
              <span>Target: 100%</span>
            </div>
          )}
        </div>
      )}

      {/* Equal split preview */}
      {splitMethod === "equal" && participantMembers.length > 0 && amountMinor > 0 && (
        <div className="text-xs text-text-muted glass-subtle border border-white/5 rounded-lg px-4 py-2.5">
          Each of {participantMembers.length} participants pays{" "}
          <span className="text-text-primary font-bold">
            {formatMinorUnit(Math.floor(amountMinor / participantMembers.length), currency)}
          </span>
        </div>
      )}

      {/* Error */}
      {formError && (
        <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-4 py-2.5">
          {formError}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          variant="gradient"
          isLoading={isSubmitting}
          loadingText="Submitting..."
          className="flex-1"
        >
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate(-1)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default ExpenseForm;
