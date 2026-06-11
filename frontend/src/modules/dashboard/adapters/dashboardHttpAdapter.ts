import type { IDashboardRepository } from '../ports/IDashboardRepository';
import type { DashboardQueryParams, DashboardData } from '../schema/dashboard.schema';
import { dashboardResponseSchema, dashboardDataSchema } from '../schema/dashboard.schema';
import { apiGetDashboardData } from '../api';

export const dashboardHttpAdapter: IDashboardRepository = {
    async getDashboardData(params?: DashboardQueryParams) {
        const raw = await apiGetDashboardData(params as Record<string, unknown>);
        const parsed = dashboardResponseSchema.safeParse(raw);
        if (parsed.success && parsed.data.success) {
            return parsed.data.data;
        }
        return dashboardDataSchema.parse(raw) as DashboardData;
    },
};
