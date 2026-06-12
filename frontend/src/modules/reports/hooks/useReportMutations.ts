'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { apiDownloadReport, apiGetSurveyStatus } from '../api';
import { queryKeys } from '@/core/api/queryKeys';

function triggerDownload(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
}

export function useReportDownload() {
    return useMutation({
        mutationFn: ({
            key,
            event_id,
            org_id,
            source,
            format,
        }: {
            key: string;
            event_id: number;
            org_id?: number;
            source?: 'planned' | 'actual';
            format: 'xlsx' | 'pdf';
        }) =>
            apiDownloadReport(key, {
                event_id,
                ...(org_id ? { org_id } : {}),
                ...(source ? { source } : {}),
                format,
            }),
        onSuccess: (_blob, variables) => {
            triggerDownload(_blob, `${variables.key}_${variables.event_id}.${variables.format}`);
        },
    });
}

export function useSurveyStatus(eventId: number, enabled = true) {
    return useQuery({
        queryKey: queryKeys.surveyStatus.byEvent(eventId),
        queryFn: () => apiGetSurveyStatus(eventId),
        enabled: !!eventId && enabled,
    });
}
