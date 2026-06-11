'use client';

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/button';
import { TextInputField, SelectField } from '@/shared/form';
import { GENDER_OPTIONS, LEADER_ROLE_OPTIONS } from '@/core/config/constants';
import { useUpdateRegistration } from '../hooks';
import type { ParticipantDetailRecord, ParticipantUpdateData } from '../types';

interface ParticipantEditFormProps {
    participant: ParticipantDetailRecord;
    isOpen: boolean;
    onClose: () => void;
}

interface EditFormValues {
    kh_family_name: string;
    kh_given_name: string;
    en_family_name: string;
    en_given_name: string;
    phone: string;
    gender: string;
    date_of_birth: string;
    leader_role: string;
}

export function ParticipantEditForm({ participant, isOpen, onClose }: ParticipantEditFormProps) {
    const t = useTranslations('registration.fields');
    const tDetail = useTranslations('registration.detail');
    const tCommon = useTranslations('common');
    const isLeader = participant.role === 'leader';
    const { mutate, isPending, error } = useUpdateRegistration();

    const { control, handleSubmit, formState } = useForm<EditFormValues>({
        defaultValues: {
            kh_family_name: participant.kh_family_name ?? '',
            kh_given_name: participant.kh_given_name ?? '',
            en_family_name: participant.en_family_name ?? '',
            en_given_name: participant.en_given_name ?? '',
            phone: participant.phone ?? '',
            gender: (participant.gender ?? '').toUpperCase(),
            date_of_birth: participant.date_of_birth ?? '',
            leader_role: participant.leader_role ?? '',
        },
    });

    const onSubmit = (values: EditFormValues) => {
        const data: ParticipantUpdateData = {
            kh_family_name: values.kh_family_name,
            kh_given_name: values.kh_given_name,
            en_family_name: values.en_family_name,
            en_given_name: values.en_given_name,
            phone: values.phone,
            gender: values.gender,
            date_of_birth: values.date_of_birth,
        };
        if (isLeader && values.leader_role) {
            data.leader_role = values.leader_role;
        }

        mutate(
            { enrollId: participant.id, role: participant.role, data },
            { onSuccess: () => onClose() },
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={tDetail('editTitle')} size="2xl">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {error && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                        {tDetail('editError')}
                    </div>
                )}

                <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('fullNameKhmer')}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <TextInputField control={control} name="kh_family_name" label={t('familyName')} lang="km" />
                        <TextInputField control={control} name="kh_given_name" label={t('givenName')} lang="km" />
                    </div>
                </section>

                <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('fullNameEnglish')}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <TextInputField control={control} name="en_family_name" label={t('familyName')} />
                        <TextInputField control={control} name="en_given_name" label={t('givenName')} />
                    </div>
                </section>

                <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {tDetail('sections.personal')}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <TextInputField control={control} name="phone" label={t('phone')} />
                        <SelectField control={control} name="gender" label={t('gender')} options={[...GENDER_OPTIONS]} />
                        <TextInputField control={control} name="date_of_birth" label={t('dateOfBirth')} type="date" />
                        {isLeader && (
                            <SelectField control={control} name="leader_role" label={t('leaderRole')} options={[...LEADER_ROLE_OPTIONS]} />
                        )}
                    </div>
                </section>

                <div className="flex justify-end gap-3 border-t border-border pt-4">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                        {tCommon('cancel')}
                    </Button>
                    <Button type="submit" disabled={isPending || !formState.isDirty}>
                        {isPending ? tCommon('saving') : tCommon('save')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
