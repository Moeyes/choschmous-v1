"use client";

import dynamic from "next/dynamic";
import { useRequireRole, FEATURE_ACCESS } from "@/core/auth";
import { PageLoadingState } from "@/shared";

const ImportPage = dynamic(() => import("@/modules/import").then((m) => m.ImportPage), {
  loading: () => <PageLoadingState />,
});

export default function Page() {
  useRequireRole(FEATURE_ACCESS.import);
  return <ImportPage />;
}
