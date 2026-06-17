"use client";
import dynamic from "next/dynamic";
import { useRequireRole, FEATURE_ACCESS } from "@/core/auth";
import { PageLoadingState } from "@/shared";

const CategorySubmissionsPage = dynamic(
    () => import("@/modules/categoryreview").then((m) => m.CategorySubmissionsPage),
    { loading: () => <PageLoadingState /> }
);

export default function Page() {
    useRequireRole(FEATURE_ACCESS.categorysubmissions);
    return <CategorySubmissionsPage />;
}
