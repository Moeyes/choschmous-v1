"use client";

import { useRequireRole, FEATURE_ACCESS } from "@/core/auth";
import { ByCategoryForm } from "@/modules/bycategory";

export default function Page() {
  useRequireRole(FEATURE_ACCESS.bycategory);
  return <ByCategoryForm />;
}
