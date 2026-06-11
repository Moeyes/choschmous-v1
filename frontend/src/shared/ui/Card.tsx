"use client";

import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  elevated?: boolean;
}

export function Card({ children, className = "", hover = true, elevated = false }: CardProps) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-xl border border-border shadow-sm",
        hover && "transition-all duration-200 hover:shadow-md hover:border-border/80",
        elevated && "shadow-md",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function CardHeader({ children, className = "", padded = true }: CardHeaderProps) {
  return (
    <div className={cn(padded && "px-6 pt-6 pb-0", className)}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
  subtitle?: string;
  icon?: LucideIcon;
}

export function CardTitle({ children, className = "", subtitle, icon: Icon }: CardTitleProps) {
  return (
    <div>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50">
            <Icon className="size-4 text-primary" />
          </div>
        )}
        <h3 className={cn("text-base font-semibold text-heading leading-snug tracking-tight", className)}>
          {children}
        </h3>
      </div>
      {subtitle && (
        <p className="mt-0.5 text-sm text-muted-text leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function CardContent({ children, className = "", padded = true }: CardContentProps) {
  return (
    <div className={cn(padded && "p-6", className)}>
      {children}
    </div>
  );
}
