'use client';

import { useMutation } from '@tanstack/react-query';
import { reportsHttpAdapter } from '../adapters/reportsHttpAdapter';

function triggerDownload(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(new Blob([blob]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
}

export function useReportMutations() {
    const orgSportMutation = useMutation({
        mutationFn: (params: { event_id: number; organization_id?: number }) =>
            reportsHttpAdapter.downloadOrgSportReport(params),
        onSuccess: (blob) => {
            triggerDownload(blob, `org-sport-report-${new Date().getTime()}.xlsx`);
        },
    });

    const orgSportParticipantMutation = useMutation({
        mutationFn: (params: { event_id: number; organization_id?: number }) =>
            reportsHttpAdapter.downloadOrgSportParticipantReport(params),
        onSuccess: (blob) => {
            triggerDownload(blob, `participant-report-${new Date().getTime()}.xlsx`);
        },
    });

    return {
        downloadOrgSport: orgSportMutation.mutate,
        isDownloadingOrgSport: orgSportMutation.isPending,
        isOrgSportDone: orgSportMutation.isSuccess,
        resetOrgSport: orgSportMutation.reset,
        downloadParticipant: orgSportParticipantMutation.mutate,
        isDownloadingParticipant: orgSportParticipantMutation.isPending,
        isParticipantDone: orgSportParticipantMutation.isSuccess,
        resetParticipant: orgSportParticipantMutation.reset,
    };
}
