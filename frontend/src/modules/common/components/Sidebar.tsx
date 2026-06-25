"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  FilePieChart,
  LayoutDashboard,
  Layers,
  ListChecks,
  Trophy,
  Upload,
  Users,
  UserCheck,
  UserCog,
  UsersRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth, FEATURE_ACCESS, type FeatureKey } from "@/core/auth";
import { cn } from "@/shared/utils/cn";
import { SidebarNav } from "./SidebarNav";
import { SidebarBrand } from "./SidebarBrand";

interface MenuItem {
  labelKey: string;
  href: string;
  icon: React.ElementType;
  feature: FeatureKey;
  /** Render the pending-review count badge on this item. */
  showPendingBadge?: boolean;
}

interface MenuSection {
  labelKey: string;
  items: MenuItem[];
}

type MenuSections = MenuSection[];

const COLLAPSED_KEY = "moeys.sidebar.collapsed";

const MENU_SECTIONS: MenuSections = [
  {
    labelKey: "main",
    items: [{ labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard, feature: "dashboard" }],
  },
  {
    labelKey: "management",
    items: [
      { labelKey: "events", href: "/events", icon: Calendar, feature: "events" },
      { labelKey: "sports", href: "/sports", icon: Trophy, feature: "sports" },
      { labelKey: "organizations", href: "/organizations", icon: Building2, feature: "organizations" },
      { labelKey: "federations", href: "/by-category", icon: Layers, feature: "bycategory" },
      { labelKey: "users", href: "/users", icon: Users, feature: "users" },
    ],
  },
  {
    labelKey: "registration",
    items: [
      { labelKey: "bysport", href: "/by-sport", icon: ClipboardList, feature: "bysport" },
      { labelKey: "bynumber", href: "/by-number", icon: UserCheck, feature: "bynumber" },
      { labelKey: "openSurvey", href: "/open-survey", icon: FileText, feature: "opensurvey" },
      { labelKey: "athleteRegistration", href: "/register", icon: CreditCard, feature: "register" },
      { labelKey: "leaderRegistration", href: "/leader-registration", icon: ClipboardCheck, feature: "leaderregistration" },
      { labelKey: "bulkImport", href: "/import", icon: Upload, feature: "import" },
    ],
  },
  {
    labelKey: "review",
    items: [
      { labelKey: "submissions", href: "/participation", icon: UserCheck, feature: "participation", showPendingBadge: true },
      { labelKey: "sportSubmissions", href: "/sport-submissions", icon: ClipboardCheck, feature: "sportsubmissions" },
      { labelKey: "categorySubmissions", href: "/category-submissions", icon: Layers, feature: "categorysubmissions" },
    ],
  },
  {
    labelKey: "oversight",
    items: [
      { labelKey: "organizerRegistration", href: "/organizer-registration", icon: UsersRound, feature: "organizerregistration" },
      { labelKey: "organizerRoles", href: "/organizer-roles", icon: UserCog, feature: "organizerroles" },
      { labelKey: "registrations", href: "/registrations", icon: ListChecks, feature: "registrations" },
      { labelKey: "reports", href: "/reports", icon: FilePieChart, feature: "reports" },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { role } = useAuth();
  const t = useTranslations("common");
  const [collapsed, setCollapsed] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      return window.localStorage.getItem(COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // Non-fatal
    }
  }, [collapsed]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const sections = useMemo<MenuSections>(() => {
    if (!role) return [];
    return MENU_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => FEATURE_ACCESS[item.feature].includes(role)),
    })).filter((section) => section.items.length > 0);
  }, [role]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-all duration-300 ease-in-expo lg:flex",
          collapsed ? "w-[68px]" : "w-[240px]",
        )}
      >
        <SidebarBrand collapsed={collapsed} showClose={false} />
        <SidebarNav sections={sections} collapsed={collapsed} onMobileClose={onMobileClose} />

        <div className="shrink-0 border-t border-border p-3">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="flex h-8 w-full items-center justify-center rounded-lg text-sidebar-foreground/50 transition-all duration-150 hover:bg-accent hover:text-heading focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div className={cn("lg:hidden", mobileOpen ? "" : "pointer-events-none")}>
        <div
          onClick={onMobileClose}
          aria-hidden
          className={cn(
            "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={t("navigation")}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-border bg-sidebar shadow-xl transition-transform duration-300 ease-in-expo",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <SidebarBrand collapsed={false} showClose={true} onMobileClose={onMobileClose} />
          <SidebarNav sections={sections} collapsed={false} onMobileClose={onMobileClose} />
        </aside>
      </div>
    </>
  );
}
