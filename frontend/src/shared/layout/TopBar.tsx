"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth, UserRole } from "@/core/auth";
import { Button, LanguageSwitcher } from "@/shared/ui";
import { cn } from "@/shared/utils/cn";

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "superAdmin",
  [UserRole.ADMIN]: "admin",
  [UserRole.ORGANIZATION]: "organization",
  [UserRole.FEDERATION]: "federation",
  [UserRole.GUEST]: "guest",
};

const BREADCRUMB_MAP: Array<{ href: string; labelKey: string }> = [
  { href: "/dashboard", labelKey: "dashboard" },
  { href: "/events", labelKey: "events" },
  { href: "/sports", labelKey: "sports" },
  { href: "/organizations", labelKey: "organizations" },
  { href: "/users", labelKey: "users" },
  { href: "/register", labelKey: "athleteRegistration" },
  { href: "/by-sport", labelKey: "bysport" },
  { href: "/by-number", labelKey: "bynumber" },
  { href: "/by-category", labelKey: "bycategory" },
  { href: "/participation", labelKey: "submissions" },
  { href: "/reports", labelKey: "reports" },
  { href: "/cards", labelKey: "cards" },
];

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: Array<{ href: string; labelKey: string }> = [];

  for (let index = 0; index < segments.length; index += 1) {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const match = BREADCRUMB_MAP.find(
      (item) => href === item.href || href.startsWith(`${item.href}/`),
    );
    if (match && !breadcrumbs.some((crumb) => crumb.href === match.href)) {
      breadcrumbs.push(match);
    }
  }

  return breadcrumbs;
}

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, logout } = useAuth();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const breadcrumbs = useMemo(() => getBreadcrumbs(pathname), [pathname]);
  const displayName =
    user?.khmer_name ||
    user?.english_name ||
    user?.username ||
    tCommon("account");
  const roleLabel = role
    ? tCommon(`roles.${ROLE_LABELS[role]}` as never)
    : tCommon("role");
  const initials = getInitials(displayName);

  const resolveBreadcrumbLabel = (href: string) => {
    if (href === "/participation" && role === UserRole.ORGANIZATION) {
      return "leaderRegistration";
    }
    const match = BREADCRUMB_MAP.find((item) => item.href === href);
    return match?.labelKey ?? "dashboard";
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-header">
      <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-primary lg:hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <div className="min-w-0 flex-1">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-sm text-muted-text"
          >
            <span
              className={cn(
                "truncate",
                breadcrumbs.length === 0
                  ? "font-semibold text-heading"
                  : "font-medium",
              )}
            >
              {tNav("dashboard")}
            </span>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div
                  key={crumb.href}
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-text/40" />
                  <span
                    className={cn(
                      "truncate",
                      isLast && "font-semibold text-heading",
                    )}
                  >
                    {tNav(resolveBreadcrumbLabel(crumb.href) as never)}
                  </span>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-card py-1.5 pl-1.5 pr-2.5 text-left transition-all duration-150 hover:bg-accent hover:border-border/80 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="User menu"
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                {initials}
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-medium text-heading leading-snug">
                  {displayName}
                </p>
                <p className="truncate text-xs text-muted-text leading-relaxed">
                  {roleLabel}
                </p>
              </div>
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-card p-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150"
                role="menu"
              >
                <div className="flex items-center gap-3 rounded-lg bg-accent px-3 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-heading leading-snug">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-muted-text leading-relaxed">
                      {roleLabel}
                    </p>
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-danger hover:bg-danger-bg hover:text-danger"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{tCommon("signOut")}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
