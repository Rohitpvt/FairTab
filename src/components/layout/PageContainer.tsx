import React from "react";

export interface PageContainerProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  title,
  description,
  action,
  children,
}) => {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-8 flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-text-primary truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0 flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
};
