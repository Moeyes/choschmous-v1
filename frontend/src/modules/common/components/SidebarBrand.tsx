"use client";

import Link from "next/link";
import { cn } from "@/shared/utils/cn";
import { Landmark, X } from "lucide-react";

interface SidebarBrandProps {
  collapsed: boolean;
  showClose: boolean;
  onMobileClose?: () => void;
}

export function SidebarBrand({ collapsed, showClose, onMobileClose }: SidebarBrandProps) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 transition-all duration-200",
        collapsed && "justify-center px-0",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground shadow-sm">
        <Landmark className="h-5 w-5" />
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-heading leading-snug">
            ប្រព័ន្ធកីឡា
          </p>
          <p className="truncate text-[11px] font-medium text-sidebar-foreground/60 leading-relaxed tracking-wide uppercase">
            MOEYS Sports
          </p>
        </div>
      )}
      {showClose && (
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close menu"
          className="-mr-1 ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </Link>
  );
}
