import { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

interface PageShellProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  size?: "default" | "wide" | "narrow" | "full";
  padded?: boolean;
}

const SIZE_CLASS_MAP = {
  default: "max-w-7xl",
  wide: "max-w-7xl",
  narrow: "max-w-5xl",
  full: "max-w-none",
} as const;

export function PageShell({
  children,
  className,
  contentClassName,
  size = "wide",
  padded = true,
}: PageShellProps) {
  return (
    <div className={cn("min-h-full bg-background transition-colors duration-300", className)}>
      <div
        className={cn(
          "mx-auto w-full space-y-6",
          SIZE_CLASS_MAP[size],
          padded && "px-4 py-6 sm:px-6 lg:px-8",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
