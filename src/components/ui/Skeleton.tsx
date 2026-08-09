import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "", ...props }) => {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={`bg-surface-elevated animate-pulse rounded-md ${className}`}
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
