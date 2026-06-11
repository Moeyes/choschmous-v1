import type { ReportDownloadParams } from '../schema/reports.schema';

export interface IReportsRepository {
    downloadOrgSportReport(params: ReportDownloadParams): Promise<Blob>;
    downloadOrgSportParticipantReport(params: ReportDownloadParams): Promise<Blob>;
}
