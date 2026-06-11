import type { DashboardData, DashboardQueryParams } from '../schema/dashboard.schema';

export interface IDashboardRepository {
    getDashboardData(params?: DashboardQueryParams): Promise<DashboardData>;
}
