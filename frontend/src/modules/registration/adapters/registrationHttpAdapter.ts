import type { IRegistrationRepository } from '../ports/IRegistrationRepository';
import { enrollmentListResponseSchema, participantDetailResponseSchema, registerResponseSchema, revealedPiiSchema } from '../schema/registration.schema';
import {
    apiRegisterParticipant, apiSearchRegistrations, apiGetRegistration,
    apiRevealParticipantPii, apiUpdateRegistration, apiDeleteRegistration,
} from '../api';
import type { RegisterPayload, RegisterResponse, EnrollmentListResponse, ParticipantDetailRecord, ParticipantUpdateData } from '../types';

export const registrationHttpAdapter: IRegistrationRepository = {
    register: async (payload: RegisterPayload) => {
        const parsed = registerResponseSchema.parse(await apiRegisterParticipant(payload));
        return parsed as unknown as RegisterResponse;
    },
    getAll: async (params) => {
        const parsed = enrollmentListResponseSchema.parse(await apiSearchRegistrations(params));
        return parsed as unknown as EnrollmentListResponse;
    },
    revealPhone: async (enrollId: number) => {
        return revealedPiiSchema.parse(await apiRevealParticipantPii(enrollId));
    },
    getById: async (enrollId: number, role: string) => {
        const parsed = participantDetailResponseSchema.parse(await apiGetRegistration(enrollId, role));
        return parsed.data as unknown as ParticipantDetailRecord;
    },
    update: async (enrollId: number, role: string, data: ParticipantUpdateData) => {
        const parsed = participantDetailResponseSchema.parse(
            await apiUpdateRegistration(enrollId, role, data as Record<string, unknown>),
        );
        return parsed.data as unknown as ParticipantDetailRecord;
    },
    delete: async (enrollId: number) => {
        const r = await apiDeleteRegistration(enrollId);
        return r as unknown as { message: string };
    },
};
