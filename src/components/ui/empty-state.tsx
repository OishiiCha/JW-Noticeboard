"use client";

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center gap-3 ${className || ""}`}>
      <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
        <Icon className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">{description}</p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface EmptyStateCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  children,
}: EmptyStateCardProps) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8">
      <div className="flex flex-col items-center justify-center text-center gap-3">
        <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center">
          <Icon className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">{description}</p>
          )}
        </div>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            {actionLabel}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
