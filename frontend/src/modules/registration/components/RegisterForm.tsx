"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRegisterForm } from "@/modules/registration/hooks";
import { RegisterFormFields } from "./RegisterFormFields";
import { RegistrationSuccess } from "./RegistrationSuccess";
import { useAuth, UserRole } from "@/core/auth";
import { RegisterFormData } from "../schema/registration.schema";
import { eventsRepository } from "@/modules/events/adapters";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import { useCascadingData, useCategories } from "../hooks";
import { RegisterFormNavButtons } from "./RegisterFormNavButtons";
import { StepIndicator, Badge } from "@/shared";

const ALL_STEPS = ["event", "category", "personal", "documents", "review"] as const;
type Step = (typeof ALL_STEPS)[number];

interface RegisterFormProps {
  mode?: "athlete" | "leader";
}

export function RegisterForm({ mode = "athlete" }: RegisterFormProps = {}) {
  const isLeader = mode === "leader";
  const { user } = useAuth();
  const t = useTranslations("registration");

  const FORM_STEPS = useMemo<readonly Step[]>(
    () => (isLeader ? ["event", "personal", "documents", "review"] : ALL_STEPS),
    [isLeader],
  );

  const [currentStep, setCurrentStep] = useState<Step>("event");
  const [maxReached, setMaxReached] = useState(0);
  const [consent, setConsent] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [refNo, setRefNo] = useState("");
  const [registerWindowError, setRegisterWindowError] = useState<string | null>(null);

  const { data: cascadingData, isLoading: cascadingLoading } = useCascadingData();
  const { form, onSubmit, isPending, serverError } = useRegisterForm((enrollId) => {
    setRefNo(`REG-${String(enrollId).padStart(6, "0")}`);
    setIsSuccess(true);
    scrollTop();
  });

  const sportId = form.watch("sportId");
  const eventId = form.watch("eventId");
  const { data: categories = [] } = useCategories(
    eventId ? Number(eventId) : undefined,
    sportId ? Number(sportId) : undefined,
  );

  const stepIndex = FORM_STEPS.indexOf(currentStep);
  const isInitialized = useRef(false);

  const stepLabels = useMemo(
    () => FORM_STEPS.map((s) => t(`steps.${s}`)),
    [FORM_STEPS, t],
  );

  useEffect(() => {
    if (cascadingLoading || !cascadingData) return;
    if (isLeader) form.setValue("role", "leader");
    if (!isInitialized.current && user?.role === UserRole.ORGANIZATION && user.org_id) {
      form.setValue("organizationId", String(user.org_id));
      isInitialized.current = true;
    }
  }, [cascadingData, cascadingLoading, user, form, isLeader]);

  useEffect(() => {
    let active = true;
    async function checkWindow() {
      if (!eventId) {
        if (active) setRegisterWindowError(null);
        return;
      }
      try {
        const event = await eventsRepository.getById(Number(eventId));
        if (!active) return;
        const today = new Date().toISOString().split("T")[0];
        if (event.registration_is_open === false) {
          if (event.registration_open_date && today < event.registration_open_date)
            setRegisterWindowError(t("registrationOpensOn", { date: event.registration_open_date }));
          else if (event.registration_close_date && today > event.registration_close_date)
            setRegisterWindowError(t("registrationClosedOn", { date: event.registration_close_date }));
          else setRegisterWindowError(t("registrationClosed"));
        } else setRegisterWindowError(null);
      } catch {
        if (active) setRegisterWindowError(null);
      }
    }
    checkWindow();
    return () => {
      active = false;
    };
  }, [eventId, t]);

  const goToStep = useCallback(
    (idx: number) => {
      setCurrentStep(FORM_STEPS[idx]);
      setMaxReached((m) => Math.max(m, idx));
      scrollTop();
    },
    [FORM_STEPS],
  );

  const handleNext = useCallback(async () => {
    let fieldsToValidate: Array<keyof RegisterFormData> = [];
    if (currentStep === "event")
      fieldsToValidate = ["eventType", "eventId", "organizationId", "sportId"];
    else if (currentStep === "category") fieldsToValidate = ["categoryId"];
    else if (currentStep === "personal") {
      fieldsToValidate = [
        "khFamilyName", "khGivenName", "enFamilyName", "enGivenName",
        "gender", "dateOfBirth", "phone", "idDocumentType", "role", "nationality",
      ];
      if (form.getValues("role") === "leader") fieldsToValidate.push("leaderRole");
    }

    let isValid = fieldsToValidate.length ? await form.trigger(fieldsToValidate) : true;

    if (currentStep === "documents") {
      isValid = true;
      if (!form.getValues("photoPath")) {
        form.setError("photoPath", { type: "required", message: "required" });
        isValid = false;
      }
      if (!form.getValues("nationalIdPath")) {
        form.setError("nationalIdPath", { type: "required", message: "required" });
        isValid = false;
      }
    }

    if (isValid && stepIndex < FORM_STEPS.length - 1) goToStep(stepIndex + 1);
  }, [currentStep, form, FORM_STEPS, stepIndex, goToStep]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) goToStep(stepIndex - 1);
  }, [stepIndex, goToStep]);

  const handleStepClick = useCallback(
    (idx: number) => {
      if (idx <= maxReached) {
        setCurrentStep(FORM_STEPS[idx]);
        scrollTop();
      }
    },
    [maxReached, FORM_STEPS],
  );

  const handleRegisterAnother = useCallback(() => {
    const eventValues = {
      eventType: form.getValues("eventType"),
      eventId: form.getValues("eventId"),
      organizationId: form.getValues("organizationId"),
      sportId: form.getValues("sportId"),
      categoryId: form.getValues("categoryId"),
      role: form.getValues("role"),
    };
    form.reset(eventValues as RegisterFormData);
    setConsent(false);
    setIsSuccess(false);
    setCurrentStep("personal");
    setMaxReached(FORM_STEPS.indexOf("personal"));
    scrollTop();
  }, [form, FORM_STEPS]);

  const isReview = currentStep === "review";

  if (cascadingLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-20 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="size-6 animate-spin" />
          {t("loadingForm")}
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <RegistrationSuccess
          refNo={refNo}
          onRegisterAnother={handleRegisterAnother}
          onGoHome={() => {
            window.location.href = "/dashboard";
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="text-center">
        <Badge variant="primary" size="sm" className="mb-4 inline-flex gap-1.5">
          <Sparkles className="size-3.5" />
          {t('title')}
        </Badge>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {isLeader ? t("leaderTitle") : t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLeader ? t("leaderSubtitle") : t("subtitle")}
        </p>
      </div>

      <StepIndicator steps={stepLabels} currentIndex={stepIndex} onStepClick={handleStepClick} />

      {(serverError || registerWindowError) && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm font-semibold text-destructive">{serverError || registerWindowError}</p>
        </div>
      )}

      <RegisterFormFields
        form={form}
        cascadingData={cascadingData ?? null}
        categories={categories}
        step={currentStep}
        mode={mode}
        consent={consent}
        setConsent={setConsent}
      />

      <RegisterFormNavButtons
        isFirstStep={stepIndex === 0}
        isReviewStep={isReview}
        isPending={isPending}
        registerWindowError={registerWindowError}
        onBack={handleBack}
        onNext={handleNext}
        onSubmit={form.handleSubmit(onSubmit)}
      />
    </div>
  );
}

function scrollTop() {
  if (typeof window === "undefined") return;
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}
