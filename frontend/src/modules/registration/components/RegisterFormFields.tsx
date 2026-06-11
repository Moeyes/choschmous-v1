"use client";

import { UseFormReturn } from "react-hook-form";
import { RegisterFormData, RegisterFormInput } from "../schema/registration.schema";
import {
  type CascadingDataLoaded,
  type CategoryReference as Category,
} from "@/core/api/referenceData";
import { useAuth, UserRole } from "@/core/auth";
import { RegisterEventStep } from "./RegisterEventStep";
import { RegisterCategoryStep } from "./RegisterCategoryStep";
import { RegisterPersonalStep } from "./RegisterPersonalStep";
import { RegisterDocumentsStep } from "./RegisterDocumentsStep";
import { RegisterReviewStep } from "./RegisterReviewStep";

type FormStep = "event" | "category" | "personal" | "documents" | "review";

interface RegisterFormFieldsProps {
  form: UseFormReturn<RegisterFormInput, unknown, RegisterFormData>;
  cascadingData: CascadingDataLoaded | null;
  categories: Category[];
  step: FormStep;
  mode?: "athlete" | "leader";
  consent: boolean;
  setConsent: (v: boolean) => void;
}

export function RegisterFormFields({
  form,
  cascadingData,
  categories,
  step,
  mode = "athlete",
  consent,
  setConsent,
}: RegisterFormFieldsProps) {
  const { user } = useAuth();
  const isAdmin =
    user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  if (step === "event")
    return <RegisterEventStep form={form} cascadingData={cascadingData} isAdmin={isAdmin} />;
  if (step === "category")
    return <RegisterCategoryStep form={form} categories={categories} />;
  if (step === "personal")
    return <RegisterPersonalStep form={form} />;
  if (step === "documents")
    return <RegisterDocumentsStep form={form} />;
  if (step === "review")
    return (
      <RegisterReviewStep
        form={form}
        cascadingData={cascadingData}
        categories={categories}
        mode={mode}
        isAdmin={isAdmin}
        consent={consent}
        setConsent={setConsent}
      />
    );

  return null;
}
