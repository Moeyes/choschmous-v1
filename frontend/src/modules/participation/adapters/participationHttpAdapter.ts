import type { IParticipationRepository } from '../ports/IParticipationRepository';
import { participationSchema, participationListSchema } from '../schema/participation.schema';
import {
    apiCreateParticipation, apiGetParticipations, apiGetParticipation,
    apiUpdateParticipation, apiDeleteParticipation, apiReviewParticipation,
} from '../api';
import type { ParticipationPerSport, ParticipationPerSportPayload, ParticipationPerSportListResponse, ParticipationReviewPayload } from '../types';

export const participationHttpAdapter: IParticipationRepository = {
    create: async (payload: ParticipationPerSportPayload) => {
        const parsed = participationSchema.parse(await apiCreateParticipation(payload));
        return parsed as unknown as ParticipationPerSport;
    },
    getAll: async (params) => {
        const parsed = participationListSchema.parse(await apiGetParticipations(params));
        return parsed as unknown as ParticipationPerSportListResponse;
    },
    getById: async (id: number) => {
        const parsed = participationSchema.parse(await apiGetParticipation(id));
        return parsed as unknown as ParticipationPerSport;
    },
    update: async (id: number, payload: Partial<ParticipationPerSportPayload>) => {
        const parsed = participationSchema.parse(await apiUpdateParticipation(id, payload as Record<string, unknown>));
        return parsed as unknown as ParticipationPerSport;
    },
    delete: async (id: number) => {
        const r = await apiDeleteParticipation(id);
        return r as unknown as { message: string };
    },
    review: async (id: number, payload: ParticipationReviewPayload) => {
        const parsed = participationSchema.parse(await apiReviewParticipation(id, payload));
        return parsed as unknown as ParticipationPerSport;
    },
};
