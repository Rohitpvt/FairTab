/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ExpenseDocument, SettlementDocument, RecurringTemplateDocument, RecurringOccurrenceDocument } from "./types.js";
import type { BudgetDocument } from "./budgetTypes.js";
import { getCurrencyMetadata } from "./currencies.js";
import type { SmartInsight, InsightSeverity } from "./insightTypes.js";
import { computeBudgetProgress, getCurrentBudgetPeriod } from "./analyticsEngine.js";

/**
 * Extract a JS Date from a Firestore timestamp-like field.
 */
function toDate(ts: any): Date {
  let seconds: number;
  if (ts && typeof ts.seconds === "number") {
    seconds = ts.seconds;
  } else if (ts && typeof ts._seconds === "number") {
    seconds = ts._seconds;
  } else if (typeof ts === "number") {
    seconds = ts;
  } else {
    return new Date(0);
  }
  return new Date(seconds * 1000);
}

/**
 * Helper to get local date string (YYYY-MM-DD) in a specific timezone.
 */
export function getLocalDateString(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  
  const year = parts.find(p => p.type === "year")?.value || "1970";
  const month = parts.find(p => p.type === "month")?.value || "01";
  const day = parts.find(p => p.type === "day")?.value || "01";
  
  return `${year}-${month}-${day}`;
}

/**
 * Helper to get number of days in a given 0-indexed month and year.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Helper to get clamped YYYY-MM-DD start/end range for previous months.
 */
export function getHistoricalMonthRanges(
  refDate: Date,
  timeZone: string,
  monthsAgo: number,
  targetDay: number
): { start: string; end: string } {
  const dateStr = getLocalDateString(refDate, timeZone);
  const curYear = parseInt(dateStr.slice(0, 4));
  const curMonth = parseInt(dateStr.slice(5, 7)) - 1;

  let targetMonth = curMonth - monthsAgo;
  let targetYear = curYear;
  while (targetMonth < 0) {
    targetMonth += 12;
    targetYear -= 1;
  }

  const daysInTargetMonth = getDaysInMonth(targetYear, targetMonth);
  const clampedDay = Math.min(targetDay, daysInTargetMonth);

  const startStr = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-01`;
  const endStr = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;

  return { start: startStr, end: endStr };
}

/**
 * Normalizes title for fuzzy similarity checks.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Main insights generation engine.
 */
export function generateSmartInsights(inputs: {
  groupId: string;
  expenses: ExpenseDocument[];
  settlements: SettlementDocument[];
  members: { id: string; displayName: string }[];
  budgets: BudgetDocument[];
  templates: RecurringTemplateDocument[];
  approvedOccurrences: RecurringOccurrenceDocument[];
  groupBaseCurrency: string;
  referenceDate?: Date;
}): SmartInsight[] {
  const {
    groupId,
    expenses,
    settlements,
    members,
    budgets,
    templates,
    approvedOccurrences,
    groupBaseCurrency,
    referenceDate = new Date(),
  } = inputs;

  const insights: SmartInsight[] = [];
  const generatedAtStr = referenceDate.toISOString();

  // Filter to active records
  const activeExpenses = expenses.filter((e) => e.status === "active");
  const activeSettlements = settlements.filter((s) => s.status === "active");

  const meta = getCurrencyMetadata(groupBaseCurrency);
  const factor = Math.pow(10, meta.minorUnit);

  // Conversion helpers for thresholds
  const spikeThresholdMinor = 15 * factor; // 15.00 in minor units
  const momAnomalyThresholdMinor = 50 * factor; // 50.00 in minor units
  const imbalanceThresholdMinor = 50 * factor; // 50.00 in minor units

  // 1. Prepare Month-to-Date boundaries for current and historical months
  const defaultTimeZone = "UTC";
  const curLocalDateStr = getLocalDateString(referenceDate, defaultTimeZone);
  const curDay = parseInt(curLocalDateStr.slice(8, 10));
  const curMonthKey = curLocalDateStr.slice(0, 7);

  // Filter expenses matching current month up to today (MTD)
  const currentMonthMtdExpenses = activeExpenses.filter((e) => {
    const locStr = getLocalDateString(toDate(e.incurredAt), defaultTimeZone);
    return locStr.startsWith(curMonthKey) && locStr <= curLocalDateStr;
  });

  // Calculate historical ranges for past 3 months (MTD equivalent)
  const pastRanges = [1, 2, 3].map((monthsAgo) =>
    getHistoricalMonthRanges(referenceDate, defaultTimeZone, monthsAgo, curDay)
  );

  // Group historical expenses by month key for categorization
  const historicalMonthSums = pastRanges.map((range) => {
    const rangeExpenses = activeExpenses.filter((e) => {
      const locStr = getLocalDateString(toDate(e.incurredAt), defaultTimeZone);
      return locStr >= range.start && locStr <= range.end;
    });
    return {
      expenses: rangeExpenses,
      monthKey: range.start.slice(0, 7),
    };
  });

  // Verification: requires at least 3 historical months to compare safely
  const hasSufficientHistory = historicalMonthSums.length >= 3;

  if (hasSufficientHistory) {
    // A. Month-over-Month Anomaly Check
    const curMonthTotal = currentMonthMtdExpenses.reduce((sum, e) => sum + e.baseAmountMinor, 0);
    const historicalTotals = historicalMonthSums.map((m) =>
      m.expenses.reduce((sum, e) => sum + e.baseAmountMinor, 0)
    );
    const avgHistoricalTotal = historicalTotals.reduce((sum, val) => sum + val, 0) / 3;

    if (avgHistoricalTotal > 0) {
      const momRatio = curMonthTotal / avgHistoricalTotal;
      const momDiff = curMonthTotal - avgHistoricalTotal;

      if (momRatio >= 1.3 && momDiff >= momAnomalyThresholdMinor) {
        const severity: InsightSeverity = momRatio >= 1.6 ? "critical" : "warning";
        insights.push({
          id: `${groupId}:mom_anomaly:total:${curMonthKey}`,
          type: "mom_anomaly",
          severity,
          title: severity === "critical" ? "Critical Spending Increase" : "Significant Spending Increase",
          explanation: `Group spending this month has increased by ${Math.round((momRatio - 1) * 100)}% compared to the same month-to-date baseline of the past 3 months.`,
          supportingValues: {
            currentMtdSpend: curMonthTotal,
            baselineMtdSpend: Math.round(avgHistoricalTotal),
            percentIncrease: Math.round((momRatio - 1) * 100),
            currency: groupBaseCurrency,
          },
          comparisonBaseline: Math.round(avgHistoricalTotal),
          generatedAt: generatedAtStr,
          reasonCode: "MOM_SPENDING_ANOMALY",
        });
      }
    }

    // B. Category Spending Spike Check
    const categories: string[] = Array.from(new Set(activeExpenses.map((e) => e.category)));
    for (const cat of categories) {
      const curCatSpend = currentMonthMtdExpenses
        .filter((e) => e.category === cat)
        .reduce((sum, e) => sum + e.baseAmountMinor, 0);

      const historicalCatSpends = historicalMonthSums.map((m) =>
        m.expenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.baseAmountMinor, 0)
      );
      const avgHistoricalCatSpend = historicalCatSpends.reduce((sum, val) => sum + val, 0) / 3;

      if (avgHistoricalCatSpend > 0) {
        const catRatio = curCatSpend / avgHistoricalCatSpend;
        const catDiff = curCatSpend - avgHistoricalCatSpend;

        if (catRatio >= 1.5 && catDiff >= spikeThresholdMinor) {
          const severity: InsightSeverity = catRatio >= 2.0 ? "critical" : "warning";
          insights.push({
            id: `${groupId}:category_spike:${cat}:${curMonthKey}`,
            type: "category_spike",
            severity,
            title: `Category Spend Spike: ${cat}`,
            explanation: `Spending in the "${cat}" category is ${Math.round((catRatio - 1) * 100)}% higher than the 3-month historical average for this period.`,
            supportingValues: {
              currentMtdSpend: curCatSpend,
              baselineMtdSpend: Math.round(avgHistoricalCatSpend),
              percentIncrease: Math.round((catRatio - 1) * 100),
              category: cat,
              currency: groupBaseCurrency,
            },
            comparisonBaseline: Math.round(avgHistoricalCatSpend),
            generatedAt: generatedAtStr,
            reasonCode: `SPIKE_${cat.toUpperCase()}`,
          });
        }
      }
    }
  }

  // 2. Budget-Risk Warnings
  const activeBudgets = budgets.filter((b) => b.status === "active");
  for (const b of activeBudgets) {
    const { periodStart, periodEnd } = getCurrentBudgetPeriod(b, referenceDate);
    const startMs = new Date(periodStart + "T00:00:00Z").getTime();
    const endMs = new Date(periodEnd + "T23:59:59.999Z").getTime();
    const refMs = referenceDate.getTime();

    // Calculate time elapsed fraction (clamp to 0..1)
    let elapsedFraction = 0;
    if (endMs > startMs) {
      elapsedFraction = Math.max(0, Math.min(1, (refMs - startMs) / (endMs - startMs)));
    }

    const periodExpenses = activeExpenses.filter((e) => {
      const ms = toDate(e.incurredAt).getTime();
      return ms >= startMs && ms <= endMs;
    });

    const progress = computeBudgetProgress(b, periodExpenses);
    const spentFraction = b.amountMinor > 0 ? progress.spentMinor / b.amountMinor : 0;

    if (progress.isOverBudget) {
      insights.push({
        id: `${groupId}:budget_risk:${b.id}:overspent`,
        type: "budget_risk",
        severity: "critical",
        title: `Budget Limit Exceeded: ${b.name}`,
        explanation: `The budget "${b.name}" has spent ${formatMinor(progress.spentMinor, b.currency)}, exceeding its limit of ${formatMinor(b.amountMinor, b.currency)} by ${formatMinor(progress.spentMinor - b.amountMinor, b.currency)}.`,
        supportingValues: {
          spentMinor: progress.spentMinor,
          limitMinor: b.amountMinor,
          overspentMinor: progress.spentMinor - b.amountMinor,
          currency: b.currency,
        },
        comparisonBaseline: b.amountMinor,
        generatedAt: generatedAtStr,
        reasonCode: `BUDGET_OVERSPENT_${b.id}`,
      });
    } else if (spentFraction >= 0.85 && elapsedFraction < 0.80) {
      insights.push({
        id: `${groupId}:budget_risk:${b.id}:high_risk`,
        type: "budget_risk",
        severity: "warning",
        title: `Budget High Risk: ${b.name}`,
        explanation: `The budget "${b.name}" has used ${Math.round(spentFraction * 100)}% of its limit, but only ${Math.round(elapsedFraction * 100)}% of the budget period has elapsed.`,
        supportingValues: {
          spentMinor: progress.spentMinor,
          limitMinor: b.amountMinor,
          spentPercent: Math.round(spentFraction * 100),
          elapsedPercent: Math.round(elapsedFraction * 100),
          currency: b.currency,
        },
        comparisonBaseline: b.amountMinor,
        generatedAt: generatedAtStr,
        reasonCode: `BUDGET_HIGH_RISK_${b.id}`,
      });
    }
  }

  // 3. Member Contribution Imbalance
  const paidMap = new Map<string, number>();
  const owedMap = new Map<string, number>();
  for (const exp of activeExpenses) {
    for (const payer of exp.payers) {
      paidMap.set(payer.memberId, (paidMap.get(payer.memberId) || 0) + payer.baseAmountMinor);
    }
    for (const split of exp.splits) {
      owedMap.set(split.memberId, (owedMap.get(split.memberId) || 0) + split.baseAmountMinor);
    }
  }

  // Include settlement records in member balance calculations
  const settlementPaidMap = new Map<string, number>();
  const settlementReceivedMap = new Map<string, number>();
  for (const set of activeSettlements) {
    settlementPaidMap.set(set.payerId, (settlementPaidMap.get(set.payerId) || 0) + set.baseAmountMinor);
    settlementReceivedMap.set(set.receiverId, (settlementReceivedMap.get(set.receiverId) || 0) + set.baseAmountMinor);
  }

  for (const m of members) {
    const paid = paidMap.get(m.id) || 0;
    const owed = owedMap.get(m.id) || 0;
    const setPaid = settlementPaidMap.get(m.id) || 0;
    const setRecv = settlementReceivedMap.get(m.id) || 0;

    // netBalanceMinor is: paid expenses + paid settlements - owed splits - received settlements
    const netBalanceMinor = (paid + setPaid) - (owed + setRecv);

    if (netBalanceMinor >= imbalanceThresholdMinor) {
      const severity: InsightSeverity = netBalanceMinor >= imbalanceThresholdMinor * 3 ? "warning" : "info";
      insights.push({
        id: `${groupId}:contribution_imbalance:${m.id}:credit`,
        type: "contribution_imbalance",
        severity,
        title: `Imbalance: ${m.displayName} Owed`,
        explanation: `${m.displayName} has paid ${formatMinor(netBalanceMinor, groupBaseCurrency)} more than their share and is due for reimbursement.`,
        supportingValues: {
          netBalanceMinor,
          memberId: m.id,
          currency: groupBaseCurrency,
        },
        comparisonBaseline: 0,
        generatedAt: generatedAtStr,
        reasonCode: `IMBALANCE_CREDIT_${m.id}`,
      });
    } else if (netBalanceMinor <= -imbalanceThresholdMinor) {
      const absNet = Math.abs(netBalanceMinor);
      const severity: InsightSeverity = absNet >= imbalanceThresholdMinor * 3 ? "warning" : "info";
      insights.push({
        id: `${groupId}:contribution_imbalance:${m.id}:debt`,
        type: "contribution_imbalance",
        severity,
        title: `Imbalance: ${m.displayName} Owes`,
        explanation: `${m.displayName} owes ${formatMinor(absNet, groupBaseCurrency)} to the group for their split share.`,
        supportingValues: {
          netBalanceMinor,
          memberId: m.id,
          currency: groupBaseCurrency,
        },
        comparisonBaseline: 0,
        generatedAt: generatedAtStr,
        reasonCode: `IMBALANCE_DEBT_${m.id}`,
      });
    }
  }

  // 4. Recurring Expense Change Alerts
  const templatesMap = new Map<string, RecurringTemplateDocument>();
  for (const temp of templates) {
    templatesMap.set(temp.id, temp);
  }

  for (const occ of approvedOccurrences) {
    if (occ.status !== "approved" || !occ.expenseId) continue;
    const template = templatesMap.get(occ.templateId);
    if (!template) continue;

    // Find the actual approved expense in the ledger
    const actualExpense = activeExpenses.find((e) => e.id === occ.expenseId);
    if (!actualExpense) continue;

    // Safely compare baseline templates vs occurrence versions
    const templateBaseAmount = template.baseAmountMinor;
    const actualBaseAmount = actualExpense.baseAmountMinor;

    if (templateBaseAmount > 0) {
      const diffRatio = Math.abs(actualBaseAmount - templateBaseAmount) / templateBaseAmount;
      if (diffRatio > 0.10) {
        const severity: InsightSeverity = diffRatio >= 0.25 ? "warning" : "info";
        insights.push({
          id: `${groupId}:recurring_change:${template.id}:${actualExpense.id}`,
          type: "recurring_change",
          severity,
          title: `Recurring Cost Change: ${template.title}`,
          explanation: `The recurring occurrence approved on ${occ.occurrenceDate} cost ${formatMinor(actualBaseAmount, groupBaseCurrency)}, which deviates from the template baseline of ${formatMinor(templateBaseAmount, groupBaseCurrency)} by ${Math.round(diffRatio * 100)}%.`,
          supportingValues: {
            actualAmountMinor: actualBaseAmount,
            baselineAmountMinor: templateBaseAmount,
            deviationPercent: Math.round(diffRatio * 100),
            currency: groupBaseCurrency,
          },
          comparisonBaseline: templateBaseAmount,
          generatedAt: generatedAtStr,
          reasonCode: `RECURRING_CHANGE_${template.id}_${actualExpense.id}`,
        });
      }
    }
  }

  // 5. Bounded Duplicate Detection (O(N) Bucketing)
  // Date window = 24 hours (86,400,000 milliseconds)
  const windowMs = 24 * 60 * 60 * 1000;
  
  // Sort active expenses by date to bucket sequentially
  const sortedExpenses = [...activeExpenses].sort((a, b) => toDate(a.incurredAt).getTime() - toDate(b.incurredAt).getTime());

  for (let i = 0; i < sortedExpenses.length; i++) {
    const e1 = sortedExpenses[i];
    const e1Ms = toDate(e1.incurredAt).getTime();

    for (let j = i + 1; j < sortedExpenses.length; j++) {
      const e2 = sortedExpenses[j];
      const e2Ms = toDate(e2.incurredAt).getTime();

      // Break inner loop early if date window is exceeded (since list is sorted)
      if (e2Ms - e1Ms > windowMs) {
        break;
      }

      // Check remaining match dimensions: category, currency, approximate amount (1% tolerance)
      if (e1.category !== e2.category) continue;
      if (e1.currency !== e2.currency) continue;

      const amtDiffRatio = Math.abs(e1.amountMinor - e2.amountMinor) / Math.max(1, e1.amountMinor);
      if (amtDiffRatio > 0.01) continue;

      // Deterministic title normalization check
      const norm1 = normalizeTitle(e1.title);
      const norm2 = normalizeTitle(e2.title);
      const isSimilarTitle = norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);

      if (isSimilarTitle) {
        const minId = e1.id < e2.id ? e1.id : e2.id;
        const maxId = e1.id < e2.id ? e2.id : e1.id;

        insights.push({
          id: `${groupId}:duplicate_expense:${minId}:${maxId}`,
          type: "duplicate_expense",
          severity: "warning",
          title: "Possible Duplicate Expense",
          explanation: `"${e1.title}" and "${e2.title}" have similar titles, identical categories, matching currencies, similar amounts, and occurred within 24 hours.`,
          supportingValues: {
            expenseId1: e1.id,
            expenseId2: e2.id,
            title1: e1.title,
            title2: e2.title,
            amountMinor: e1.amountMinor,
            currency: e1.currency,
          },
          comparisonBaseline: e1.amountMinor,
          generatedAt: generatedAtStr,
          reasonCode: "DUPLICATE_EXPENSE_DETECTED",
          metadata: {
            minId,
            maxId,
          },
        });
      }
    }
  }

  // 6. Simple Spending Trend Insight
  // Average MoM trend over the last 3-6 months
  const monthlySums = new Map<string, number>();
  for (const e of activeExpenses) {
    const monthKey = getLocalDateString(toDate(e.incurredAt), defaultTimeZone).slice(0, 7);
    monthlySums.set(monthKey, (monthlySums.get(monthKey) || 0) + e.baseAmountMinor);
  }

  // Sort months
  const sortedMonths = Array.from(monthlySums.keys()).sort();
  if (sortedMonths.length >= 3) {
    const last3Months = sortedMonths.slice(-3);
    const spends = last3Months.map((m) => monthlySums.get(m) || 0);

    const m1 = spends[0];
    const m2 = spends[1];
    const m3 = spends[2];

    const change1 = m1 > 0 ? (m2 - m1) / m1 : 0;
    const change2 = m2 > 0 ? (m3 - m2) / m2 : 0;
    const avgChange = (change1 + change2) / 2;

    if (Math.abs(avgChange) >= 0.05) {
      const isUp = avgChange > 0;
      insights.push({
        id: `${groupId}:spending_trend:total:${sortedMonths[sortedMonths.length - 1]}`,
        type: "spending_trend",
        severity: "info",
        title: isUp ? "Spending Trending Upward" : "Spending Trending Downward",
        explanation: `Your overall monthly spending is trending ${isUp ? "upward" : "downward"} at an average rate of ${Math.round(Math.abs(avgChange) * 100)}% month-over-month.`,
        supportingValues: {
          trendDirection: isUp ? "up" : "down",
          averageMomChangePercent: Math.round(avgChange * 100),
          currency: groupBaseCurrency,
        },
        comparisonBaseline: 0,
        generatedAt: generatedAtStr,
        reasonCode: "SPENDING_TREND_DETECTED",
      });
    }
  }

  return insights;
}

/**
 * Format helper using getCurrencyMetadata.
 */
function formatMinor(minor: number, currency: string): string {
  const meta = getCurrencyMetadata(currency);
  const factor = Math.pow(10, meta.minorUnit);
  return `${meta.symbol}${(minor / factor).toFixed(meta.minorUnit)}`;
}
