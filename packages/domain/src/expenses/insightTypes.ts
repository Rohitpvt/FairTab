export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type InsightSeverity = "info" | "warning" | "critical";

export type InsightType =
  | "unusual_spending"
  | "category_spike"
  | "mom_anomaly"
  | "contribution_imbalance"
  | "recurring_change"
  | "budget_risk"
  | "spending_trend"
  | "duplicate_expense";

export interface SmartInsight {
  id: string; // Deterministic: groupId:type:uniqueDetails:period
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  explanation: string;
  supportingValues: Record<string, JsonValue>;
  comparisonBaseline?: string | number;
  generatedAt: string; // ISO String
  reasonCode: string;
  metadata?: Record<string, JsonValue>;
}
