"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, LogOut, Menu } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth, UserRole } from "@/core/auth";
import { Button, LanguageSwitcher } from "@/shared/ui";
import { queryKeys } from "@/core/api/queryKeys";
import { cn } from "@/shared/utils/cn";

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "superAdmin",
  [UserRole.ADMIN]: "admin",
  [UserRole.ORGANIZATION]: "organization",
  [UserRole.FEDERATION]: "federation",
  [UserRole.GUEST]: "guest",
};

// Top-level route → nav label key. Used to label the section crumb.
const SECTION_LABELS: Array<{ href: string; labelKey: string }> = [
  { href: "/dashboard", labelKey: "dashboard" },
  { href: "/events", labelKey: "events" },
  { href: "/sports", labelKey: "sports" },
  { href: "/organizations", labelKey: "organizations" },
  { href: "/users", labelKey: "users" },
  { href: "/register", labelKey: "athleteRegistration" },
  { href: "/leader-registration", labelKey: "leaderRegistration" },
  { href: "/organizer-registration", labelKey: "organizerRegistration" },
  { href: "/organizer-roles", labelKey: "organizerRoles" },
  { href: "/by-sport", labelKey: "bysport" },
  { href: "/by-number", labelKey: "bynumber" },
  { href: "/by-category", labelKey: "bycategory" },
  { href: "/open-survey", labelKey: "openSurvey" },
  { href: "/participation", labelKey: "submissions" },
  { href: "/sport-submissions", labelKey: "sportSubmissions" },
  { href: "/category-submissions", labelKey: "categorySubmissions" },
  { href: "/registrations", labelKey: "registrations" },
  { href: "/reports", labelKey: "reports" },
  { href: "/cards", labelKey: "cards" },
];

// Detail routes whose leaf crumb should show the entity name, resolved from the
// React Query cache populated by the detail page itself.
const DETAIL_BASES = ["/events", "/sports", "/organizations", "/registrations"];

interface DetailRoute {
  base: string;
  id: string;
}

function parseDetailRoute(pathname: string): DetailRoute | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const base = `/${segments[0]}`;
  if (!DETAIL_BASES.includes(base)) return null;
  // Only numeric record ids — keeps `/events/new` style routes out.
  if (!/^\d+$/.test(segments[1])) return null;
  return { base, id: segments[1] };
}

function detailCacheKey(detail: DetailRoute): readonly unknown[] | null {
  const id = Number(detail.id);
  switch (detail.base) {
    case "/events":
      return queryKeys.events.detail(id);
    case "/sports":
      return queryKeys.sports.detail(id);
    case "/organizations":
      return queryKeys.organizations.detail(id);
    default:
      return null; // registrations resolve to a non-PII reference, not a name
  }
}

function extractName(data: unknown, locale: string): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const kh = typeof record.name_kh === "string" ? record.name_kh : "";
  const en = typeof record.name_en === "string" ? record.name_en : "";
  const picked = locale === "kh" ? kh || en : en || kh;
  return picked || null;
}

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

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
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

  const detail = useMemo(() => parseDetailRoute(pathname), [pathname]);
  const cacheKey = detail ? detailCacheKey(detail) : null;

  // Read-only subscription to the cache entry the detail page populated. With
  // `enabled: false` this never fetches; it just re-renders when that entry
  // arrives, letting us swap the static label for the real entity name.
  const { data: detailData } = useQuery({
    queryKey: cacheKey ?? ["breadcrumb", "noop"],
    queryFn: () => null,
    enabled: false,
  });

  const detailName = useMemo(() => {
    if (!detail) return null;
    if (detail.base === "/registrations") {
      return `REG-${detail.id.padStart(6, "0")}`;
    }
    return extractName(detailData, locale);
  }, [detail, detailData, locale]);

  const crumbs = useMemo(() => {
    const onDashboard = pathname === "/dashboard" || pathname === "/";
    const list: Array<{ label: string; href?: string }> = [
      { label: tNav("dashboard"), href: onDashboard ? undefined : "/dashboard" },
    ];
    if (onDashboard) return list;

    const segments = pathname.split("/").filter(Boolean);
    const topHref = `/${segments[0]}`;
    const match = SECTION_LABELS.find(
      (item) => topHref === item.href || topHref.startsWith(`${item.href}/`),
    );
    let sectionLabelKey = match?.labelKey;
    // Organizations see the participation queue as their leader registrations.
    if (topHref === "/participation" && role === UserRole.ORGANIZATION) {
      sectionLabelKey = "leaderRegistration";
    }
    if (sectionLabelKey) {
      list.push({
        label: tNav(sectionLabelKey as never),
        href: detailName ? topHref : undefined,
      });
    }
    if (detailName) list.push({ label: detailName });
    return list;
  }, [pathname, role, detailName, tNav]);

  const displayName =
    user?.khmer_name ||
    user?.english_name ||
    user?.username ||
    tCommon("account");
  const roleLabel = role
    ? tCommon(`roles.${ROLE_LABELS[role]}` as never)
    : tCommon("role");
  const initials = getInitials(displayName);

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
          aria-label={tCommon("openMenu")}
          className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-primary lg:hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <div className="min-w-0 flex-1">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-sm text-muted-text"
          >
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <div key={index} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-text/40" />
                  )}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="truncate font-medium transition-colors hover:text-heading"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={cn("truncate", isLast && "font-semibold text-heading")}
                      aria-current={isLast ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
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
              aria-label={tCommon("userMenu")}
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
