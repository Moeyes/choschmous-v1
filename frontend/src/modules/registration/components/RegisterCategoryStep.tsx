"use client";

import { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Scale, Swords, Weight, User, Users, Shirt, Heart, Zap, Trophy, Layers, AlertCircle } from "lucide-react";
import { RegisterFormInput, RegisterFormData } from "../schema/registration.schema";
import type { CategoryReference } from "@/core/api/referenceData";
type Category = CategoryReference;
import {
  Card, CardHeader, CardTitle, CardContent,
  RadioCardGroup,
} from "@/shared";
import type { RadioCardOption } from "@/shared";

interface RegisterCategoryStepProps {
  form: UseFormReturn<RegisterFormInput, unknown, RegisterFormData>;
  categories: Category[];
}

function getCategoryIcon(category: Category) {
  const matchStr = `${category.category} ${category.sport_name ?? ""} ${category.gender ?? ""}`.toLowerCase();

  if (/weight|-?\d+kg/.test(matchStr)) return Weight;
  if (/age|under|u\d+|below|years|year/.test(matchStr)) return User;
  if (/open|senior|adult/.test(matchStr)) return Users;
  if (/elite|advance/.test(matchStr)) return Zap;
  if (/youth|junior|kid|child/.test(matchStr)) return Heart;
  if (/light|heavy|welter|middle|feather|fly/.test(matchStr)) return Shirt;
  if (/single|doubles|solo|pair/.test(matchStr)) return Swords;
  if (/team|relay|group/.test(matchStr)) return Users;

  return Scale;
}

export function RegisterCategoryStep({ form, categories }: RegisterCategoryStepProps) {
  const t = useTranslations('registration');
  const tCommon = useTranslations('common');
  const { setValue, watch, formState } = form;
  const categoryId = watch("categoryId");
  const errors = formState.errors;

  const options: RadioCardOption[] = categories.map((cat) => ({
    value: String(cat.id),
    label: cat.category || "",
    description: cat.gender ? `${cat.gender}${cat.sport_name ? ` · ${cat.sport_name}` : ""}` : tCommon('none'),
    icon: getCategoryIcon(cat),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={Layers} subtitle={t('stepSubtitles.category')}>
          {t('steps.category')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {errors.categoryId && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3" />
            {tCommon('required')}
          </p>
        )}

        {options.length > 0 ? (
          <RadioCardGroup
            options={options}
            value={categoryId != null ? String(categoryId) : null}
            onChange={(id) => setValue("categoryId", Number(id), { shouldValidate: true })}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Trophy className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('fields.noCategories')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
