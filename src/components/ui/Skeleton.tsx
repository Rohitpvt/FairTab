import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "", ...props }) => {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={`bg-surface-elevated animate-pulse motion-reduce:animate-none rounded-md ${className}`}
      {...props}
    />
  );
};

export const BalanceCardSkeleton: React.FC = () => {
  return (
    <div className="glass-standard rounded-xl p-6 flex justify-between items-center w-full h-[94px]">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-36" />
      </div>
      <Skeleton className="h-10 w-10 rounded-xl" />
    </div>
  );
};

export const ExpenseRowSkeleton: React.FC = () => {
  return (
    <div className="glass-subtle border border-white/5 rounded-xl p-4 flex justify-between items-center w-full h-[70px]">
      <div className="flex items-center gap-3 w-1/2">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex flex-col gap-2 w-full">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
};

export const GroupCardSkeleton: React.FC = () => {
  return (
    <div className="glass-standard rounded-xl p-5 flex flex-col gap-4 w-full h-[142px]">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-2 w-14" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <div className="flex justify-between items-center mt-2 pt-3 border-t border-white/5">
        <div className="flex -space-x-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-16" />
      </div>
    </div>
  );
};

export const ChartSkeleton: React.FC = () => {
  return (
    <div className="glass-standard rounded-xl p-5 flex flex-col gap-4 w-full h-[240px]">
      <Skeleton className="h-4 w-36" />
      <div className="flex items-end justify-between h-full pt-4 px-2">
        <Skeleton className="h-[20%] w-10 rounded-t" />
        <Skeleton className="h-[60%] w-10 rounded-t" />
        <Skeleton className="h-[45%] w-10 rounded-t" />
        <Skeleton className="h-[80%] w-10 rounded-t" />
        <Skeleton className="h-[30%] w-10 rounded-t" />
        <Skeleton className="h-[95%] w-10 rounded-t" />
      </div>
    </div>
  );
};

export const DetailHeroSkeleton: React.FC = () => {
  return (
    <div className="glass-elevated border border-white/10 rounded-2xl p-6 flex flex-col gap-5 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/5">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    </div>
  );
};

export const InsightCardSkeleton: React.FC = () => {
  return (
    <div className="glass-standard border border-white/10 rounded-2xl p-5 flex flex-col justify-between h-[200px]">
      <div>
        <div className="flex justify-between items-start mb-3">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-lg" />
        </div>
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-3.5 w-full mb-1" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      <div className="pt-3 border-t border-white/5 flex justify-between items-center">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
};

export const BudgetCardSkeleton: React.FC = () => {
  return (
    <div className="glass-standard border border-white/10 rounded-2xl p-5 flex flex-col justify-between h-[180px]">
      <div>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-white/5 text-xs">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3.5 w-16" />
      </div>
    </div>
  );
};

export const RecurringOccurrenceSkeleton: React.FC = () => {
  return (
    <div className="glass-standard border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-3.5 w-48" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
};

export const RecurringTemplateSkeleton: React.FC = () => {
  return (
    <div className="glass-standard border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-44" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
};

export const NotificationItemSkeleton: React.FC = () => {
  return (
    <div className="glass-elevated border border-white/10 rounded-2xl p-4 md:p-5 flex items-start gap-4">
      <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
      <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-col gap-2 w-full max-w-sm">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3.5 w-60" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export const ProfileCardSkeleton: React.FC = () => {
  return (
    <div className="glass-standard border border-white/10 rounded-2xl p-6 flex items-center gap-4">
      <Skeleton className="h-14 w-14 rounded-full shrink-0" />
      <div className="flex flex-col gap-2 flex-grow">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3.5 w-48" />
      </div>
      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
    </div>
  );
};

export const FormCardSkeleton: React.FC = () => {
  return (
    <div className="glass-elevated border border-white/10 rounded-2xl p-6 flex flex-col gap-6 max-w-2xl mx-auto w-full">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
};

export const ReceiptScannerSkeleton: React.FC = () => {
  return (
    <div className="glass-elevated border border-white/10 rounded-2xl p-6 flex flex-col gap-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
      <div className="flex justify-between items-center pt-4 border-t border-white/5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
    </div>
  );
};

export const MemberRowSkeleton: React.FC = () => {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
};
