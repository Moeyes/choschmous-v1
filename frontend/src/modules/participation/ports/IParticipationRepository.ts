import type { ParticipationPerSport, ParticipationPerSportPayload, ParticipationPerSportListResponse, ParticipationReviewPayload } from '../types';

export interface IParticipationRepository {
    create(payload: ParticipationPerSportPayload): Promise<ParticipationPerSport>;
    getAll(params?: { skip?: number; limit?: number; organization_id?: number; event_id?: number; sport_id?: number }): Promise<ParticipationPerSportListResponse>;
    getById(id: number): Promise<ParticipationPerSport>;
    update(id: number, payload: Partial<ParticipationPerSportPayload>): Promise<ParticipationPerSport>;
    delete(id: number): Promise<{ message: string }>;
    review(id: number, payload: ParticipationReviewPayload): Promise<ParticipationPerSport>;
}
