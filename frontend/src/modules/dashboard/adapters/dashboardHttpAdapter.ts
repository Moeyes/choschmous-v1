import type { IDashboardRepository } from '../ports/IDashboardRepository';
import type { DashboardQueryParams, DashboardData } from '../schema/dashboard.schema';
import { dashboardResponseSchema, dashboardDataSchema } from '../schema/dashboard.schema';
import {
    registrationWindowResponseSchema,
    registrationWindowSchema,
} from '../schema/registrationWindow.schema';
import { apiGetDashboardData, apiGetRegistrationWindow } from '../api';

export const dashboardHttpAdapter: IDashboardRepository = {
    async getDashboardData(params?: DashboardQueryParams) {
        const raw = await apiGetDashboardData(params as Record<string, unknown>);
        const parsed = dashboardResponseSchema.safeParse(raw);
        if (parsed.success && parsed.data.success) {
            return parsed.data.data;
        }
        return dashboardDataSchema.parse(raw) as DashboardData;
    },

    async getRegistrationWindow() {
        const raw = await apiGetRegistrationWindow();
        const parsed = registrationWindowResponseSchema.safeParse(raw);
        if (parsed.success && parsed.data.success) {
            return parsed.data.data;
        }
        // Tolerate a bare payload; fall back to a neutral state on bad shape.
        const bare = registrationWindowSchema.safeParse(raw);
        return bare.success ? bare.data : { status: 'unknown' as const };
    },
};
