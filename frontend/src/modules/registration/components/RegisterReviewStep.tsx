"use client";

import type { ReactNode } from "react";
import { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import {
  ClipboardCheck, Trophy, UserCircle2,
  Medal, Paperclip, CheckCircle2, MinusCircle, ShieldCheck, Check,
} from "lucide-react";
import { RegisterFormData, RegisterFormInput } from "../schema/registration.schema";
import type { CascadingDataLoaded, CategoryReference as Category } from "@/core/api/referenceData";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/shared";
import { cn } from "@/shared/utils/cn";

interface RegisterReviewStepProps {
  form: UseFormReturn<RegisterFormInput, unknown, RegisterFormData>;
  cascadingData: CascadingDataLoaded | null;
  categories: Category[];
  mode?: "athlete" | "leader";
  isAdmin?: boolean;
  consent: boolean;
  setConsent: (v: boolean) => void;
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/5 px-5 py-3">
        <span className="text-primary">{icon}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="space-y-0 px-5">{children}</div>
    </Card>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <p className="text-xs text-muted-foreground">{k}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{children || "—"}</p>
    </div>
  );
}

export function RegisterReviewStep({
  form,
  cascadingData,
  categories,
  mode = "athlete",
  isAdmin = false,
  consent,
  setConsent,
}: RegisterReviewStepProps) {
  const isLeader = mode === "leader";
  const t = useTranslations("registration");
  const f = form.getValues();

  const event = cascadingData?.events.find((e) => String(e.id) === String(f.eventId));
  const org = cascadingData?.organizations.find((o) => String(o.id) === String(f.organizationId));
  const sport = cascadingData?.sports.find((s) => String(s.id) === String(f.sportId));
  const category = categories.find((c) => String(c.id) === String(f.categoryId));

  const nameKh = [f.khFamilyName, f.khGivenName].filter(Boolean).join(" ");
  const nameEn = [f.enFamilyName, f.enGivenName].filter(Boolean).join(" ").toUpperCase();

  const roleLabel = isLeader || f.role === "leader"
    ? `${f.role === "leader" ? "Leader" : "Athlete"} · ${f.leaderRole || ""}`
    : "Athlete";

  const docs = [
    { ok: !!f.photoPath, label: t("fields.profilePhoto") },
    { ok: !!f.nationalIdPath, label: t("fields.idDocument") },
    { ok: !!f.birthCertificatePath, label: t("fields.birthCertificate") },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={ClipboardCheck} subtitle={t('stepSubtitles.review')}>
          {t('steps.review')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <InfoCard
            icon={<Trophy className="size-4" />}
            title={t('steps.event')}
          >
            <Row k={t('fields.event')}>
              {event?.name_kh || event?.name_en || "—"}
            </Row>
            {isAdmin && (
              <Row k={t('fields.organization')}>
                {org?.name_kh || org?.name_en || "—"}
              </Row>
            )}
            {!isLeader && (
              <Row k={t('fields.category')}>
                {category?.category || "—"}
              </Row>
            )}
            <Row k={t('fields.sport')}>
              {sport ? (
                <Badge variant="primary" size="sm">
                  <Medal className="size-3" />
                  {sport.name_kh || sport.name_en}
                </Badge>
              ) : "—"}
            </Row>
          </InfoCard>

          <InfoCard
            icon={<UserCircle2 className="size-4" />}
            title={t('steps.personal')}
          >
            <Row k={t('fields.fullNameKhmer')}>{nameKh}</Row>
            <Row k={t('fields.fullNameEnglish')}>{nameEn}</Row>
            <Row k={`${t('fields.gender')} · ${t('fields.dateOfBirth')}`}>
              {f.gender}{f.dateOfBirth ? `  ·  ${f.dateOfBirth}` : ""}
            </Row>
            <Row k={t('fields.phone')}>{f.phone}</Row>
            <Row k={t('fields.nationality')}>{f.nationality}</Row>
            <Row k={t('fields.role')}>{roleLabel}</Row>
          </InfoCard>
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/5 px-5 py-3">
            <Paperclip className="size-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{t('fields.documents')}</span>
          </div>
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {docs.map((d, i) => (
              <Badge
                key={i}
                variant={d.ok ? "success" : "secondary"}
                size="sm"
              >
                {d.ok ? <CheckCircle2 className="size-3" /> : <MinusCircle className="size-3" />}
                {d.label}
              </Badge>
            ))}
          </div>
        </Card>

        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary-50/30 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-bold text-primary-800">{t('privacy.title')}</p>
            <p className="mt-1 text-sm text-primary-700/80">{t('privacy.message')}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setConsent(!consent)}
          aria-pressed={consent}
          className={cn(
            "flex w-full items-start gap-3 rounded-lg border bg-card p-4 text-left transition-all",
            consent
              ? "border-primary bg-primary-50/40"
              : "border-border hover:border-primary/40",
          )}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-all",
              consent
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/30 bg-background",
            )}
          >
            {consent && <Check className="size-4" />}
          </span>
          <span className="text-sm text-muted-foreground">
            {t('consent')}
          </span>
        </button>
      </CardContent>
    </Card>
  );
}
