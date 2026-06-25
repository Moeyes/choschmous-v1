import type { DashboardData, DashboardQueryParams } from '../schema/dashboard.schema';
import type { RegistrationWindow } from '../schema/registrationWindow.schema';

export interface IDashboardRepository {
    getDashboardData(params?: DashboardQueryParams): Promise<DashboardData>;
    /** System-wide registration-window headline (Public scheduling data). */
    getRegistrationWindow(): Promise<RegistrationWindow>;
}
