'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Building2, Trophy, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/Badge';
import { PageHeader, PageShell, PageErrorState, PageLoadingState } from '@/shared';
import { apiGetSportOrgSubmissions, apiReviewSportOrg } from '../api/sportOrgApi';

type Status = 'SUBMITTED' | 'APPROVED' | 'REJECTED';

interface SportOrgRow {
    id: number;
    events_id: number;
    sports_id: number;
    organization_id: number;
    status: Status;
    review_note: string | null;
    reviewed_at: string | null;
    created_at: string;
    org_name: string;
    sport_name: string;
    event_name: string;
}

const badgeVariant = (status: Status) => {
    if (status === 'APPROVED') return 'approved';
    if (status === 'REJECTED') return 'rejected';
    return 'submitted';
};

export function SportOrgSubmissionsPage() {
    const qc = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [rejectNote, setRejectNote] = useState('');
    const [rejectingId, setRejectingId] = useState<number | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['sport-org-submissions', statusFilter],
        queryFn: () => apiGetSportOrgSubmissions(
            statusFilter !== 'all' ? { status: statusFilter } : undefined
        ),
    });

    const reviewMutation = useMutation({
        mutationFn: ({ id, action, note }: { id: number; action: string; note?: string }) =>
            apiReviewSportOrg(id, { action, note }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['sport-org-submissions'] });
            setRejectingId(null);
            setRejectNote('');
        },
    });

    const rows: SportOrgRow[] = data?.data ?? [];

    if (isLoading) return <PageLoadingState />;
    if (error) return <PageErrorState title="Failed to load" description="Could not load sport submissions." />;

    return (
        <PageShell size="wide">
            <PageHeader
                title="By Sport Submissions"
                description="Review and approve organization sport selections"
            />

            {/* Filter */}
            <div className="flex gap-2">
                {(['all', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const).map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                            statusFilter === s
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                    >
                        {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="space-y-3">
                {rows.length === 0 ? (
                    <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
                        No submissions found.
                    </div>
                ) : rows.map((row) => (
                    <div key={row.id} className="rounded-lg border border-border bg-card shadow-sm">
                        {/* Row header */}
                        <div
                            className="flex cursor-pointer items-center gap-4 p-4"
                            onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground">{row.org_name}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                    <span className="flex items-center gap-1">
                                        <Trophy className="h-3 w-3" />{row.sport_name}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />{row.event_name}
                                    </span>
                                </div>
                            </div>
                            <Badge variant={badgeVariant(row.status) as any}>
                                {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                            </Badge>
                            {expandedId === row.id
                                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            }
                        </div>

                        {/* Expanded detail */}
                        {expandedId === row.id && (
                            <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                                <div className="text-xs text-muted-foreground">
                                    Submitted: {new Date(row.created_at).toLocaleString()}
                                    {row.reviewed_at && (
                                        <span className="ml-4">
                                            Reviewed: {new Date(row.reviewed_at).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                {row.review_note && (
                                    <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
                                        Note: {row.review_note}
                                    </div>
                                )}

                                {row.status === 'SUBMITTED' && (
                                    <>
                                        {rejectingId === row.id ? (
                                            <div className="space-y-2">
                                                <textarea
                                                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                                    rows={2}
                                                    placeholder="Reason for rejection (optional)"
                                                    value={rejectNote}
                                                    onChange={(e) => setRejectNote(e.target.value)}
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        loading={reviewMutation.isPending}
                                                        onClick={() => reviewMutation.mutate({ id: row.id, action: 'reject', note: rejectNote || undefined })}
                                                    >
                                                        Confirm Reject
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={() => setRejectingId(null)}>
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    className="gap-1.5 bg-success text-white hover:bg-success/90"
                                                    loading={reviewMutation.isPending}
                                                    onClick={() => reviewMutation.mutate({ id: row.id, action: 'approve' })}
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Approve
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="gap-1.5"
                                                    disabled={reviewMutation.isPending}
                                                    onClick={() => setRejectingId(row.id)}
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                    Reject
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </PageShell>
    );
}
