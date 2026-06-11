"use client";

import dynamic from "next/dynamic";
import { useRequireRole, FEATURE_ACCESS } from "@/core/auth";
import { PageLoadingState } from "@/shared";

const SurveyForm = dynamic(() => import("@/modules/survey").then((m) => m.SurveyForm), {
  loading: () => <PageLoadingState />,
});

export default function Page() {
  useRequireRole(FEATURE_ACCESS.bysport);
  return <SurveyForm />;
}
