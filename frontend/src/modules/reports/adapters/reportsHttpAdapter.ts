import type { IReportsRepository } from '../ports/IReportsRepository';
import type { ReportDownloadParams } from '../schema/reports.schema';
import { apiDownloadOrgSportReport, apiDownloadOrgSportParticipantReport } from '../api';

export const reportsHttpAdapter: IReportsRepository = {
    async downloadOrgSportReport(params: ReportDownloadParams) {
        return apiDownloadOrgSportReport(params as Record<string, unknown>);
    },
    async downloadOrgSportParticipantReport(params: ReportDownloadParams) {
        return apiDownloadOrgSportParticipantReport(params as Record<string, unknown>);
    },
};
