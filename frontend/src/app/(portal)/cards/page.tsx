"use client";

import dynamic from "next/dynamic";
import { useRequireRole, FEATURE_ACCESS } from "@/core/auth";
import { PageLoadingState } from "@/shared";

const CardsPage = dynamic(() => import("@/modules/cards").then((m) => m.CardsPage), {
  loading: () => <PageLoadingState />,
});

export default function Page() {
  const { isLoading, hasRole } = useRequireRole(FEATURE_ACCESS.cards);

  if (isLoading) return <PageLoadingState />;
  if (!hasRole) return null;

  return <CardsPage />;
}
