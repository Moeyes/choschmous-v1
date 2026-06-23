"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRegisterForm, useRegistrationDraft } from "@/modules/registration/hooks";
import { RegisterFormFields } from "./RegisterFormFields";
import { RegistrationSuccess } from "./RegistrationSuccess";
import { useAuth, UserRole } from "@/core/auth";
import { RegisterFormData } from "../schema/registration.schema";
import { eventsRepository } from "@/modules/events/adapters";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles, AlertCircle, Users, Check } from "lucide-react";
import { useCascadingData, useCategories, useEligibleSports } from "../hooks";
import { RegisterFormNavButtons } from "./RegisterFormNavButtons";
import { StepIndicator, Badge, useConfirm } from "@/shared";
import { TeamCreateOrPickStep } from "./TeamCreateOrPickStep";
import { TeamRosterStep } from "./TeamRosterStep";
import type { TeamItem } from "../types/team";

type BaseStep = "event" | "category" | "team" | "personal" | "documents" | "review";

interface RegisterFormProps {
  mode?: "athlete" | "leader";
}

export function RegisterForm({ mode = "athlete" }: RegisterFormProps = {}) {
  const isLeader = mode === "leader";
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslations("registration");

  const BASE_STEPS: readonly BaseStep[] = useMemo(
    () => (isLeader ? ["event", "personal", "documents", "review"] as const : ["event", "category", "personal", "documents", "review"] as const),
    [isLeader],
  );

  const [currentStep, setCurrentStep] = useState<BaseStep>("event");
  const [maxReached, setMaxReached] = useState(0);
  const [consent, setConsent] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [refNo, setRefNo] = useState("");
  const [registerWindowError, setRegisterWindowError] = useState<string | null>(null);
  const [duplicatePending, setDuplicatePending] = useState(false);

  const [selectedTeam, setSelectedTeam] = useState<TeamItem | null>(null);
  const [memberRegistered, setMemberRegistered] = useState(false);
  const [rosterValid, setRosterValid] = useState(true);

  const confirm = useConfirm();
  const { data: cascadingData, isLoading: cascadingLoading } = useCascadingData();

  const handleRegistrationSuccess = useCallback((enrollId: number) => {
    if (selectedTeam) {
      setRefNo(`REG-${String(enrollId).padStart(6, "0")}`);
      setMemberRegistered(true);
      setCurrentStep("team");
      scrollTop();
    } else {
      setRefNo(`REG-${String(enrollId).padStart(6, "0")}`);
      setIsSuccess(true);
      scrollTop();
    }
  }, [selectedTeam]);

  const { form, onSubmit, isPending, serverError } = useRegisterForm(
    handleRegistrationSuccess,
    () => setDuplicatePending(true),
  );

  // Autosave the wizard to localStorage; restore on return, clear on submit.
  const { savedAt, clearDraft } = useRegistrationDraft(
    form,
    user?.id,
    mode,
    !cascadingLoading && !!cascadingData,
  );

  useEffect(() => {
    if (isSuccess || memberRegistered) clearDraft();
  }, [isSuccess, memberRegistered, clearDraft]);

  const sportId = form.watch("sportId");
  const eventId = form.watch("eventId");
  const organizationId = form.watch("organizationId");
  const categoryId = form.watch("categoryId");
  const { data: categories = [] } = useCategories(
    eventId ? Number(eventId) : undefined,
    sportId ? Number(sportId) : undefined,
  );
  const { data: eligibleSports = [] } = useEligibleSports(
    eventId ? Number(eventId) : undefined,
    organizationId ? Number(organizationId) : undefined,
  );

  // A category is a TEAM category when its max team size is > 1 — that, not the
  // sport's mode, drives whether the team flow shows and which min/max applies.
  const selectedSport = eligibleSports.find((s) => s.sports_id === Number(sportId));
  const selectedCategory = categories.find((c) => c.id === Number(categoryId));
  const categoryIsTeam = (selectedCategory?.team_size_max ?? 1) > 1;
  const quota =
    selectedSport && selectedSport.quota_athletes_per_org != null
      ? { used: selectedSport.athletes_used, max: selectedSport.quota_athletes_per_org }
      : null;

  const FORM_STEPS = useMemo<readonly BaseStep[]>(() => {
    if (isLeader) return BASE_STEPS;
    if (categoryIsTeam) {
      return ["event", "category", "team", "personal", "documents", "review"] as const;
    }
    return BASE_STEPS;
  }, [isLeader, BASE_STEPS, categoryIsTeam]);

  const stepIndex = FORM_STEPS.indexOf(currentStep);

  // Soft-duplicate override
  useEffect(() => {
    if (!duplicatePending) return;
    let active = true;
    (async () => {
      const ok = await confirm({
        variant: "default",
        title: t("duplicate.title"),
        message: t("duplicate.message"),
        confirmText: t("duplicate.confirm"),
        cancelText: t("duplicate.cancel"),
      });
      if (!active) return;
      setDuplicatePending(false);
      if (ok) {
        form.setValue("force", true);
        await form.handleSubmit(onSubmit)();
      } else {
        form.setValue("force", false);
      }
    })();
    return () => {
      active = false;
    };
  }, [duplicatePending, confirm, form, onSubmit, t]);

  const isInitialized = useRef(false);

  const stepLabels = useMemo(
    () => FORM_STEPS.map((s) => t(`steps.${s}` as Parameters<typeof t>[0])),
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

  // Sync teamId on form when selectedTeam changes
  useEffect(() => {
    if (selectedTeam) {
      form.setValue("teamId", selectedTeam.id);
    } else {
      form.setValue("teamId", null);
    }
  }, [selectedTeam, form]);

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
    else if (currentStep === "category") {
      fieldsToValidate = ["categoryId"];
    } else if (currentStep === "team") {
      if (!selectedTeam) {
        form.setError("root", { message: t("team.required") });
        return;
      }
      if (!rosterValid) {
        form.setError("root", { message: t("team.minNotReached", { min: selectedCategory?.team_size_min ?? 0 }) });
        return;
      }
    } else if (currentStep === "personal") {
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
      if (isUnder18(form.getValues("dateOfBirth"))) {
        if (!form.getValues("birthCertificatePath")) {
          form.setError("birthCertificatePath", { type: "required", message: "required" });
          isValid = false;
        }
      } else if (!form.getValues("nationalIdPath") && !form.getValues("passportPath")) {
        form.setError("nationalIdPath", { type: "required", message: "required" });
        isValid = false;
      }
    }

    if (isValid && stepIndex < FORM_STEPS.length - 1) goToStep(stepIndex + 1);
  }, [
    currentStep,
    form,
    FORM_STEPS,
    stepIndex,
    goToStep,
    selectedTeam,
    rosterValid,
    selectedCategory?.team_size_min,
    t,
  ]);

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

  // Jump back to a specific step from the review screen (respects maxReached).
  const handleEditStep = useCallback(
    (step: BaseStep) => {
      const idx = FORM_STEPS.indexOf(step);
      if (idx >= 0) handleStepClick(idx);
    },
    [FORM_STEPS, handleStepClick],
  );

  const handleEditMember = useCallback(() => {
    setMemberRegistered(false);
    setCurrentStep("personal");
  }, []);

  const handleRegisterAnother = useCallback(() => {
    const eventValues = {
      eventType: form.getValues("eventType"),
      eventId: form.getValues("eventId"),
      organizationId: form.getValues("organizationId"),
      sportId: form.getValues("sportId"),
      categoryId: form.getValues("categoryId"),
      role: form.getValues("role"),
      teamId: selectedTeam?.id ?? null,
    };
    form.reset(eventValues as RegisterFormData);
    setConsent(false);
    setIsSuccess(false);
    setCurrentStep("personal");
    setMaxReached(FORM_STEPS.indexOf("personal"));
    scrollTop();
  }, [form, FORM_STEPS, selectedTeam]);

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
            router.push("/dashboard");
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
        {quota && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground">
            <Users className="size-3.5 text-muted-foreground" />
            <span>{t("quota.label")}</span>
            <span className={quota.used >= quota.max ? "text-destructive" : "text-primary"}>
              {quota.used}/{quota.max}
            </span>
          </div>
        )}
      </div>

      <StepIndicator steps={stepLabels} currentIndex={stepIndex} onStepClick={handleStepClick} />

      {savedAt !== null && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
          <Check className="size-3.5 text-success" aria-hidden />
          {t("draftSaved")}
        </p>
      )}

      {(serverError || registerWindowError) && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm font-semibold text-destructive">{serverError || registerWindowError}</p>
        </div>
      )}

      {/* Step content */}
      {currentStep === "event" && (
        <RegisterFormFields
          form={form}
          cascadingData={cascadingData ?? null}
          categories={categories}
          eligibleSports={eligibleSports}
          step="event"
          mode={mode}
          consent={consent}
          setConsent={setConsent}
        />
      )}

      {currentStep === "category" && (
        <RegisterFormFields
          form={form}
          cascadingData={cascadingData ?? null}
          categories={categories}
          eligibleSports={eligibleSports}
          step="category"
          mode={mode}
          consent={consent}
          setConsent={setConsent}
        />
      )}

      {currentStep === "team" && (
        <div className="space-y-4">
          <TeamCreateOrPickStep
            eventId={Number(eventId)}
            sportId={Number(sportId)}
            orgId={Number(form.getValues("organizationId"))}
            categoryId={form.getValues("categoryId") ? Number(form.getValues("categoryId")) : null}
            value={selectedTeam}
            onChange={(team) => setSelectedTeam(team)}
          />
          {selectedTeam && (
            <TeamRosterStep
              teamId={selectedTeam.id}
              teamSizeMin={selectedCategory?.team_size_min}
              teamSizeMax={selectedCategory?.team_size_max}
              onAddMember={() => {
                setMemberRegistered(false);
                const idx = FORM_STEPS.indexOf("personal");
                if (idx >= 0) goToStep(idx);
              }}
              onEditMember={handleEditMember}
              onValidationChange={setRosterValid}
            />
          )}
          {memberRegistered && selectedTeam && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center text-sm text-primary">
              {t("team.memberAdded")}
            </div>
          )}
        </div>
      )}

      {currentStep === "personal" && (
        <RegisterFormFields
          form={form}
          cascadingData={cascadingData ?? null}
          categories={categories}
          eligibleSports={eligibleSports}
          step="personal"
          mode={mode}
          consent={consent}
          setConsent={setConsent}
        />
      )}

      {currentStep === "documents" && (
        <RegisterFormFields
          form={form}
          cascadingData={cascadingData ?? null}
          categories={categories}
          eligibleSports={eligibleSports}
          step="documents"
          mode={mode}
          consent={consent}
          setConsent={setConsent}
        />
      )}

      {currentStep === "review" && (
        <RegisterFormFields
          form={form}
          cascadingData={cascadingData ?? null}
          categories={categories}
          eligibleSports={eligibleSports}
          step="review"
          mode={mode}
          consent={consent}
          setConsent={setConsent}
          onEditStep={handleEditStep}
        />
      )}

      <RegisterFormNavButtons
        isFirstStep={stepIndex === 0}
        isReviewStep={isReview}
        isPending={isPending}
        registerWindowError={registerWindowError}
        canProceed={currentStep !== "team" || rosterValid}
        onBack={handleBack}
        onNext={handleNext}
        onSubmit={form.handleSubmit(onSubmit)}
      />
    </div>
  );
}

function isUnder18(dateOfBirth: string | null | undefined): boolean {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age < 18;
}

function scrollTop() {
  if (typeof window === "undefined") return;
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}
