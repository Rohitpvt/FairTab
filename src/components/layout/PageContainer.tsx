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
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-primary">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-text-muted mt-1 leading-relaxed">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
};
