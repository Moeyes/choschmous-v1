"use client";

import { useRequireRole, FEATURE_ACCESS } from "@/core/auth";
import { ByCategoryPage } from "@/modules/common";

export default function Page() {
  useRequireRole(FEATURE_ACCESS.bycategory);
  return <ByCategoryPage />;
}
