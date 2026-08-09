import React from "react";

interface ReceiptConfidenceBadgeProps {
  confidence: number; // 0 to 1
  label?: string;
}

export const ReceiptConfidenceBadge: React.FC<ReceiptConfidenceBadgeProps> = ({
  confidence,
  label,
}) => {
  const percentage = Math.round(confidence * 100);
  
  let colorClass = "bg-red-500/10 text-red-400 border border-red-500/20";

  if (percentage >= 90) {
    colorClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
  } else if (percentage >= 70) {
    colorClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}
      title={`Confidence score: ${percentage}%`}
    >
      {label || `${percentage}%`} {percentage < 70 && "⚠️"}
    </span>
  );
};
