"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/shared/utils/cn";
import type { FeatureKey } from "@/core/auth";

interface MenuItem {
  labelKey: string;
  href: string;
  icon: React.ElementType;
  feature: FeatureKey;
}

type MenuSections = MenuItem[][];

const SECTION_LABELS: Record<number, string> = {
  0: "main",
  1: "management",
  2: "registration",
  3: "oversight",
};

interface SidebarNavProps {
  sections: MenuSections;
  collapsed: boolean;
  onMobileClose?: () => void;
}

export function SidebarNav({ sections, collapsed, onMobileClose }: SidebarNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 scrollbar-thin">
      {sections.map((section, sectionIndex) => (
        <div
          key={sectionIndex}
          className={cn(
            sectionIndex > 0 && "mt-6"
          )}
        >
          {!collapsed && (
            <p className="px-3 pb-2 text-[11px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest">
              {t(SECTION_LABELS[sectionIndex] as never)}
            </p>
          )}
          <div className="space-y-0.5">
            {section.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={t(item.labelKey as never)}
                  title={collapsed ? t(item.labelKey as never) : undefined}
                  onClick={onMobileClose}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150",
                    collapsed ? "justify-center px-0 py-2.5 mx-auto w-10" : "px-3 py-2.5",
                    isActive
                      ? "bg-primary-50 text-primary shadow-sm"
                      : "text-sidebar-foreground hover:bg-accent hover:text-heading",
                  )}
                >
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
                  )}
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-colors",
                      collapsed && "mx-auto",
                      isActive
                        ? "text-primary"
                        : "text-sidebar-foreground/70 group-hover:text-heading",
                    )}
                  />
                  {!collapsed && (
                    <span className="truncate">{t(item.labelKey as never)}</span>
                  )}
                  {isActive && collapsed && (
                    <span className="absolute inset-0 rounded-lg bg-primary-50" aria-hidden />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
