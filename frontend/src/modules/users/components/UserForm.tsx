'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { User } from '@/core/auth';
import { UserRole } from '@/core/auth';
import { userFormSchema, type UserFormValues } from '../schema/users.schema';
import { formDataToCreateDto, formDataToUpdateDto } from '../mappers/users.mapper';
import { useCreateUser, useUpdateUser } from '../hooks';
import { useSports } from '@/modules/sports/hooks';
import { useOrganizations } from '@/modules/organizations/hooks';
import { Button } from '@/shared/ui/button';
import { TextInputField, SelectField } from '@/shared/form';
import { useTranslations } from 'next-intl';

interface UserFormProps { user?: User; onSuccess: () => void; onCancel: () => void; }

export function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
    const isEditing = !!user;
    const { mutate: create, isPending: isCreating } = useCreateUser();
    const { mutate: update, isPending: isUpdating } = useUpdateUser();
    const t       = useTranslations('users');
    const tCommon = useTranslations('common');

    const { data: sports = [],        isLoading: sportsLoading } = useSports();
    const { data: organizations = [], isLoading: orgsLoading   } = useOrganizations();

    const { control, handleSubmit, formState: { errors } } = useForm<UserFormValues>({
        resolver: zodResolver(userFormSchema),
        defaultValues: user ? {
            username: user.username, email: user.email,
            kh_family_name: user.kh_family_name ?? '', kh_given_name: user.kh_given_name ?? '',
            en_family_name: user.en_family_name ?? '', en_given_name: user.en_given_name ?? '',
            role: user.role, organization_id: user.organization_id ?? '', sport_id: user.sport_id ?? '',
        } : {
            role: UserRole.ORGANIZATION, username: '', email: '', password: '',
            kh_family_name: '', kh_given_name: '', en_family_name: '', en_given_name: '',
            organization_id: '', sport_id: '',
        },
    });

    const role         = useWatch({ control, name: 'role' });
    const isFederation = role === UserRole.FEDERATION;
    const isOrganization = role === UserRole.ORGANIZATION;

    const onSubmit = (values: UserFormValues) => {
        if (isEditing) {
            update(formDataToUpdateDto(user.id, values), { onSuccess });
        } else {
            create(formDataToCreateDto(values), { onSuccess });
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextInputField control={control} name="username" label={t('username')} required error={errors.username?.message} />
            <TextInputField control={control} name="email" label={t('email')} type="email" required error={errors.email?.message} />
            {!isEditing && <TextInputField control={control} name="password" label={t('password')} type="password" required error={errors.password?.message} />}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextInputField control={control} name="kh_family_name" label={t('khFamilyName')} required error={errors.kh_family_name?.message} />
                <TextInputField control={control} name="kh_given_name"  label={t('khGivenName')}  required error={errors.kh_given_name?.message}  />
                <TextInputField control={control} name="en_family_name" label={t('enFamilyName')} required error={errors.en_family_name?.message} />
                <TextInputField control={control} name="en_given_name"  label={t('enGivenName')}  required error={errors.en_given_name?.message}  />
            </div>
            <SelectField control={control} name="role" label={t('role')} required
                options={[
                    { value: UserRole.SUPER_ADMIN,  label: t('roles.superAdmin')  },
                    { value: UserRole.ADMIN,         label: t('roles.admin')        },
                    { value: UserRole.ORGANIZATION,  label: t('roles.organization') },
                    { value: UserRole.FEDERATION,    label: t('roles.federation')   },
                ]}
                error={errors.role?.message}
            />
            {isFederation && (
                <SelectField control={control} name="sport_id" label={t('sport')} required
                    placeholder={sportsLoading ? tCommon('loading') : t('selectSport')}
                    options={sports.map((s) => ({ value: String(s.id), label: s.name_kh }))}
                    error={errors.sport_id?.message as string}
                />
            )}
            {isOrganization && (
                <SelectField control={control} name="organization_id" label={t('organization')} required
                    placeholder={orgsLoading ? tCommon('loading') : t('selectOrganization')}
                    options={organizations.map((o) => ({ value: String(o.id), label: o.name_kh }))}
                    error={errors.organization_id?.message as string}
                />
            )}
            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>{tCommon('cancel')}</Button>
                <Button type="submit" disabled={isCreating || isUpdating}>
                    {isCreating || isUpdating ? tCommon('saving') : isEditing ? t('editUser') : t('createUser')}
                </Button>
            </div>
        </form>
    );
}
