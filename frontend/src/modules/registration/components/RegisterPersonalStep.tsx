"use client";

import { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { User, Globe, FileText, AlertCircle } from "lucide-react";
import { RegisterFormInput, RegisterFormData } from "../schema/registration.schema";
import { GENDER_OPTIONS } from "@/core/config/constants";
import {
  Card, CardHeader, CardTitle, CardContent,
  Input,
  ToggleGroup,
} from "@/shared";
import type { ToggleGroupOption } from "@/shared";

interface RegisterPersonalStepProps {
  form: UseFormReturn<RegisterFormInput, unknown, RegisterFormData>;
}

const genderOptions: ToggleGroupOption[] = GENDER_OPTIONS.map((g) => ({
  value: g.value,
  label: g.label,
}));

export function RegisterPersonalStep({ form }: RegisterPersonalStepProps) {
  const t = useTranslations('registration');
  const tCommon = useTranslations('common');
  const { register, setValue, watch, formState } = form;
  const errors = formState.errors;
  const gender = watch("gender");

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={User} subtitle={t('stepSubtitles.personal')}>
          {t('steps.personal')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        <fieldset>
          <div className="mb-4 flex items-center gap-2">
            <Globe className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('fields.fullNameKhmer')}
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground" htmlFor="khFamilyName">
                {t('fields.familyName')}
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Input
                id="khFamilyName"
                {...register("khFamilyName")}
                placeholder={t('fields.familyName')}
              />
              {errors.khFamilyName && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" /> {tCommon('required')}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground" htmlFor="khGivenName">
                {t('fields.givenName')}
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Input
                id="khGivenName"
                {...register("khGivenName")}
                placeholder={t('fields.givenName')}
              />
              {errors.khGivenName && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" /> {tCommon('required')}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <div className="mb-4 flex items-center gap-2">
            <FileText className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('fields.fullNameEnglish')}
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground" htmlFor="enFamilyName">
                {t('fields.familyName')}
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Input
                id="enFamilyName"
                {...register("enFamilyName")}
                placeholder={t('fields.familyName')}
              />
              {errors.enFamilyName && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" /> {tCommon('required')}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground" htmlFor="enGivenName">
                {t('fields.givenName')}
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Input
                id="enGivenName"
                {...register("enGivenName")}
                placeholder={t('fields.givenName')}
              />
              {errors.enGivenName && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" /> {tCommon('required')}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <div className="mb-4 flex items-center gap-2">
            <FileText className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('fields.idType')}
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                {t('fields.gender')}
                <span className="ml-1 text-destructive">*</span>
              </label>
              <ToggleGroup
                options={genderOptions}
                value={gender ?? null}
                onChange={(val) => setValue("gender", val, { shouldValidate: true })}
              />
              {errors.gender && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" /> {tCommon('required')}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground" htmlFor="dateOfBirth">
                {t('fields.dateOfBirth')}
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Input
                id="dateOfBirth"
                type="date"
                {...register("dateOfBirth")}
              />
              {errors.dateOfBirth && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" /> {tCommon('required')}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground" htmlFor="phone">
                {t('fields.phone')}
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Input
                id="phone"
                type="tel"
                {...register("phone")}
                placeholder={t('fields.phone')}
              />
              {errors.phone && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" /> {tCommon('required')}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground" htmlFor="nationality">
                {t('fields.nationality')}
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Input
                id="nationality"
                {...register("nationality")}
                placeholder={t('fields.nationalityPlaceholder')}
              />
              {errors.nationality && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" /> {tCommon('required')}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground" htmlFor="idDocumentType">
                {t('fields.idType')}
              </label>
              <Input
                id="idDocumentType"
                {...register("idDocumentType")}
                placeholder={t('fields.idType')}
              />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <label className="block text-sm font-medium text-foreground" htmlFor="address">
              {t('fields.address')}
            </label>
            <textarea
              id="address"
              rows={3}
              {...register("address")}
              placeholder={t('fields.addressPlaceholder')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </fieldset>

      </CardContent>
    </Card>
  );
}
