import React, { useState, useEffect, useCallback } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import {
  X,
  Delete,
  Plus,
  Minus,
  Divide,
  X as Multiply,
  Equal,
  Sparkles,
  Users,
  Copy,
  Check,
  ArrowLeftRight,
  TrendingUp,
} from "lucide-react";
import { useAppActions } from "../../app/providers/AppActionProvider";
import { triggerHaptic } from "../../utils/haptics";
import { toast } from "sonner";
import { CURRENCIES } from "../../utils/currencies";
import {
  fetchLiveExchangeRates,
  convertCurrencyAmount,
  type ExchangeRatesData,
} from "../../services/currencyService";

export interface QuickCalculatorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const QuickCalculator: React.FC<QuickCalculatorProps> = ({ isOpen, onOpenChange }) => {
  const { openAddExpense } = useAppActions();
  const [display, setDisplay] = useState("0");
  const [equation, setEquation] = useState("");
  const [splitCount, setSplitCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Currency conversion state
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("INR");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRatesData | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // Fetch live exchange rates on mount / open
  useEffect(() => {
    if (!isOpen) return;
    let isSubscribed = true;

    fetchLiveExchangeRates()
      .then((data) => {
        if (isSubscribed) {
          setExchangeRates(data);
          setIsLoadingRates(false);
        }
      })
      .catch(() => {
        if (isSubscribed) setIsLoadingRates(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen]);

  // Safe mathematical expression evaluator for basic arithmetic operations (+, -, *, /)
  const evaluateExpression = (expr: string): number => {
    const sanitized = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/[^0-9+\-*/.]/g, "");
    const tokens = sanitized.match(/(\d+(?:\.\d+)?|[+\-*/])/g);
    if (!tokens || tokens.length === 0) return 0;

    // First pass: multiplication and division
    const values: number[] = [];
    const ops: string[] = [];

    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (token === "*" || token === "/") {
        const nextVal = parseFloat(tokens[i + 1]);
        const prevVal = values.pop() ?? 0;
        const res = token === "*" ? prevVal * nextVal : nextVal !== 0 ? prevVal / nextVal : 0;
        values.push(res);
        i += 2;
      } else if (token === "+" || token === "-") {
        ops.push(token);
        i++;
      } else {
        values.push(parseFloat(token));
        i++;
      }
    }

    // Second pass: addition and subtraction
    let total = values[0] ?? 0;
    for (let j = 0; j < ops.length; j++) {
      const op = ops[j];
      const val = values[j + 1] ?? 0;
      if (op === "+") total += val;
      else if (op === "-") total -= val;
    }

    return Number.isFinite(total) ? total : 0;
  };

  const handleDigit = useCallback((digit: string) => {
    triggerHaptic("selection");
    setSplitCount(null);
    setDisplay((prev) => {
      if (prev === "0" && digit !== ".") return digit;
      if (digit === "." && prev.includes(".")) return prev;
      if (prev.length >= 12) return prev;
      return prev + digit;
    });
  }, []);

  const handleOperator = useCallback((op: string) => {
    triggerHaptic("light");
    setSplitCount(null);
    setEquation((prevEq) => {
      const currentVal = parseFloat(display) || 0;
      if (prevEq && !prevEq.endsWith("=")) {
        const result = evaluateExpression(prevEq + currentVal);
        setDisplay(String(Number(result.toFixed(2))));
        return `${result} ${op} `;
      }
      return `${currentVal} ${op} `;
    });
    setDisplay("0");
  }, [display]);

  const handleEqual = useCallback(() => {
    if (!equation) return;
    triggerHaptic("medium");
    try {
      const currentVal = parseFloat(display) || 0;
      const result = evaluateExpression(equation + currentVal);
      const formatted = Number(result.toFixed(2));
      setEquation(`${equation}${currentVal} =`);
      setDisplay(String(formatted));
      setSplitCount(null);
    } catch {
      setDisplay("Error");
    }
  }, [display, equation]);

  const handleClear = useCallback(() => {
    triggerHaptic("light");
    setDisplay("0");
    setEquation("");
    setSplitCount(null);
  }, []);

  const handleBackspace = useCallback(() => {
    triggerHaptic("selection");
    setSplitCount(null);
    setDisplay((prev) => {
      if (prev.length <= 1 || prev === "Error") return "0";
      return prev.slice(0, -1);
    });
  }, []);

  const handleTip = useCallback((percentage: number) => {
    triggerHaptic("medium");
    const current = parseFloat(display) || 0;
    if (current <= 0) return;
    const withTip = Number((current * (1 + percentage / 100)).toFixed(2));
    setEquation(`${current} + ${percentage}% tip =`);
    setDisplay(String(withTip));
    setSplitCount(null);
  }, [display]);

  const handleSplit = useCallback((people: number) => {
    triggerHaptic("medium");
    const current = parseFloat(display) || 0;
    if (current <= 0) return;
    const perPerson = Number((current / people).toFixed(2));
    setSplitCount(people);
    setEquation(`${current} ÷ ${people} people =`);
    setDisplay(String(perPerson));
  }, [display]);

  // Currency Conversion Action (converts current display into target currency)
  const handleApplyConversion = useCallback(() => {
    triggerHaptic("success");
    const current = parseFloat(display) || 0;
    if (current <= 0) return;
    const converted = convertCurrencyAmount(
      current,
      fromCurrency,
      toCurrency,
      exchangeRates?.rates
    );
    setEquation(`${fromCurrency} ${current} → ${toCurrency} =`);
    setDisplay(String(converted));
    // Also flip source to target for chaining calculations
    setFromCurrency(toCurrency);
    toast.success(`Converted ${fromCurrency} ${current} to ${toCurrency} ${converted}`);
  }, [display, fromCurrency, toCurrency, exchangeRates]);

  const handleSwapCurrencies = useCallback(() => {
    triggerHaptic("selection");
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  }, [fromCurrency, toCurrency]);

  const handleCopy = useCallback(() => {
    triggerHaptic("success");
    const val = parseFloat(display) || 0;
    navigator.clipboard.writeText(String(val));
    setCopied(true);
    toast.success("Calculated amount copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }, [display]);

  const handleSendToExpense = useCallback(() => {
    triggerHaptic("success");
    const val = parseFloat(display) || 0;
    if (val <= 0) {
      toast.error("Please enter a valid amount greater than 0.");
      return;
    }
    // Store prefill amount in sessionStorage so ExpenseForm automatically pre-populates
    try {
      sessionStorage.setItem("fairtab:prefill_amount", String(val));
    } catch {
      // ignore storage access restrictions if any
    }
    onOpenChange(false);
    openAddExpense();
    toast.info(`Pre-filled expense amount: ${val}`);
  }, [display, onOpenChange, openAddExpense]);

  // Compute live real-time rate for 1 unit
  const currentUnitRate = exchangeRates
    ? convertCurrencyAmount(1, fromCurrency, toCurrency, exchangeRates.rates)
    : 1;

  // Compute live converted value preview for current display
  const currentDisplayNum = parseFloat(display) || 0;
  const liveConvertedValue = currentDisplayNum > 0 && exchangeRates
    ? convertCurrencyAmount(currentDisplayNum, fromCurrency, toCurrency, exchangeRates.rates)
    : null;

  const toCurrencySymbol = CURRENCIES.find((c) => c.code === toCurrency)?.symbol || toCurrency;
  const fromCurrencySymbol = CURRENCIES.find((c) => c.code === fromCurrency)?.symbol || fromCurrency;

  // Keyboard navigation support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      else if (e.key === ".") handleDigit(".");
      else if (e.key === "+") handleOperator("+");
      else if (e.key === "-") handleOperator("-");
      else if (e.key === "*") handleOperator("×");
      else if (e.key === "/") {
        e.preventDefault();
        handleOperator("÷");
      } else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        handleEqual();
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleDigit, handleOperator, handleEqual, handleBackspace, onOpenChange]);

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-all duration-300" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed bottom-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full max-w-[390px] rounded-t-3xl sm:rounded-3xl border border-white/15 bg-surface-primary/95 backdrop-blur-2xl text-text-primary shadow-2xl p-5 z-50 focus:outline-none flex flex-col gap-3.5 max-h-[94vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <RadixDialog.Title className="text-base font-bold text-text-primary">
                  Quick Split & FX Calculator
                </RadixDialog.Title>
                <p className="text-[11px] text-text-muted">Split bills & convert live currencies</p>
              </div>
            </div>
            <RadixDialog.Close asChild>
              <button
                className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close calculator"
              >
                <X className="h-5 w-5" />
              </button>
            </RadixDialog.Close>
          </div>

          {/* Currency Switcher Bar */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
            <div className="flex items-center gap-1.5">
              <select
                aria-label="From Currency"
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="bg-surface-secondary text-white text-xs font-semibold rounded-lg px-2 py-1 border border-white/15 focus:outline-none focus:border-accent-cyan cursor-pointer"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-surface-primary text-white">
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleSwapCurrencies}
                className="p-1 rounded-md text-text-muted hover:text-accent-cyan hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                title="Swap currencies"
                aria-label="Swap currencies"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>

              <select
                aria-label="To Currency"
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="bg-surface-secondary text-white text-xs font-semibold rounded-lg px-2 py-1 border border-white/15 focus:outline-none focus:border-accent-cyan cursor-pointer"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-surface-primary text-white">
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Live rate & convert CTA */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted font-mono flex items-center gap-1" title="Real-time exchange rate">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                {isLoadingRates ? "..." : `1 ${fromCurrency} ≈ ${currentUnitRate} ${toCurrency}`}
              </span>

              {fromCurrency !== toCurrency && currentDisplayNum > 0 && (
                <button
                  type="button"
                  onClick={handleApplyConversion}
                  className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 border border-accent-cyan/30 active:scale-95 transition-all cursor-pointer"
                  title="Apply conversion to screen"
                >
                  Convert
                </button>
              )}
            </div>
          </div>

          {/* Display screen */}
          <div className="rounded-2xl bg-black/40 border border-white/10 p-4 flex flex-col items-end justify-between min-h-[92px] shadow-inner relative overflow-hidden">
            <div className="text-xs text-text-muted font-mono tracking-wider truncate w-full flex justify-between items-center h-4">
              <span className="text-[11px] font-semibold text-accent-cyan/80">
                {fromCurrencySymbol} {fromCurrency}
              </span>
              <span className="truncate pl-2">
                {equation || (splitCount ? `Divided for ${splitCount} people` : "")}
              </span>
            </div>

            <div className="flex items-baseline justify-between w-full mt-1">
              <button
                onClick={handleCopy}
                className="text-text-muted hover:text-accent-cyan transition-colors p-1 rounded-md cursor-pointer active:scale-95"
                title="Copy calculated value"
                aria-label="Copy to clipboard"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
              <div className="flex flex-col items-end truncate pl-2">
                <span className="text-3xl font-extrabold tracking-tight font-mono text-white tabular-nums truncate">
                  {display}
                </span>
                {fromCurrency !== toCurrency && liveConvertedValue !== null && (
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold tracking-tight">
                    ≈ {toCurrencySymbol} {liveConvertedValue.toLocaleString()} {toCurrency}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Presets: Tip & Split-N */}
          <div className="flex flex-col gap-2">
            {/* Tip Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider w-8">Tip:</span>
              <div className="flex-1 grid grid-cols-4 gap-1.5">
                {[5, 10, 15, 20].map((tip) => (
                  <button
                    key={tip}
                    type="button"
                    onClick={() => handleTip(tip)}
                    className="py-1 px-1.5 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white border border-white/5 active:scale-95 transition-all cursor-pointer"
                  >
                    +{tip}%
                  </button>
                ))}
              </div>
            </div>

            {/* Split Shortcuts */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider w-8 flex items-center gap-0.5">
                <Users className="h-3 w-3" />
              </span>
              <div className="flex-1 grid grid-cols-4 gap-1.5">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleSplit(n)}
                    className={`py-1 px-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer active:scale-95 ${
                      splitCount === n
                        ? "bg-accent-indigo/30 border-accent-indigo text-accent-cyan font-bold"
                        : "bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white border-white/5"
                    }`}
                  >
                    ÷{n} ppl
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Keypad Grid */}
          <div className="grid grid-cols-4 gap-2">
            {/* Row 1 */}
            <button
              onClick={handleClear}
              className="p-3 text-sm font-bold rounded-xl bg-danger/15 hover:bg-danger/25 text-danger border border-danger/20 active:scale-95 transition-all cursor-pointer"
            >
              AC
            </button>
            <button
              onClick={handleBackspace}
              className="p-3 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white border border-white/10 active:scale-95 transition-all cursor-pointer"
              aria-label="Backspace"
            >
              <Delete className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleOperator("%")}
              className="p-3 text-sm font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-accent-cyan border border-white/10 active:scale-95 transition-all cursor-pointer"
            >
              %
            </button>
            <button
              onClick={() => handleOperator("÷")}
              className="p-3 flex items-center justify-center rounded-xl bg-accent-indigo/20 hover:bg-accent-indigo/30 text-accent-cyan border border-accent-indigo/30 active:scale-95 transition-all cursor-pointer"
            >
              <Divide className="h-4 w-4" />
            </button>

            {/* Row 2 */}
            {["7", "8", "9"].map((d) => (
              <button
                key={d}
                onClick={() => handleDigit(d)}
                className="p-3 text-base font-semibold rounded-xl bg-white/[0.04] hover:bg-white/[0.09] text-white border border-white/5 active:scale-95 transition-all cursor-pointer font-mono"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => handleOperator("×")}
              className="p-3 flex items-center justify-center rounded-xl bg-accent-indigo/20 hover:bg-accent-indigo/30 text-accent-cyan border border-accent-indigo/30 active:scale-95 transition-all cursor-pointer"
            >
              <Multiply className="h-4 w-4" />
            </button>

            {/* Row 3 */}
            {["4", "5", "6"].map((d) => (
              <button
                key={d}
                onClick={() => handleDigit(d)}
                className="p-3 text-base font-semibold rounded-xl bg-white/[0.04] hover:bg-white/[0.09] text-white border border-white/5 active:scale-95 transition-all cursor-pointer font-mono"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => handleOperator("-")}
              className="p-3 flex items-center justify-center rounded-xl bg-accent-indigo/20 hover:bg-accent-indigo/30 text-accent-cyan border border-accent-indigo/30 active:scale-95 transition-all cursor-pointer"
            >
              <Minus className="h-4 w-4" />
            </button>

            {/* Row 4 */}
            {["1", "2", "3"].map((d) => (
              <button
                key={d}
                onClick={() => handleDigit(d)}
                className="p-3 text-base font-semibold rounded-xl bg-white/[0.04] hover:bg-white/[0.09] text-white border border-white/5 active:scale-95 transition-all cursor-pointer font-mono"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => handleOperator("+")}
              className="p-3 flex items-center justify-center rounded-xl bg-accent-indigo/20 hover:bg-accent-indigo/30 text-accent-cyan border border-accent-indigo/30 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>

            {/* Row 5 */}
            <button
              onClick={() => handleDigit("0")}
              className="col-span-2 p-3 text-base font-semibold rounded-xl bg-white/[0.04] hover:bg-white/[0.09] text-white border border-white/5 active:scale-95 transition-all cursor-pointer font-mono"
            >
              0
            </button>
            <button
              onClick={() => handleDigit(".")}
              className="p-3 text-base font-semibold rounded-xl bg-white/[0.04] hover:bg-white/[0.09] text-white border border-white/5 active:scale-95 transition-all cursor-pointer font-mono"
            >
              .
            </button>
            <button
              onClick={handleEqual}
              className="p-3 flex items-center justify-center rounded-xl bg-gradient-to-tr from-accent-indigo via-accent-violet to-accent-cyan text-white shadow-md shadow-accent-indigo/30 active:scale-95 transition-all cursor-pointer"
            >
              <Equal className="h-5 w-5" />
            </button>
          </div>

          {/* Action button: Send to New Expense */}
          <div className="pt-2 border-t border-white/10">
            <button
              onClick={handleSendToExpense}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-accent-indigo to-accent-cyan hover:opacity-90 text-white font-bold text-sm shadow-lg shadow-accent-indigo/20 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Use in New Expense ({fromCurrencySymbol}{display})</span>
            </button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

export default QuickCalculator;

