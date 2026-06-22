import {
  Users,
  Building2,
  FileText,
  Calendar,
  UserCheck,
  ClipboardList,
} from "lucide-react";
import { DashboardStats } from "../types";
import { PageStats, type PageStatItem } from "@/shared";
import { useAuth, UserRole } from "@/core/auth";
import { useTranslations } from "next-intl";

interface StatsGridProps {
  stats: DashboardStats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  const t = useTranslations("dashboard.stats");
  const { role } = useAuth();

  const athletes = stats.athletes ?? stats.participants;

  let items: PageStatItem[];

  if (role === UserRole.ORGANIZATION) {
    items = [
      { title: t("myEvents"), value: stats.events, icon: Calendar },
      { title: t("mySubmissions"), value: stats.registrations ?? 0, icon: FileText },
      { title: t("myAthletes"), value: athletes, icon: Users },
      { title: t("myLeaders"), value: stats.leaders ?? 0, icon: UserCheck },
    ];
  } else if (role === UserRole.FEDERATION) {
    items = [
      { title: t("assignedEvents"), value: stats.events, icon: Calendar },
      { title: t("categorySurveys"), value: stats.registrations ?? 0, icon: ClipboardList },
      { title: t("myAthletes"), value: athletes, icon: Users },
    ];
  } else {
    items = [
      { title: t("totalEvents"), value: stats.events, icon: Calendar },
      { title: t("totalOrganizations"), value: stats.organizations, icon: Building2 },
      { title: t("pendingSubmissions"), value: stats.registrations ?? 0, icon: FileText },
      { title: t("totalAthletesRegistered"), value: athletes, icon: Users },
    ];
  }

  return <PageStats items={items} columns={role === UserRole.FEDERATION ? 3 : 4} />;
}
