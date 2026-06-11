"use client";

import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface FormSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon | ReactNode;
  children: ReactNode;
}

export function FormSection({
  title,
  description,
  icon: Icon,
  children,
}: FormSectionProps) {
  return (
    <div className="bg-card text-card-foreground rounded-lg border border-l-4 border-border border-l-primary p-6 shadow-sm">
      {/* Section Header with Icon */}
      <div className="mb-5 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          {Icon && typeof Icon === "function" && (
            <Icon className="h-5 w-5 text-primary" />
          )}
          <h2 className="text-base font-semibold leading-snug text-foreground">
            {title}
          </h2>
        </div>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {/* Section Content */}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
