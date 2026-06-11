"use client";

import dynamic from "next/dynamic";
import { useRequireRole, FEATURE_ACCESS } from "@/core/auth";
import { PageLoadingState } from "@/shared";

const ParticipationPage = dynamic(() => import("@/modules/participation").then((m) => m.ParticipationPage), {
  loading: () => <PageLoadingState />,
});

export default function Page() {
  useRequireRole(FEATURE_ACCESS.participation);
  return <ParticipationPage />;
}
