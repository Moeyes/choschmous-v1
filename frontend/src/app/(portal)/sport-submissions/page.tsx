"use client";
import dynamic from "next/dynamic";
import { useRequireRole, FEATURE_ACCESS } from "@/core/auth";
import { PageLoadingState } from "@/shared";

const SportOrgSubmissionsPage = dynamic(
    () => import("@/modules/participation/components/SportOrgSubmissionsPage").then((m) => m.SportOrgSubmissionsPage),
    { loading: () => <PageLoadingState /> }
);

export default function Page() {
    useRequireRole(FEATURE_ACCESS.participation);
    return <SportOrgSubmissionsPage />;
}
