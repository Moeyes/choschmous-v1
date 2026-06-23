'use client';

import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Category, Gender } from '../types';
import { categoryFormSchema, type CategoryFormValues } from '../schema/sports.schema';
import { formDataToAddCategory, formDataToUpdateCategory } from '../mappers/sports.mapper';
import { useAddCategory, useUpdateCategory } from '../hooks';
import { Button } from '@/shared/ui/button';
import { TextInputField, SelectField } from '@/shared/form';
import { useTranslations } from 'next-intl';

interface CategoryFormProps { sportId: number; category?: Category; onSuccess: () => void; onCancel: () => void; }

export function CategoryForm({ sportId, category, onSuccess, onCancel }: CategoryFormProps) {
    const isEditing = !!category;
    const { mutate: add, isPending: adding } = useAddCategory();
    const { mutate: update, isPending: updating } = useUpdateCategory();
    const t = useTranslations('sports.categories');
    const tCommon = useTranslations('common');

    const { control, handleSubmit, watch, formState: { errors } } = useForm<CategoryFormValues>({
        // zodResolver infers a distinct input type (gender/team-size preprocessed
        // from `unknown`); cast to the output resolver so it matches useForm<CategoryFormValues>.
        resolver: zodResolver(categoryFormSchema) as Resolver<CategoryFormValues>,
        defaultValues: category
            ? {
                category: category.category,
                gender: category.gender || null,
                // A max above 1 means the saved category is a team category.
                categoryType: (category.team_size_max ?? 1) > 1 ? 'team' : 'individual',
                team_size_min: category.team_size_min ?? null,
                team_size_max: category.team_size_max ?? null,
            }
            : { category: '', gender: null, categoryType: 'individual', team_size_min: null, team_size_max: null },
    });

    const categoryType = watch('categoryType');

    const onSubmit = (data: CategoryFormValues) => {
        if (isEditing) update(formDataToUpdateCategory(category.id, sportId, data), { onSuccess });
        else add(formDataToAddCategory(sportId, data), { onSuccess });
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextInputField control={control} name="category" label={t('categoryName')} required error={errors.category?.message} />
            <SelectField control={control} name="gender" label={t('gender')} options={[
                { value: '', label: t('genders.mixed') },
                { value: Gender.MALE, label: t('genders.male') },
                { value: Gender.FEMALE, label: t('genders.female') },
                { value: Gender.OTHER, label: t('genders.other') },
            ]} error={errors.gender?.message} />
            <SelectField control={control} name="categoryType" label={t('type')} options={[
                { value: 'individual', label: t('typeIndividual') },
                { value: 'team', label: t('typeTeam') },
            ]} />
            {categoryType === 'team' && (
                <div className="grid grid-cols-2 gap-3">
                    <TextInputField control={control} name="team_size_min" label={t('teamSizeMin')} type="number" error={errors.team_size_min?.message} />
                    <TextInputField control={control} name="team_size_max" label={t('teamSizeMax')} type="number" error={errors.team_size_max?.message} />
                </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>{tCommon('cancel')}</Button>
                <Button type="submit" disabled={adding || updating}>
                    {adding || updating ? tCommon('saving') : isEditing ? t('editCategory') : t('addCategory')}
                </Button>
            </div>
        </form>
    );
}
