"use client";

import { useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Camera, FileText, Info, AlertCircle } from "lucide-react";
import { RegisterFormInput, RegisterFormData } from "../schema/registration.schema";
import { uploadPhoto, uploadDocument } from "@/core/lib/upload/fileStorage";
import {
  Card, CardHeader, CardTitle, CardContent,
  FileUpload,
} from "@/shared";

interface RegisterDocumentsStepProps {
  form: UseFormReturn<RegisterFormInput, unknown, RegisterFormData>;
}

export function RegisterDocumentsStep({ form }: RegisterDocumentsStepProps) {
  const t = useTranslations('registration');
  const tCommon = useTranslations('common');
  const { setValue, watch, formState } = form;
  const errors = formState.errors;
  const photoPath = watch("photoPath");
  const nationalIdPath = watch("nationalIdPath");
  const birthCertificatePath = watch("birthCertificatePath");

  const dateOfBirth = watch("dateOfBirth");
  const isUnder18 = (() => {
    if (!dateOfBirth) return false;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age < 18;
  })();

  const handlePhotoUpload = useCallback(async (file: File) => uploadPhoto(file), []);
  const handleDocumentUpload = useCallback(async (file: File) => uploadDocument(file), []);

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={Camera} subtitle={t('stepSubtitles.documents')}>
          {t('steps.documents')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {t('fields.profilePhoto')}
            <span className="ml-1 text-destructive">*</span>
          </label>
          <p className="text-xs text-muted-foreground">{t('fields.photoUploadDesc')}</p>
          <FileUpload
            variant="hero"
            value={photoPath ?? undefined}
            onChange={(v) => setValue("photoPath", v || null, { shouldValidate: true })}
            onUpload={handlePhotoUpload}
            title={t('fields.profilePhoto')}
          />
          {errors.photoPath && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3" /> {tCommon('required')}
            </p>
          )}
        </div>

        <hr className="border-border" />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('fields.documents')}
            </span>
            <div className="flex-1 border-t border-border" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FileUpload
              variant="tile"
              value={nationalIdPath ?? undefined}
              onChange={(v) => setValue("nationalIdPath", v || null, { shouldValidate: true })}
              onUpload={handleDocumentUpload}
              title={t('fields.idDocument')}
            />
            {isUnder18 && (
              <FileUpload
                variant="tile"
                value={birthCertificatePath ?? undefined}
                onChange={(v) => setValue("birthCertificatePath", v || null, { shouldValidate: true })}
                onUpload={handleDocumentUpload}
                title={t('fields.birthCertificate')}
              />
            )}
          </div>

          {errors.nationalIdPath && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3" /> {tCommon('required')}
            </p>
          )}

          {isUnder18 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>{t('fields.under18BirthCert')}</span>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
