'use client';

import { useCallback } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/core/auth';
import { useRegisterMutation } from './useRegisterMutation';
import { formDataToPayload, parseApiError, ApiErrorResponse } from '@/modules/registration/types';
import {
    registerSchema,
    type RegisterFormData,
    type RegisterFormInput,
} from '../schema/registration.schema';

interface UseRegisterFormReturn {
    form: UseFormReturn<RegisterFormInput, unknown, RegisterFormData>;
    onSubmit: (data: RegisterFormData) => Promise<void>;
    isPending: boolean;
    serverError: string | null;
}

// Structured codes that have a localized message under registration.errors.*;
// anything else falls back to the backend-supplied message.
const LOCALIZED_CODES = new Set([
    'REGISTRATION_CLOSED',
    'SPORT_NOT_ELIGIBLE',
    'CATEGORY_INVALID',
    'AGE_OUT_OF_RANGE',
    'DOCUMENT_REQUIRED',
    'QUOTA_FULL',
]);

export function useRegisterForm(
    onSuccess?: (enrollId: number) => void,
    onDuplicate?: () => void,
): UseRegisterFormReturn {
    const { user } = useAuth();
    const tErr = useTranslations('registration.errors');
    
    const form = useForm<RegisterFormInput, unknown, RegisterFormData>({
        resolver: zodResolver(registerSchema),
        mode: 'onBlur',
        defaultValues: {
            eventType: null,
            khFamilyName: '',
            khGivenName: '',
            enFamilyName: '',
            enGivenName: '',
            gender: 'MALE',
            dateOfBirth: '',
            nationality: 'Cambodian',
            phone: '',
            idDocumentType: 'OTHER',
            address: '',
            role: 'athlete',
            eventId: null,
            organizationId: null,
            sportId: null,
            categoryId: null,
            teamId: null,
            leaderRole: '',
            photoPath: null,
            birthCertificatePath: null,
            nationalIdPath: null,
            passportPath: null,
            _uploadPhoto: false,
            _uploadId: false,
            _uploadBirth: false,
            _uploadPassport: false,
        },
    });

    const mutation = useRegisterMutation({
        onSuccess: (data) => {
            if (onSuccess) {
                onSuccess(data.enroll_id);
            }
        },
        onError: (error) => {
            // The api client rejects with the raw Axios error; the structured
            // detail lives at error.response.data.
            const body =
                (error as { response?: { data?: ApiErrorResponse } })?.response?.data ??
                (error as ApiErrorResponse);
            const parsed = parseApiError(body);

            // Soft duplicate → let the caller show the override dialog.
            if (parsed.duplicateSuspect) {
                if (onDuplicate) onDuplicate();
                else form.setError('root', { message: parsed.message });
                return;
            }

            // FastAPI field-validation array → per-field errors.
            if (parsed.fields) {
                parsed.fields.forEach((message, field) => {
                    form.setError(field as unknown as keyof RegisterFormData, { message });
                });
                return;
            }

            const message =
                parsed.code && LOCALIZED_CODES.has(parsed.code)
                    ? tErr(parsed.code, (parsed.params ?? {}) as Record<string, string | number>)
                    : parsed.message;
            form.setError('root', { message });
        },
    });

    const onSubmit = useCallback(
        async (data: RegisterFormData) => {
            if (!user?.id) {
                form.setError('root', { message: 'User not authenticated. Please login first.' });
                return;
            }
            const payload = formDataToPayload(data, user.id);
            await mutation.mutateAsync(payload);
        },
        [mutation, user, form]
    );

    return {
        form,
        onSubmit,
        isPending: mutation.isPending,
        serverError: form.formState.errors.root?.message || null,
    };
}
