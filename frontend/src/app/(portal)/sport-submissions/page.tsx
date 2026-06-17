"use client";
import dynamic from "next/dynamic";
import { useRequireRole, FEATURE_ACCESS } from "@/core/auth";
import { PageLoadingState } from "@/shared";

const SportSubmissionsPage = dynamic(
    () => import("@/modules/sportreview").then((m) => m.SportSubmissionsPage),
    { loading: () => <PageLoadingState /> }
);

export default function Page() {
    useRequireRole(FEATURE_ACCESS.sportsubmissions);
    return <SportSubmissionsPage />;
}
