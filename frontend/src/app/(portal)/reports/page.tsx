"use client";

import dynamic from "next/dynamic";
import { useRequireRole, FEATURE_ACCESS } from "@/core/auth";
import { PageLoadingState } from "@/shared";

const ReportsPage = dynamic(() => import("@/modules/reports").then((m) => m.ReportsPage), {
  loading: () => <PageLoadingState />,
});

export default function Page() {
  useRequireRole(FEATURE_ACCESS.reports);
  return <ReportsPage />;
}
