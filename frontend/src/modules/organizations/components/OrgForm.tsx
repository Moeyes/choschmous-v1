'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { InstituteType } from '../types';
import { orgFormSchema, instituteTypeOptions, type OrgFormValues, type OrganizationPublic } from '../schema/organizations.schema';
import { formDataToCreateDto, formDataToUpdateDto } from '../mappers/organizations.mapper';
import { useCreateOrganization, useUpdateOrganization } from '../hooks';
import { Button } from '@/shared/ui/button';
import { TextInputField, SelectField } from '@/shared/form';
import { useTranslations } from 'next-intl';

interface OrgFormProps { org?: OrganizationPublic; onSuccess: () => void; onCancel: () => void; }

export function OrgForm({ org, onSuccess, onCancel }: OrgFormProps) {
    const isEditing = !!org;
    const { mutate: create, isPending: isCreating } = useCreateOrganization();
    const { mutate: update, isPending: isUpdating } = useUpdateOrganization();
    const t = useTranslations('organizations');
    const tCommon = useTranslations('common');

    const { control, handleSubmit, formState: { errors } } = useForm<OrgFormValues>({
        resolver: zodResolver(orgFormSchema),
        defaultValues: org
            ? { name_kh: org.name_kh, name_en: org.name_en || '', type: org.type }
            : { name_kh: '', name_en: '', type: InstituteType.PROVINCE },
    });

    const onSubmit = (data: OrgFormValues) => {
        if (isEditing) update(formDataToUpdateDto(org.id, data), { onSuccess });
        else create(formDataToCreateDto(data), { onSuccess });
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextInputField control={control} name="name_kh" label={t('nameKhmer')} required error={errors.name_kh?.message} />
            <TextInputField control={control} name="name_en" label={t('nameEnglish')} error={errors.name_en?.message} />
            <SelectField control={control} name="type" label={t('instituteType')} required options={instituteTypeOptions.map((o) => ({
                value: o.value, label: t(o.labelKey),
            }))} error={errors.type?.message} />
            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>{tCommon('cancel')}</Button>
                <Button type="submit" disabled={isCreating || isUpdating}>
                    {isCreating || isUpdating ? tCommon('saving') : isEditing ? t('editOrganization') : t('createOrganization')}
                </Button>
            </div>
        </form>
    );
}
